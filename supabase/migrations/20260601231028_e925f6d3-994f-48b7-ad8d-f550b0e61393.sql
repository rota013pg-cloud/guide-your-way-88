-- Seed de posições GPS para os motoristas (Baixada Santista)
INSERT INTO public.motorista_gps (motorista_codigo, lat, lng, velocidade, criado_em)
SELECT m.codigo,
       -23.9608 + (random() - 0.5) * 0.04,
       -46.3331 + (random() - 0.5) * 0.05,
       (random() * 40)::numeric,
       now() - (random() * interval '5 minutes')
FROM public.motoristas m
WHERE m.status IN ('Online','Em corrida');

-- Garante que pelo menos alguns motoristas estejam Online para aparecer no mapa
UPDATE public.motoristas SET status = 'Online'
WHERE codigo IN (SELECT codigo FROM public.motoristas ORDER BY codigo LIMIT 3)
  AND status = 'Offline';

-- Insere GPS para esses recém-online também (caso não tivessem)
INSERT INTO public.motorista_gps (motorista_codigo, lat, lng, velocidade, criado_em)
SELECT m.codigo,
       -23.9608 + (random() - 0.5) * 0.04,
       -46.3331 + (random() - 0.5) * 0.05,
       0,
       now()
FROM public.motoristas m
WHERE m.status = 'Online'
  AND NOT EXISTS (SELECT 1 FROM public.motorista_gps g WHERE g.motorista_codigo = m.codigo);