-- Permitir que o app do motorista (não autenticado via Supabase Auth)
-- receba eventos Realtime de corrida_ofertas. Sem PII na tabela.
GRANT SELECT ON public.corrida_ofertas TO anon;
CREATE POLICY "anon le ofertas para realtime"
  ON public.corrida_ofertas FOR SELECT
  TO anon
  USING (true);

-- Mesmo motivo para corridas (UPDATE event para finalizar oferta no app).
-- O app só usa o evento; os dados sensíveis vêm pelo server function admin.
GRANT SELECT ON public.corridas TO anon;
CREATE POLICY "anon le corridas para realtime"
  ON public.corridas FOR SELECT
  TO anon
  USING (true);