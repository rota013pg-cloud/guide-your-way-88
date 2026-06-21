
-- 1) Cotação do cliente usando MESMA fonte de configuração do operador (tarifas.tabelaHibrida + valorParadaExtra)
CREATE OR REPLACE FUNCTION public.cliente_cotar(_distancia_km numeric, _qtd_paradas integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cfg jsonb;
  v_min numeric;
  v_km  numeric;
  v_parada numeric;
  v_valor numeric;
BEGIN
  SELECT config_json INTO v_cfg FROM public.app_config WHERE id = 1;
  v_min    := COALESCE((v_cfg #>> '{tarifas,tabelaHibrida,tarifaMinima}')::numeric, 30);
  v_km     := COALESCE((v_cfg #>> '{tarifas,tabelaHibrida,valorKm}')::numeric, 3.6);
  v_parada := COALESCE((v_cfg ->> 'valorParadaExtra')::numeric, 3);
  v_valor  := GREATEST(v_min, COALESCE(_distancia_km,0) * v_km) + COALESCE(_qtd_paradas,0) * v_parada;
  -- piso (zera centavos)
  v_valor  := floor(v_valor);
  RETURN jsonb_build_object('valor', v_valor, 'tarifa_minima', v_min, 'valor_km', v_km, 'valor_parada', v_parada);
END $$;

GRANT EXECUTE ON FUNCTION public.cliente_cotar(numeric, integer) TO anon, authenticated;

-- 2) Trigger: ao cancelar corrida, insere mensagem no chat do cliente (notificação visível via realtime já existente)
CREATE OR REPLACE FUNCTION public.trg_notificar_cancelamento_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'Cancelada'::status_corrida
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.cliente_codigo IS NOT NULL THEN
    INSERT INTO public.chat_cliente (cliente_codigo, autor, autor_nome, texto)
    VALUES (
      NEW.cliente_codigo,
      'central',
      'Central',
      'Sua corrida #' || NEW.id::text || ' foi cancelada. Caso precise, faça uma nova solicitação ou fale com a central.'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_corrida_cancelada_notifica ON public.corridas;
CREATE TRIGGER trg_corrida_cancelada_notifica
AFTER UPDATE OF status ON public.corridas
FOR EACH ROW
EXECUTE FUNCTION public.trg_notificar_cancelamento_cliente();
