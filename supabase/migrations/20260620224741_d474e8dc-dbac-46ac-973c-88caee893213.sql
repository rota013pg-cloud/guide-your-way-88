
DROP FUNCTION IF EXISTS public.cliente_solicitar_corrida(TEXT,TEXT,NUMERIC,NUMERIC,TEXT,NUMERIC,NUMERIC,JSONB,NUMERIC,NUMERIC,TEXT,TEXT[]);

CREATE OR REPLACE FUNCTION public.cliente_solicitar_corrida(
  _token text, _origem text, _origem_lat numeric, _origem_lng numeric,
  _destino text, _destino_lat numeric, _destino_lng numeric,
  _paradas jsonb, _distancia_km numeric, _valor numeric, _observacoes text,
  _solicitacoes_especiais text[] DEFAULT '{}'::text[],
  _forma_pagamento text DEFAULT 'Pix'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cod TEXT;
  v_cliente RECORD;
  v_id BIGINT;
  v_auto BOOLEAN := public.eh_modo_automatico();
  v_dados_completos BOOLEAN;
  v_aguardando BOOLEAN;
  v_pag tipo_pagamento;
BEGIN
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;

  SELECT codigo, nome, telefone INTO v_cliente FROM public.clientes WHERE codigo = v_cod;

  v_dados_completos :=
    _origem IS NOT NULL AND length(trim(_origem)) > 0
    AND _origem_lat IS NOT NULL AND _origem_lng IS NOT NULL
    AND _destino IS NOT NULL AND length(trim(_destino)) > 0
    AND _destino_lat IS NOT NULL AND _destino_lng IS NOT NULL
    AND _valor IS NOT NULL AND _valor > 0;

  v_aguardando := NOT (v_auto AND v_dados_completos);

  BEGIN
    v_pag := COALESCE(_forma_pagamento, 'Pix')::tipo_pagamento;
  EXCEPTION WHEN others THEN
    v_pag := 'Pix'::tipo_pagamento;
  END;

  INSERT INTO public.corridas (
    cliente_codigo, cliente, telefone_cliente,
    origem, destino, origem_lat, origem_lng, destino_lat, destino_lng,
    tipo, distancia_km, valor_final, paradas,
    status, observacoes, solicitacoes_especiais,
    pagamento, aguardando_registro, criado_em
  ) VALUES (
    v_cliente.codigo, v_cliente.nome, v_cliente.telefone,
    _origem, _destino, _origem_lat, _origem_lng, _destino_lat, _destino_lng,
    'Comum', _distancia_km, _valor, COALESCE(_paradas, '[]'::jsonb),
    'Pendente'::status_corrida, _observacoes,
    COALESCE(_solicitacoes_especiais, '{}'::text[]),
    v_pag, v_aguardando, now()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'corrida_id', v_id, 'modo_automatico', v_auto, 'auto_aceita', NOT v_aguardando);
END $$;

REVOKE ALL ON FUNCTION public.cliente_solicitar_corrida(TEXT,TEXT,NUMERIC,NUMERIC,TEXT,NUMERIC,NUMERIC,JSONB,NUMERIC,NUMERIC,TEXT,TEXT[],TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_solicitar_corrida(TEXT,TEXT,NUMERIC,NUMERIC,TEXT,NUMERIC,NUMERIC,JSONB,NUMERIC,NUMERIC,TEXT,TEXT[],TEXT) TO anon, authenticated;
