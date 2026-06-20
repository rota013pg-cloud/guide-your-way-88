
DROP POLICY IF EXISTS "anon le corrida status log realtime" ON public.corrida_status_log;
DROP POLICY IF EXISTS "anon le status log realtime" ON public.corrida_status_log;
DROP POLICY IF EXISTS "Anon pode ler status log" ON public.corrida_status_log;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='corrida_status_log'
      AND 'anon' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.corrida_status_log', r.policyname);
  END LOOP;
END $$;

REVOKE SELECT ON public.corrida_status_log FROM anon;
