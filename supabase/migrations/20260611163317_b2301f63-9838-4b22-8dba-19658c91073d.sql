
-- Tabela de ocorrências por pessoa (cliente ou motociclista)
CREATE TABLE public.ocorrencias_pessoa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('cliente','motorista')),
  pessoa_codigo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('elogio','reclamacao','ocorrencia','advertencia','observacao')),
  nivel SMALLINT NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 4),
  descricao TEXT NOT NULL,
  evidencia_url TEXT,
  corrida_id BIGINT REFERENCES public.corridas(id) ON DELETE SET NULL,
  operador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operador_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocorrencias_pessoa_lookup ON public.ocorrencias_pessoa (tipo_pessoa, pessoa_codigo, criado_em DESC);
CREATE INDEX idx_ocorrencias_pessoa_corrida ON public.ocorrencias_pessoa (corrida_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias_pessoa TO authenticated;
GRANT ALL ON public.ocorrencias_pessoa TO service_role;

ALTER TABLE public.ocorrencias_pessoa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operadores podem ver ocorrências"
  ON public.ocorrencias_pessoa FOR SELECT
  TO authenticated
  USING (public.is_operador(auth.uid()));

CREATE POLICY "Operadores podem inserir ocorrências"
  ON public.ocorrencias_pessoa FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operador(auth.uid()));

CREATE POLICY "Operadores podem atualizar ocorrências"
  ON public.ocorrencias_pessoa FOR UPDATE
  TO authenticated
  USING (public.is_operador(auth.uid()))
  WITH CHECK (public.is_operador(auth.uid()));

CREATE POLICY "Admins podem excluir ocorrências"
  ON public.ocorrencias_pessoa FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ocorrencias_pessoa_updated
  BEFORE UPDATE ON public.ocorrencias_pessoa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ocorrencias_pessoa;
ALTER TABLE public.ocorrencias_pessoa REPLICA IDENTITY FULL;

-- Campos novos em corridas
ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS passageiros JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS eta_coleta_segundos INTEGER,
  ADD COLUMN IF NOT EXISTS eta_coleta_atualizado_em TIMESTAMPTZ;
