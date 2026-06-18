DROP POLICY IF EXISTS "Realtime anon read chat_cliente" ON public.chat_cliente;
DROP POLICY IF EXISTS "anon leitura realtime" ON public.motorista_alertas;
REVOKE SELECT ON public.chat_cliente FROM anon;
REVOKE SELECT ON public.motorista_alertas FROM anon;