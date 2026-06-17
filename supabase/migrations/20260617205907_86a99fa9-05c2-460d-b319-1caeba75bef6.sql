-- =========================================================
-- Portal do cliente: cadastro + auth do passageiro
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- 1) Campos novos em clientes ----------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
  ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termos_versao TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_lower_uidx
  ON public.clientes (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_cpf_uidx
  ON public.clientes (cpf) WHERE cpf IS NOT NULL;

-- ---------- 2) cliente_auth ----------
CREATE TABLE IF NOT EXISTS public.cliente_auth (
  cliente_codigo        TEXT PRIMARY KEY REFERENCES public.clientes(codigo) ON DELETE CASCADE,
  email_lower           TEXT NOT NULL UNIQUE,
  senha_hash            TEXT NOT NULL,
  reset_token           TEXT,
  reset_token_expira_em TIMESTAMPTZ,
  ultimo_acesso_em      TIMESTAMPTZ,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_auth TO authenticated;
GRANT ALL ON public.cliente_auth TO service_role;
ALTER TABLE public.cliente_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores acessam cliente_auth"
  ON public.cliente_auth FOR ALL TO authenticated
  USING (public.is_operador(auth.uid()))
  WITH CHECK (public.is_operador(auth.uid()));

CREATE TRIGGER trg_cliente_auth_updated
  BEFORE UPDATE ON public.cliente_auth
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 3) cliente_sessoes ----------
CREATE TABLE IF NOT EXISTS public.cliente_sessoes (
  id                    BIGSERIAL PRIMARY KEY,
  cliente_codigo        TEXT NOT NULL REFERENCES public.clientes(codigo) ON DELETE CASCADE,
  token                 TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada')),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_atividade_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip                    TEXT,
  user_agent            TEXT
);

CREATE INDEX IF NOT EXISTS cliente_sessoes_cliente_idx ON public.cliente_sessoes(cliente_codigo);
CREATE INDEX IF NOT EXISTS cliente_sessoes_token_ativa_idx ON public.cliente_sessoes(token) WHERE status = 'ativa';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_sessoes TO authenticated;
GRANT ALL ON public.cliente_sessoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cliente_sessoes_id_seq TO authenticated, service_role;
ALTER TABLE public.cliente_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores acessam cliente_sessoes"
  ON public.cliente_sessoes FOR ALL TO authenticated
  USING (public.is_operador(auth.uid()))
  WITH CHECK (public.is_operador(auth.uid()));

-- =========================================================
-- 4) Funções SECURITY DEFINER (auth do passageiro)
-- =========================================================

-- ---------- cadastrar ----------
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
  _user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo TEXT;
  v_email_lower TEXT := lower(trim(_email));
  v_token TEXT;
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

  v_codigo := public.proximo_codigo_cliente();

  INSERT INTO public.clientes (
    codigo, nome, telefone, email, cpf,
    endereco, cidade,
    endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade,
    termos_aceitos_em, termos_versao
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
    now(), _termos_versao
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

REVOKE ALL ON FUNCTION public.cliente_cadastrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_cadastrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;

-- ---------- login ----------
CREATE OR REPLACE FUNCTION public.cliente_login(
  _email TEXT,
  _senha TEXT,
  _ip TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth RECORD;
  v_cliente RECORD;
  v_token TEXT;
BEGIN
  SELECT * INTO v_auth FROM public.cliente_auth WHERE email_lower = lower(trim(_email));
  IF NOT FOUND OR v_auth.senha_hash IS NULL OR v_auth.senha_hash <> crypt(_senha, v_auth.senha_hash) THEN
    RAISE EXCEPTION 'E-mail ou senha inválidos' USING ERRCODE = 'invalid_password';
  END IF;

  SELECT codigo, nome, email, telefone INTO v_cliente
    FROM public.clientes WHERE codigo = v_auth.cliente_codigo;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.cliente_sessoes (cliente_codigo, token, ip, user_agent)
  VALUES (v_auth.cliente_codigo, v_token, _ip, _user_agent);

  UPDATE public.cliente_auth SET ultimo_acesso_em = now() WHERE cliente_codigo = v_auth.cliente_codigo;

  RETURN jsonb_build_object(
    'cliente_codigo', v_cliente.codigo,
    'nome', v_cliente.nome,
    'email', v_cliente.email,
    'telefone', v_cliente.telefone,
    'token', v_token
  );
END $$;

REVOKE ALL ON FUNCTION public.cliente_login(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_login(TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;

-- ---------- me (resolver token) ----------
CREATE OR REPLACE FUNCTION public.cliente_me(_token TEXT) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cod TEXT;
  v_cliente RECORD;
BEGIN
  SELECT cliente_codigo INTO v_cod
    FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa'
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = 'invalid_authorization_specification'; END IF;

  UPDATE public.cliente_sessoes SET ultima_atividade_em = now() WHERE token = _token;

  SELECT codigo, nome, email, telefone, cpf,
         endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade
    INTO v_cliente
    FROM public.clientes WHERE codigo = v_cod;

  RETURN to_jsonb(v_cliente);
END $$;

REVOKE ALL ON FUNCTION public.cliente_me(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_me(TEXT) TO anon, authenticated;

-- ---------- logout ----------
CREATE OR REPLACE FUNCTION public.cliente_logout(_token TEXT) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cliente_sessoes SET status = 'encerrada' WHERE token = _token AND status = 'ativa';
END $$;

REVOKE ALL ON FUNCTION public.cliente_logout(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_logout(TEXT) TO anon, authenticated;

-- ---------- solicitar reset ----------
CREATE OR REPLACE FUNCTION public.cliente_solicitar_reset(_email TEXT) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_cod TEXT;
BEGIN
  SELECT cliente_codigo INTO v_cod FROM public.cliente_auth WHERE email_lower = lower(trim(_email));
  IF NOT FOUND THEN
    -- não revela existência do e-mail
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  UPDATE public.cliente_auth
     SET reset_token = v_token,
         reset_token_expira_em = now() + interval '1 hour'
   WHERE cliente_codigo = v_cod;

  RETURN jsonb_build_object('ok', true, 'reset_token', v_token, 'cliente_codigo', v_cod);
END $$;

REVOKE ALL ON FUNCTION public.cliente_solicitar_reset(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_solicitar_reset(TEXT) TO anon, authenticated;

-- ---------- redefinir senha ----------
CREATE OR REPLACE FUNCTION public.cliente_redefinir_senha(_token TEXT, _nova_senha TEXT) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cod TEXT;
BEGIN
  IF _nova_senha IS NULL OR length(_nova_senha) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 8 caracteres' USING ERRCODE = 'check_violation';
  END IF;

  SELECT cliente_codigo INTO v_cod
    FROM public.cliente_auth
   WHERE reset_token = _token
     AND reset_token_expira_em IS NOT NULL
     AND reset_token_expira_em > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link de redefinição inválido ou expirado' USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  UPDATE public.cliente_auth
     SET senha_hash = crypt(_nova_senha, gen_salt('bf', 10)),
         reset_token = NULL,
         reset_token_expira_em = NULL
   WHERE cliente_codigo = v_cod;

  -- invalida sessões antigas
  UPDATE public.cliente_sessoes SET status = 'encerrada'
   WHERE cliente_codigo = v_cod AND status = 'ativa';

  RETURN jsonb_build_object('ok', true, 'cliente_codigo', v_cod);
END $$;

REVOKE ALL ON FUNCTION public.cliente_redefinir_senha(TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_redefinir_senha(TEXT,TEXT) TO anon, authenticated;
