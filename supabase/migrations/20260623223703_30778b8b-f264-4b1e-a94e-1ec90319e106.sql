CREATE OR REPLACE FUNCTION public.cliente_cadastrar(
  _nome TEXT,
  _email TEXT,
  _senha TEXT,
  _telefone TEXT,
  _cpf TEXT,
  _logradouro TEXT,
  _numero TEXT,
  _bairro TEXT,
  _cidade TEXT,
  _termos_versao TEXT,
  _ip TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _indicacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo TEXT;
  v_email_lower TEXT := lower(trim(_email));
  v_token TEXT;
  v_indicacao TEXT := NULLIF(trim(COALESCE(_indicacao,'')), '');
BEGIN
  IF _nome IS NULL OR length(trim(_nome)) < 3 THEN
    RAISE EXCEPTION 'Nome inválido' USING ERRCODE = 'check_violation';
  END IF;
  IF v_email_lower !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = 'check_violation';
  END IF;
  IF _senha IS NULL OR length(_senha) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 8 caracteres' USING ERRCODE = 'check_violation';
  END IF;
  IF _cpf IS NULL OR length(regexp_replace(_cpf, '\D', '', 'g')) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido' USING ERRCODE = 'check_violation';
  END IF;
  IF _termos_versao IS NULL THEN
    RAISE EXCEPTION 'Aceite dos Termos é obrigatório' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.cliente_auth WHERE email_lower = v_email_lower) THEN
    RAISE EXCEPTION 'E-mail já cadastrado' USING ERRCODE = 'unique_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clientes WHERE cpf = regexp_replace(_cpf, '\D', '', 'g')) THEN
    RAISE EXCEPTION 'CPF já cadastrado' USING ERRCODE = 'unique_violation';
  END IF;

  -- Validar código de indicação se enviado: deve existir motorista com esse código
  IF v_indicacao IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.motoristas WHERE codigo = v_indicacao) THEN
      v_indicacao := NULL;
    END IF;
  END IF;

  v_codigo := public.proximo_codigo_cliente();

  INSERT INTO public.clientes (
    codigo, nome, telefone, email, cpf,
    endereco, cidade,
    endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade,
    termos_aceitos_em, termos_versao, indicacao
  ) VALUES (
    v_codigo,
    upper(trim(_nome)),
    regexp_replace(COALESCE(_telefone,''), '\D', '', 'g'),
    v_email_lower,
    regexp_replace(_cpf, '\D', '', 'g'),
    trim(COALESCE(_logradouro,'') || CASE WHEN _numero IS NOT NULL AND _numero <> '' THEN ', ' || _numero ELSE '' END
      || CASE WHEN _bairro IS NOT NULL AND _bairro <> '' THEN ' - ' || _bairro ELSE '' END),
    COALESCE(_cidade, 'Praia Grande'),
    _logradouro, _numero, _bairro, _cidade,
    now(), _termos_versao, v_indicacao
  );

  INSERT INTO public.cliente_auth (cliente_codigo, email_lower, senha_hash)
  VALUES (v_codigo, v_email_lower, crypt(_senha, gen_salt('bf', 10)));

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.cliente_sessoes (cliente_codigo, token, ip, user_agent)
  VALUES (v_codigo, v_token, _ip, _user_agent);

  UPDATE public.cliente_auth SET ultimo_acesso_em = now() WHERE cliente_codigo = v_codigo;

  RETURN jsonb_build_object(
    'cliente_codigo', v_codigo,
    'nome', upper(trim(_nome)),
    'email', v_email_lower,
    'token', v_token
  );
END $$;

REVOKE ALL ON FUNCTION public.cliente_cadastrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_cadastrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;