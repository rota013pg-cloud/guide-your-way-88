
-- Fix 1: Restrict anon SELECT on corrida_ofertas to rows whose motorista matches
-- the active realtime topic token, preventing driver enumeration.
DROP POLICY IF EXISTS "anon le ofertas pendentes para realtime" ON public.corrida_ofertas;

CREATE POLICY "anon le ofertas do proprio motorista via realtime"
  ON public.corrida_ofertas
  FOR SELECT
  TO anon
  USING (
    status = 'pendente'
    AND EXISTS (
      SELECT 1
      FROM public.motorista_sessoes s
      WHERE s.status = 'ativa'
        AND s.motorista_codigo = corrida_ofertas.motorista_codigo
        AND s.token = regexp_replace(
              COALESCE(realtime.topic(), ''),
              '^(motorista|chat-nav|chat-tab)-',
              ''
            )
        AND COALESCE(realtime.topic(), '') ~ '^(motorista|chat-nav|chat-tab)-[a-f0-9]{64}$'
    )
  );

-- Fix 2: Tighten realtime.messages anon policy.
-- Enforce exact 64-hex token, and require the token to belong to the driver
-- whose code is embedded in chat topics. The token also IS the topic suffix
-- for motorista-<token>, so we accept that as long as it's a valid active token.
DROP POLICY IF EXISTS "motorista_anon_realtime" ON realtime.messages;
DROP POLICY IF EXISTS "motoristas anon realtime" ON realtime.messages;
DROP POLICY IF EXISTS "anon motorista realtime" ON realtime.messages;

CREATE POLICY "motorista anon realtime tópico estrito"
  ON realtime.messages
  FOR SELECT
  TO anon
  USING (
    COALESCE(realtime.topic(), '') ~ '^(motorista|chat-nav|chat-tab)-[a-f0-9]{64}$'
    AND public.is_motorista_token_ativo(
      regexp_replace(realtime.topic(), '^(motorista|chat-nav|chat-tab)-', '')
    )
  );
