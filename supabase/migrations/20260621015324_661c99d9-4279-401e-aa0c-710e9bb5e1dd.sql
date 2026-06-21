
-- 1) Realtime: restringir anon apenas aos tópicos usados pelo app do motorista
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
    )
    OR public.is_operador((SELECT auth.uid()))
  );

-- 2) corrida_ofertas: anon só vê ofertas pendentes
DROP POLICY IF EXISTS "anon le ofertas para realtime" ON public.corrida_ofertas;
CREATE POLICY "anon le ofertas pendentes para realtime"
  ON public.corrida_ofertas FOR SELECT
  TO anon
  USING (status = 'pendente');
