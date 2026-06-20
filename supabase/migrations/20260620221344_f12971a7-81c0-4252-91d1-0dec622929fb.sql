DROP POLICY IF EXISTS "anon le lancamentos cobranca realtime" ON public.motorista_cobranca_lancamentos;
DROP POLICY IF EXISTS "anon le cobrancas extras realtime" ON public.motorista_cobrancas_extras;
REVOKE SELECT ON public.motorista_cobranca_lancamentos FROM anon;
REVOKE SELECT ON public.motorista_cobrancas_extras FROM anon;