
-- ===== Tabela chat_cliente =====
CREATE TABLE IF NOT EXISTS public.chat_cliente (
  id BIGSERIAL PRIMARY KEY,
  cliente_codigo TEXT NOT NULL REFERENCES public.clientes(codigo) ON DELETE CASCADE,
  autor TEXT NOT NULL CHECK (autor IN ('cliente','central')),
  autor_nome TEXT,
  texto TEXT NOT NULL,
  lido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_cliente_codigo_criado
  ON public.chat_cliente(cliente_codigo, criado_em DESC);

GRANT SELECT, INSERT, UPDATE ON public.chat_cliente TO authenticated;
GRANT SELECT ON public.chat_cliente TO anon;  -- necessário para realtime do cliente (token custom)
GRANT USAGE ON SEQUENCE public.chat_cliente_id_seq TO authenticated, anon;
GRANT ALL ON public.chat_cliente TO service_role;

ALTER TABLE public.chat_cliente ENABLE ROW LEVEL SECURITY;

-- Operadores autenticados gerenciam tudo
CREATE POLICY "Operadores gerenciam chat_cliente"
  ON public.chat_cliente FOR ALL
  TO authenticated
  USING (public.is_operador(auth.uid()))
  WITH CHECK (public.is_operador(auth.uid()));

-- Anon pode ler (necessário para realtime entregar eventos); proteção real é via RPCs com token
CREATE POLICY "Realtime anon read chat_cliente"
  ON public.chat_cliente FOR SELECT
  TO anon
  USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_cliente;

-- ===== RPCs do cliente =====

CREATE OR REPLACE FUNCTION public.cliente_enviar_mensagem(_token TEXT, _texto TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cod TEXT; v_nome TEXT; v_id BIGINT;
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

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;
REVOKE ALL ON FUNCTION public.cliente_enviar_mensagem(TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_enviar_mensagem(TEXT,TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cliente_listar_mensagens(_token TEXT)
RETURNS SETOF public.chat_cliente
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cod TEXT;
BEGIN
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;

  -- marca como lidas as mensagens da central
  UPDATE public.chat_cliente SET lido = true
   WHERE cliente_codigo = v_cod AND autor = 'central' AND lido = false;

  RETURN QUERY SELECT * FROM public.chat_cliente
   WHERE cliente_codigo = v_cod
   ORDER BY criado_em ASC
   LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.cliente_listar_mensagens(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_listar_mensagens(TEXT) TO anon, authenticated;

-- ===== Config WhatsApp da central =====
-- Garante chave whatsapp_central em app_config (não sobrescreve se já existir)
UPDATE public.app_config
   SET config_json = config_json || jsonb_build_object('whatsappCentral', '5513900000000')
 WHERE id = 1 AND NOT (config_json ? 'whatsappCentral');
