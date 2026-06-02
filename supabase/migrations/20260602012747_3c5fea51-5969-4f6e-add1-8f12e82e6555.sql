
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.corridas; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.corrida_ofertas; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.corridas REPLICA IDENTITY FULL;
ALTER TABLE public.corrida_ofertas REPLICA IDENTITY FULL;
ALTER TABLE public.motoristas REPLICA IDENTITY FULL;

INSERT INTO public.motorista_auth (motorista_codigo, senha_hash, senha_plain, status)
SELECT m.codigo,
       encode(digest(lower(m.codigo) || 'rota013salt', 'sha256'), 'hex'),
       lower(m.codigo),
       'Ativo'::status_motorista_auth
FROM public.motoristas m
LEFT JOIN public.motorista_auth a ON a.motorista_codigo = m.codigo
WHERE a.motorista_codigo IS NULL;
