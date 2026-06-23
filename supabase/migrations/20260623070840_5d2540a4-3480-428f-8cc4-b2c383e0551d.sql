
DROP POLICY IF EXISTS "anon le chat para realtime" ON public.chat_motorista;
DROP POLICY IF EXISTS "anon le cobranca para realtime" ON public.motorista_cobranca;
REVOKE SELECT ON public.chat_motorista FROM anon;
REVOKE SELECT ON public.motorista_cobranca FROM anon;
