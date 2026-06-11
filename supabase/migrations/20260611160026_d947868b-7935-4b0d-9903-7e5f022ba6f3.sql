
CREATE TYPE public.tipo_alerta_motorista AS ENUM ('panico', 'suspeito');

CREATE TABLE public.motorista_alertas (
  id BIGSERIAL PRIMARY KEY,
  motorista_codigo TEXT NOT NULL,
  tipo public.tipo_alerta_motorista NOT NULL,
  corrida_id BIGINT REFERENCES public.corridas(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atendido_em TIMESTAMPTZ,
  atendido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  atendido_observacao TEXT
);

CREATE INDEX idx_motorista_alertas_aberto ON public.motorista_alertas (criado_em DESC) WHERE atendido_em IS NULL;
CREATE INDEX idx_motorista_alertas_motorista ON public.motorista_alertas (motorista_codigo, criado_em DESC);

GRANT SELECT ON public.motorista_alertas TO anon;
GRANT SELECT, INSERT, UPDATE ON public.motorista_alertas TO authenticated;
GRANT ALL ON public.motorista_alertas TO service_role;

ALTER TABLE public.motorista_alertas ENABLE ROW LEVEL SECURITY;

-- Operadores autenticados podem ver e atualizar (marcar atendido)
CREATE POLICY "operadores leem alertas" ON public.motorista_alertas
  FOR SELECT TO authenticated USING (public.is_operador(auth.uid()));

CREATE POLICY "operadores atualizam alertas" ON public.motorista_alertas
  FOR UPDATE TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- anon leitura para realtime (segue padrão das outras tabelas do motorista)
CREATE POLICY "anon leitura realtime" ON public.motorista_alertas
  FOR SELECT TO anon USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.motorista_alertas;
