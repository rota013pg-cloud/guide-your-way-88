
ALTER TABLE public.motorista_cobranca
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS comprovante_rejeitado_em timestamptz,
  ADD COLUMN IF NOT EXISTS comprovante_rejeicao_motivo text;
