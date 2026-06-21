-- Restringe a policy anon de corridas usada para Realtime a apenas corridas em estado ativo,
-- evitando expor PII de corridas finalizadas/canceladas para clientes não autenticados.
DROP POLICY IF EXISTS "anon le corridas para realtime" ON public.corridas;

CREATE POLICY "anon le corridas ativas para realtime"
ON public.corridas
FOR SELECT
TO anon
USING (
  status IN (
    'Pendente'::status_corrida,
    'Ofertada'::status_corrida,
    'Aceita'::status_corrida,
    'A caminho'::status_corrida,
    'Chegou'::status_corrida,
    'Em viagem'::status_corrida,
    'Parada'::status_corrida,
    'Agendada'::status_corrida
  )
);