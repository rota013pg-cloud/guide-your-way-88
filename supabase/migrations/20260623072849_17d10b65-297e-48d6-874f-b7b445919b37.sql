
-- 1) corrida_ofertas: column-level grants para anon (oculta motorista_codigo)
REVOKE SELECT ON public.corrida_ofertas FROM anon;
GRANT SELECT (id, corrida_id, status, criado_em) ON public.corrida_ofertas TO anon;

-- 2) Helper SECURITY DEFINER para validar token de sessão ativa (sem expor motorista_sessoes a anon)
CREATE OR REPLACE FUNCTION public.is_motorista_token_ativo(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.motorista_sessoes
    WHERE token = _token AND status = 'ativa'
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_motorista_token_ativo(text) TO anon, authenticated;

-- 3) Realtime: anon só pode assinar tópicos cujo sufixo seja um token de sessão ativo
DROP POLICY IF EXISTS "realtime acesso operadores e anon" ON realtime.messages;
CREATE POLICY "realtime acesso operadores e anon"
  ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (
    (
      (SELECT auth.role()) = 'anon'
      AND (
        realtime.topic() LIKE 'motorista-%'
        OR realtime.topic() LIKE 'chat-nav-%'
        OR realtime.topic() LIKE 'chat-tab-%'
      )
      AND public.is_motorista_token_ativo(
        regexp_replace(realtime.topic(), '^(motorista|chat-nav|chat-tab)-', '')
      )
    )
    OR public.is_operador((SELECT auth.uid()))
  );
