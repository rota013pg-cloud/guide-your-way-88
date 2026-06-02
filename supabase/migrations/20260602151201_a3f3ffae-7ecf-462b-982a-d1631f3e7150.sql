ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS pausado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pausado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pausado_motivo text;

CREATE INDEX IF NOT EXISTS idx_motoristas_pausado ON public.motoristas(pausado) WHERE pausado = true;