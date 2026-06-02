ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS creditos_diaria integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_motoristas_creditos ON public.motoristas(creditos_diaria) WHERE creditos_diaria > 0;