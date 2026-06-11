
-- Fase 4: EAR, vistoria, critérios de prioridade e solicitações especiais

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS ear BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vistoria_status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS vistoria_em DATE,
  ADD COLUMN IF NOT EXISTS prioridade_criterios JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.motoristas
  DROP CONSTRAINT IF EXISTS motoristas_vistoria_status_check;
ALTER TABLE public.motoristas
  ADD CONSTRAINT motoristas_vistoria_status_check
  CHECK (vistoria_status IN ('pendente','aprovada','reprovada','vencida'));

ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS solicitacoes_especiais TEXT[] NOT NULL DEFAULT '{}'::text[];
