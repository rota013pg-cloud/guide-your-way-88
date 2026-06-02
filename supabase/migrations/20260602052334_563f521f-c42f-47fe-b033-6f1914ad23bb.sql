
-- ═══════════════════════════════════════════════════════════
-- Cobrança automática da diária + chat motorista <-> operador
-- ═══════════════════════════════════════════════════════════

-- Tabela de cobranças (uma por motorista/dia operacional)
CREATE TABLE public.motorista_cobranca (
  id BIGSERIAL PRIMARY KEY,
  motorista_codigo TEXT NOT NULL,
  dia_op DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente', -- Pendente | Aguardando | Pago | Bloqueado
  faturamento_dia NUMERIC NOT NULL DEFAULT 0,
  valor_diaria NUMERIC NOT NULL DEFAULT 0,
  disparou_aviso_em TIMESTAMPTZ,
  disparou_bloqueio_em TIMESTAMPTZ,
  comprovante_enviado_em TIMESTAMPTZ,
  liberado_em TIMESTAMPTZ,
  liberado_por TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (motorista_codigo, dia_op)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorista_cobranca TO authenticated;
GRANT ALL ON public.motorista_cobranca TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.motorista_cobranca_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.motorista_cobranca_id_seq TO service_role;
GRANT SELECT ON public.motorista_cobranca TO anon; -- realtime + motorista app (sem auth supabase)

ALTER TABLE public.motorista_cobranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operadores acessam cobranca"
  ON public.motorista_cobranca FOR ALL TO authenticated
  USING (public.is_operador(auth.uid()))
  WITH CHECK (public.is_operador(auth.uid()));

CREATE POLICY "anon le cobranca para realtime"
  ON public.motorista_cobranca FOR SELECT TO anon
  USING (true);

CREATE TRIGGER trg_cobranca_updated
  BEFORE UPDATE ON public.motorista_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.motorista_cobranca REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.motorista_cobranca;

-- Chat motorista <-> operador
CREATE TABLE public.chat_motorista (
  id BIGSERIAL PRIMARY KEY,
  motorista_codigo TEXT NOT NULL,
  autor TEXT NOT NULL, -- 'motorista' | 'operador'
  autor_nome TEXT,
  texto TEXT NOT NULL,
  lido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_motorista TO authenticated;
GRANT ALL ON public.chat_motorista TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chat_motorista_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_motorista_id_seq TO service_role;
GRANT SELECT ON public.chat_motorista TO anon;

ALTER TABLE public.chat_motorista ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operadores acessam chat motorista"
  ON public.chat_motorista FOR ALL TO authenticated
  USING (public.is_operador(auth.uid()))
  WITH CHECK (public.is_operador(auth.uid()));

CREATE POLICY "anon le chat para realtime"
  ON public.chat_motorista FOR SELECT TO anon
  USING (true);

CREATE INDEX idx_chat_motorista_codigo ON public.chat_motorista(motorista_codigo, criado_em DESC);

ALTER TABLE public.chat_motorista REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_motorista;

-- ═══════════════════════════════════════════════════════════
-- Função: recomputa cobrança do motorista para o dia operacional
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.recomputa_cobranca_motorista(_codigo TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  v_dia := public.dia_operacional(now());
  -- janela de 6h BRT a 6h BRT
  v_inicio := ((v_dia::text || ' 06:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_fim    := v_inicio + INTERVAL '1 day';

  -- somar faturamento (corridas concluídas dentro do dia operacional)
  SELECT COALESCE(SUM(valor_final), 0) INTO v_faturamento
    FROM public.corridas
   WHERE motorista_codigo = _codigo
     AND status = 'Concluida'
     AND COALESCE(finalizada_em, atualizado_em) >= v_inicio
     AND COALESCE(finalizada_em, atualizado_em) <  v_fim;

  -- ler config (valorDiaria e percentualBloqueio)
  SELECT config_json INTO v_cfg FROM public.app_config WHERE id = 1;
  v_diaria  := COALESCE((v_cfg->>'valorDiaria')::numeric, 20);
  v_percent := COALESCE((v_cfg->>'percentualBloqueio')::numeric, 50);

  -- já pagou diária no dia?
  SELECT EXISTS (
    SELECT 1 FROM public.financeiro
     WHERE motorista_codigo = _codigo
       AND tipo = 'Diária'
       AND COALESCE(dia_op, public.dia_operacional(data)) = v_dia
  ) INTO v_pago;

  -- status atual (para preservar Aguardando/Bloqueado se ainda válido)
  SELECT status INTO v_atual_status
    FROM public.motorista_cobranca
   WHERE motorista_codigo = _codigo AND dia_op = v_dia;

  IF v_pago THEN
    v_status := 'Pago';
  ELSIF v_faturamento >= v_diaria * (1 + v_percent / 100.0) THEN
    v_status := 'Bloqueado';
  ELSIF v_faturamento >= v_diaria THEN
    -- atingiu valor: se já estava aguardando, mantém
    IF v_atual_status = 'Aguardando' THEN
      v_status := 'Aguardando';
    ELSE
      v_status := 'Pendente';
    END IF;
  ELSE
    IF v_atual_status = 'Aguardando' THEN
      v_status := 'Aguardando';
    ELSE
      v_status := 'Pendente';
    END IF;
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
$$;

-- Trigger: ao concluir corrida → recomputa
CREATE OR REPLACE FUNCTION public.trg_corrida_recomputa_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.motorista_codigo IS NOT NULL AND NEW.status = 'Concluida' THEN
    PERFORM public.recomputa_cobranca_motorista(NEW.motorista_codigo);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_corridas_cobranca
  AFTER INSERT OR UPDATE OF status, valor_final ON public.corridas
  FOR EACH ROW EXECUTE FUNCTION public.trg_corrida_recomputa_cobranca();

-- Trigger: ao inserir financeiro Diária → recomputa
CREATE OR REPLACE FUNCTION public.trg_financeiro_recomputa_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'Diária' AND NEW.motorista_codigo IS NOT NULL THEN
    -- garante dia_op preenchido
    IF NEW.dia_op IS NULL THEN
      UPDATE public.financeiro SET dia_op = public.dia_operacional(data) WHERE id = NEW.id;
    END IF;
    PERFORM public.recomputa_cobranca_motorista(NEW.motorista_codigo);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_financeiro_cobranca
  AFTER INSERT ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_recomputa_cobranca();
