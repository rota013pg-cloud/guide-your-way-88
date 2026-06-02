CREATE OR REPLACE FUNCTION public.recomputa_cobranca_motorista(_codigo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dia DATE;
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
  v_faturamento NUMERIC;
  v_diaria NUMERIC;
  v_percent NUMERIC;
  v_pago BOOLEAN;
  v_cfg JSONB;
  v_status TEXT;
  v_atual_status TEXT;
  v_existe BOOLEAN;
BEGIN
  v_dia := public.dia_operacional(now());
  v_inicio := ((v_dia::text || ' 06:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_fim    := v_inicio + INTERVAL '1 day';

  SELECT COALESCE(SUM(valor_final), 0) INTO v_faturamento
    FROM public.corridas
   WHERE motorista_codigo = _codigo
     AND status = 'Finalizada'::status_corrida
     AND COALESCE(finalizada_em, atualizado_em) >= v_inicio
     AND COALESCE(finalizada_em, atualizado_em) <  v_fim;

  SELECT config_json INTO v_cfg FROM public.app_config WHERE id = 1;
  v_diaria  := COALESCE((v_cfg->>'valorDiaria')::numeric, 20);
  v_percent := COALESCE((v_cfg->>'percentualBloqueio')::numeric, 50);

  SELECT EXISTS (
    SELECT 1 FROM public.financeiro
     WHERE motorista_codigo = _codigo
       AND tipo = 'Diária'
       AND COALESCE(dia_op, public.dia_operacional(data)) = v_dia
  ) INTO v_pago;

  SELECT status INTO v_atual_status
    FROM public.motorista_cobranca
   WHERE motorista_codigo = _codigo AND dia_op = v_dia;
  v_existe := FOUND;

  -- Determina status correto
  IF v_pago THEN
    v_status := 'Pago';
  ELSIF v_faturamento >= v_diaria * (1 + v_percent / 100.0) THEN
    v_status := 'Bloqueado';
  ELSIF v_faturamento >= v_diaria THEN
    IF v_atual_status = 'Aguardando' THEN
      v_status := 'Aguardando';
    ELSE
      v_status := 'Pendente';
    END IF;
  ELSE
    -- Faturamento ainda abaixo da diária: NÃO está "travado em pagamento"
    v_status := 'OK';
  END IF;

  -- Se não há registro e não há nada para reportar (OK), não cria linha
  IF NOT v_existe AND v_status = 'OK' THEN
    RETURN;
  END IF;

  INSERT INTO public.motorista_cobranca (motorista_codigo, dia_op, status, faturamento_dia, valor_diaria,
    disparou_aviso_em, disparou_bloqueio_em)
  VALUES (_codigo, v_dia, v_status, v_faturamento, v_diaria,
    CASE WHEN v_status IN ('Pendente','Aguardando','Bloqueado') AND v_faturamento >= v_diaria THEN now() END,
    CASE WHEN v_status = 'Bloqueado' THEN now() END)
  ON CONFLICT (motorista_codigo, dia_op) DO UPDATE
    SET faturamento_dia       = EXCLUDED.faturamento_dia,
        valor_diaria          = EXCLUDED.valor_diaria,
        status                = EXCLUDED.status,
        disparou_aviso_em     = COALESCE(public.motorista_cobranca.disparou_aviso_em,
                                  CASE WHEN EXCLUDED.faturamento_dia >= EXCLUDED.valor_diaria THEN now() END),
        disparou_bloqueio_em  = COALESCE(public.motorista_cobranca.disparou_bloqueio_em,
                                  CASE WHEN EXCLUDED.status = 'Bloqueado' THEN now() END),
        liberado_em           = CASE WHEN EXCLUDED.status = 'Pago' AND public.motorista_cobranca.liberado_em IS NULL THEN now()
                                     ELSE public.motorista_cobranca.liberado_em END;
END;
$function$;

-- Corrige registros existentes incorretos (faturamento < diária e status travado)
UPDATE public.motorista_cobranca
   SET status = 'OK', atualizado_em = now()
 WHERE status IN ('Pendente','Aguardando','Bloqueado')
   AND faturamento_dia < valor_diaria;