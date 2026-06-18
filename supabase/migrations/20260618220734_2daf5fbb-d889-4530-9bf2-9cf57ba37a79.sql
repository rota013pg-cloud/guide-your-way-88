
-- RPC: atualizar dados do cliente (autenticado por token)
CREATE OR REPLACE FUNCTION public.cliente_atualizar_dados(
  _token TEXT,
  _telefone TEXT,
  _email TEXT,
  _logradouro TEXT,
  _numero TEXT,
  _bairro TEXT,
  _cidade TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cod TEXT;
BEGIN
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;

  UPDATE public.clientes SET
    telefone = COALESCE(NULLIF(trim(_telefone),''), telefone),
    email = COALESCE(NULLIF(lower(trim(_email)),''), email),
    endereco_logradouro = NULLIF(trim(_logradouro),''),
    endereco_numero = NULLIF(trim(_numero),''),
    endereco_bairro = NULLIF(trim(_bairro),''),
    endereco_cidade = NULLIF(trim(_cidade),''),
    endereco = trim(concat_ws(', ', NULLIF(trim(_logradouro),''), NULLIF(trim(_numero),''), NULLIF(trim(_bairro),''))),
    cidade = COALESCE(NULLIF(trim(_cidade),''), cidade),
    atualizado_em = now()
  WHERE codigo = v_cod;

  -- sincroniza email no cliente_auth se mudou
  IF _email IS NOT NULL AND length(trim(_email))>0 THEN
    UPDATE public.cliente_auth SET email_lower = lower(trim(_email)) WHERE cliente_codigo = v_cod;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.cliente_atualizar_dados(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_atualizar_dados(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;

-- RPC: alterar senha (precisa da senha atual)
CREATE OR REPLACE FUNCTION public.cliente_alterar_senha(
  _token TEXT, _senha_atual TEXT, _nova_senha TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cod TEXT; v_auth RECORD;
BEGIN
  IF _nova_senha IS NULL OR length(_nova_senha) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 8 caracteres' USING ERRCODE='check_violation';
  END IF;
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;

  SELECT * INTO v_auth FROM public.cliente_auth WHERE cliente_codigo = v_cod;
  IF v_auth.senha_hash IS NULL OR v_auth.senha_hash <> crypt(_senha_atual, v_auth.senha_hash) THEN
    RAISE EXCEPTION 'Senha atual incorreta' USING ERRCODE='invalid_password';
  END IF;

  UPDATE public.cliente_auth
     SET senha_hash = crypt(_nova_senha, gen_salt('bf', 10)),
         atualizado_em = now()
   WHERE cliente_codigo = v_cod;

  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.cliente_alterar_senha(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_alterar_senha(TEXT,TEXT,TEXT) TO anon, authenticated;

-- RPC: listar corridas do cliente logado
CREATE OR REPLACE FUNCTION public.cliente_listar_corridas(_token TEXT)
RETURNS SETOF public.corridas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cod TEXT;
BEGIN
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;
  RETURN QUERY SELECT * FROM public.corridas
   WHERE cliente_codigo = v_cod
   ORDER BY criado_em DESC
   LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.cliente_listar_corridas(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_listar_corridas(TEXT) TO anon, authenticated;
