
-- Listar motoristas online (com GPS recente) - para o mapa do app do cliente
CREATE OR REPLACE FUNCTION public.cliente_motoristas_online()
RETURNS TABLE(codigo text, nome text, lat numeric, lng numeric, status text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (m.codigo)
    m.codigo, m.nome, g.lat, g.lng,
    CASE WHEN m.status::text = 'Online' THEN 'Online' ELSE m.status::text END
  FROM public.motoristas m
  JOIN public.motorista_gps g ON g.motorista_codigo = m.codigo
  WHERE m.status::text IN ('Online','Em corrida')
    AND g.criado_em > now() - interval '3 minutes'
  ORDER BY m.codigo, g.criado_em DESC
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.cliente_motoristas_online() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_motoristas_online() TO anon, authenticated;

-- Solicitar corrida pelo app do cliente
CREATE OR REPLACE FUNCTION public.cliente_solicitar_corrida(
  _token TEXT,
  _origem TEXT, _origem_lat NUMERIC, _origem_lng NUMERIC,
  _destino TEXT, _destino_lat NUMERIC, _destino_lng NUMERIC,
  _paradas JSONB,
  _distancia_km NUMERIC,
  _valor NUMERIC,
  _observacoes TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cod TEXT;
  v_cliente RECORD;
  v_id BIGINT;
BEGIN
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;

  SELECT codigo, nome, telefone INTO v_cliente FROM public.clientes WHERE codigo = v_cod;

  INSERT INTO public.corridas (
    cliente_codigo, cliente, telefone_cliente,
    origem, destino, origem_lat, origem_lng, destino_lat, destino_lng,
    tipo, distancia_km, valor_final, paradas,
    status, observacoes, criado_em
  ) VALUES (
    v_cliente.codigo, v_cliente.nome, v_cliente.telefone,
    _origem, _destino, _origem_lat, _origem_lng, _destino_lat, _destino_lng,
    'moto', _distancia_km, _valor, COALESCE(_paradas, '[]'::jsonb),
    'pendente'::status_corrida, _observacoes, now()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'corrida_id', v_id);
END $$;
REVOKE ALL ON FUNCTION public.cliente_solicitar_corrida(TEXT,TEXT,NUMERIC,NUMERIC,TEXT,NUMERIC,NUMERIC,JSONB,NUMERIC,NUMERIC,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_solicitar_corrida(TEXT,TEXT,NUMERIC,NUMERIC,TEXT,NUMERIC,NUMERIC,JSONB,NUMERIC,NUMERIC,TEXT) TO anon, authenticated;
