-- 1) Revogar EXECUTE público das funções SECURITY DEFINER que não devem ser
--    chamáveis via Data API. Triggers/RPCs internos rodam como service_role
--    ou via gatilho, não precisam estar expostos para anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_lancamento_cobranca()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_financeiro_recomputa_cobranca() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_corrida_recomputa_cobranca()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recomputa_cobranca_motorista(text)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proximo_codigo_motorista()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proximo_codigo_cliente()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preview_proximo_codigo_motorista()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preview_proximo_codigo_cliente()    FROM PUBLIC, anon, authenticated;

-- Garante que has_role e is_operador continuem disponíveis para uso nas
-- políticas RLS (executadas como o usuário autenticado).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_operador(uuid)               TO authenticated;

-- 2) Realtime: impedir que qualquer usuário autenticado (ex.: conta nova,
--    credencial vazada) assine canais de operação. O app do motorista
--    consome realtime via cliente anon (não há auth de motorista no Supabase),
--    então mantemos anon permitido — quem é bloqueado é o "authenticated
--    não-operador".
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime acesso operadores e anon" ON realtime.messages;
CREATE POLICY "realtime acesso operadores e anon"
  ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (
    (SELECT auth.role()) = 'anon'
    OR public.is_operador((SELECT auth.uid()))
  );
