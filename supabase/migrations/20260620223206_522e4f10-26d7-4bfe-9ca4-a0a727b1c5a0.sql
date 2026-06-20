
-- Helper: lê flag modoAutomatico
CREATE OR REPLACE FUNCTION public.eh_modo_automatico()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((config_json->>'modoAutomatico')::boolean, false)
  FROM public.app_config WHERE id = 1
$$;

-- Atualiza cliente_solicitar_corrida: auto-aceite se modo automático e dados completos
CREATE OR REPLACE FUNCTION public.cliente_solicitar_corrida(
  _token text, _origem text, _origem_lat numeric, _origem_lng numeric,
  _destino text, _destino_lat numeric, _destino_lng numeric,
  _paradas jsonb, _distancia_km numeric, _valor numeric, _observacoes text,
  _solicitacoes_especiais text[] DEFAULT '{}'::text[]
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

  -- Em modo automático com dados completos, NÃO trava na fila do operador
  v_aguardando := NOT (v_auto AND v_dados_completos);

  INSERT INTO public.corridas (
    cliente_codigo, cliente, telefone_cliente,
    origem, destino, origem_lat, origem_lng, destino_lat, destino_lng,
    tipo, distancia_km, valor_final, paradas,
    status, observacoes, solicitacoes_especiais,
    aguardando_registro, criado_em
  ) VALUES (
    v_cliente.codigo, v_cliente.nome, v_cliente.telefone,
    _origem, _destino, _origem_lat, _origem_lng, _destino_lat, _destino_lng,
    'Comum', _distancia_km, _valor, COALESCE(_paradas, '[]'::jsonb),
    'Pendente'::status_corrida, _observacoes,
    COALESCE(_solicitacoes_especiais, '{}'::text[]),
    v_aguardando, now()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'corrida_id', v_id, 'modo_automatico', v_auto, 'auto_aceita', NOT v_aguardando);
END $$;

-- Atualiza cliente_enviar_mensagem: resposta automática quando em modo automático
CREATE OR REPLACE FUNCTION public.cliente_enviar_mensagem(_token text, _texto text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cod TEXT; v_nome TEXT; v_id BIGINT;
  v_auto BOOLEAN := public.eh_modo_automatico();
  v_ja_avisou BOOLEAN := false;
BEGIN
  IF _texto IS NULL OR length(trim(_texto)) = 0 THEN
    RAISE EXCEPTION 'Mensagem vazia' USING ERRCODE='check_violation';
  END IF;
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;
  SELECT nome INTO v_nome FROM public.clientes WHERE codigo = v_cod;

  INSERT INTO public.chat_cliente (cliente_codigo, autor, autor_nome, texto)
  VALUES (v_cod, 'cliente', v_nome, trim(_texto))
  RETURNING id INTO v_id;

  IF v_auto THEN
    -- Evita spam: só responde se a última msg da central nas últimas 2h não foi a auto-resposta
    SELECT EXISTS (
      SELECT 1 FROM public.chat_cliente
       WHERE cliente_codigo = v_cod
         AND autor = 'central'
         AND autor_nome = 'Sistema'
         AND criado_em > now() - interval '2 hours'
    ) INTO v_ja_avisou;

    IF NOT v_ja_avisou THEN
      INSERT INTO public.chat_cliente (cliente_codigo, autor, autor_nome, texto)
      VALUES (v_cod, 'central', 'Sistema',
        'No momento, o sistema está operando em modo automático. Em breve, um operador entrará em contato.');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'modo_automatico', v_auto);
END $$;
