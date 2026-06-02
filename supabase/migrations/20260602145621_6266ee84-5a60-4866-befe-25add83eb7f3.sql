
-- ═══════════════════════════════════════════════════════════
-- COBRANÇAS EXTRAS DO MOTORISTA (camiseta, itens, manutenção)
-- ═══════════════════════════════════════════════════════════

CREATE TYPE public.categoria_cobranca_extra AS ENUM (
  'uniforme',
  'itens_cliente',
  'manutencao',
  'equipamento',
  'multa',
  'adiantamento',
  'outros'
);

CREATE TYPE public.forma_cobranca_extra AS ENUM (
  'por_dia',
  'parcela_fixa',
  'avulsa'
);

CREATE TYPE public.status_cobranca_extra AS ENUM (
  'aberta',
  'quitada',
  'cancelada'
);

-- ─── ITEM DE COBRANÇA (a "dívida") ─────────────────────────
CREATE TABLE public.motorista_cobrancas_extras (
  id              BIGSERIAL PRIMARY KEY,
  motorista_codigo TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  categoria       public.categoria_cobranca_extra NOT NULL DEFAULT 'outros',
  forma_cobranca  public.forma_cobranca_extra NOT NULL DEFAULT 'por_dia',
  valor_total     NUMERIC(10,2) NOT NULL CHECK (valor_total > 0),
  valor_parcela_dia NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_parcela_dia >= 0),
  status          public.status_cobranca_extra NOT NULL DEFAULT 'aberta',
  observacoes     TEXT,
  operador        TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  quitada_em      TIMESTAMPTZ
);

CREATE INDEX idx_cobextras_motorista ON public.motorista_cobrancas_extras(motorista_codigo, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorista_cobrancas_extras TO authenticated;
GRANT ALL ON public.motorista_cobrancas_extras TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.motorista_cobrancas_extras_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.motorista_cobrancas_extras_id_seq TO service_role;

ALTER TABLE public.motorista_cobrancas_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operadores acessam cobrancas extras"
  ON public.motorista_cobrancas_extras
  FOR ALL
  TO authenticated
  USING (is_operador(auth.uid()))
  WITH CHECK (is_operador(auth.uid()));

-- Anon pode ler pro realtime do app motorista (RLS na sessão filtra no client)
CREATE POLICY "anon le cobrancas extras realtime"
  ON public.motorista_cobrancas_extras
  FOR SELECT
  TO anon
  USING (true);

CREATE TRIGGER trg_cobextras_updated
  BEFORE UPDATE ON public.motorista_cobrancas_extras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── LANÇAMENTOS (pagamentos parciais — o "extrato") ───────
CREATE TABLE public.motorista_cobranca_lancamentos (
  id              BIGSERIAL PRIMARY KEY,
  cobranca_id     BIGINT NOT NULL REFERENCES public.motorista_cobrancas_extras(id) ON DELETE CASCADE,
  motorista_codigo TEXT NOT NULL,
  valor           NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  dia_op          DATE,
  operador        TEXT,
  observacoes     TEXT,
  financeiro_id   BIGINT
);

CREATE INDEX idx_coblanc_cobranca ON public.motorista_cobranca_lancamentos(cobranca_id);
CREATE INDEX idx_coblanc_motorista ON public.motorista_cobranca_lancamentos(motorista_codigo, dia_op);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorista_cobranca_lancamentos TO authenticated;
GRANT ALL ON public.motorista_cobranca_lancamentos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.motorista_cobranca_lancamentos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.motorista_cobranca_lancamentos_id_seq TO service_role;

ALTER TABLE public.motorista_cobranca_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operadores acessam lancamentos cobranca"
  ON public.motorista_cobranca_lancamentos
  FOR ALL
  TO authenticated
  USING (is_operador(auth.uid()))
  WITH CHECK (is_operador(auth.uid()));

CREATE POLICY "anon le lancamentos cobranca realtime"
  ON public.motorista_cobranca_lancamentos
  FOR SELECT
  TO anon
  USING (true);

-- Trigger: ao inserir/remover lançamento, preencher dia_op e atualizar status da cobrança
CREATE OR REPLACE FUNCTION public.trg_lancamento_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_pago  NUMERIC;
  v_cobranca_id BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.dia_op IS NULL THEN
      NEW.dia_op := public.dia_operacional(NEW.data);
    END IF;
    v_cobranca_id := NEW.cobranca_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_cobranca_id := OLD.cobranca_id;
  END IF;

  -- Recalcula total pago e atualiza status
  IF TG_OP IN ('INSERT','DELETE') THEN
    SELECT valor_total INTO v_total FROM public.motorista_cobrancas_extras WHERE id = v_cobranca_id;
    SELECT COALESCE(SUM(valor),0) INTO v_pago FROM public.motorista_cobranca_lancamentos WHERE cobranca_id = v_cobranca_id;

    UPDATE public.motorista_cobrancas_extras
      SET status = CASE WHEN v_pago >= v_total THEN 'quitada'::public.status_cobranca_extra
                        ELSE 'aberta'::public.status_cobranca_extra END,
          quitada_em = CASE WHEN v_pago >= v_total THEN now() ELSE NULL END,
          atualizado_em = now()
    WHERE id = v_cobranca_id AND status <> 'cancelada';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

CREATE TRIGGER trg_lancamento_cobranca_ins
  BEFORE INSERT ON public.motorista_cobranca_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_lancamento_cobranca();

CREATE TRIGGER trg_lancamento_cobranca_aft
  AFTER INSERT OR DELETE ON public.motorista_cobranca_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_lancamento_cobranca();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.motorista_cobrancas_extras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.motorista_cobranca_lancamentos;
