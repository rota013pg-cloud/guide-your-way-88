
-- Novos valores para status_corrida
ALTER TYPE status_corrida ADD VALUE IF NOT EXISTS 'Agendada';
ALTER TYPE status_corrida ADD VALUE IF NOT EXISTS 'Parada';

-- Enums novos
DO $$ BEGIN
  CREATE TYPE modelo_corrida AS ENUM ('Imediata','Agendada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE despacho_corrida AS ENUM ('Automatico','Manual','WhatsApp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colunas em corridas
ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS modelo modelo_corrida NOT NULL DEFAULT 'Imediata',
  ADD COLUMN IF NOT EXISTS agendada_para timestamptz,
  ADD COLUMN IF NOT EXISTS despacho despacho_corrida NOT NULL DEFAULT 'Automatico',
  ADD COLUMN IF NOT EXISTS paradas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_paradas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motoristas_manuais text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rodada_atual int NOT NULL DEFAULT 1;

-- Tabela de log de status
CREATE TABLE IF NOT EXISTS public.corrida_status_log (
  id bigserial PRIMARY KEY,
  corrida_id bigint NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
  status text NOT NULL,
  motorista_codigo text,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrida_status_log_corrida ON public.corrida_status_log(corrida_id, criado_em);

GRANT SELECT, INSERT ON public.corrida_status_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.corrida_status_log_id_seq TO authenticated;
GRANT ALL ON public.corrida_status_log TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.corrida_status_log_id_seq TO service_role;
GRANT SELECT ON public.corrida_status_log TO anon;

ALTER TABLE public.corrida_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operadores leem log corrida"
  ON public.corrida_status_log FOR SELECT
  TO authenticated
  USING (is_operador(auth.uid()));

CREATE POLICY "operadores inserem log corrida"
  ON public.corrida_status_log FOR INSERT
  TO authenticated
  WITH CHECK (is_operador(auth.uid()));

CREATE POLICY "anon le log para realtime"
  ON public.corrida_status_log FOR SELECT
  TO anon
  USING (true);
