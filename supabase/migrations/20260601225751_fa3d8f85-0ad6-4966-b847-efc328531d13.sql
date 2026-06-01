
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');
CREATE TYPE public.status_motorista AS ENUM ('Offline', 'Online', 'Em corrida', 'Bloqueado');
CREATE TYPE public.status_corrida AS ENUM ('Pendente', 'Ofertada', 'Aceita', 'A caminho', 'Chegou', 'Em viagem', 'Finalizada', 'Cancelada');
CREATE TYPE public.tipo_pagamento AS ENUM ('Dinheiro', 'Pix', 'Cartão', 'Maquininha', 'Conta');
CREATE TYPE public.status_motorista_auth AS ENUM ('Ativo', 'Bloqueado');

-- =========================================
-- USER ROLES (segurança)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_operador(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','operador'))
$$;

CREATE POLICY "user_roles self read" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =========================================
-- DIA OPERACIONAL (regra das 6h)
-- =========================================
CREATE OR REPLACE FUNCTION public.dia_operacional(_ts TIMESTAMPTZ DEFAULT now())
RETURNS DATE LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN EXTRACT(HOUR FROM (_ts AT TIME ZONE 'America/Sao_Paulo')) < 6
    THEN ((_ts AT TIME ZONE 'America/Sao_Paulo')::date - 1)
    ELSE (_ts AT TIME ZONE 'America/Sao_Paulo')::date
  END
$$;

-- =========================================
-- TRIGGER updated_at genérico
-- =========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END $$;

-- =========================================
-- MOTORISTAS
-- =========================================
CREATE TABLE public.motoristas (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  moto TEXT,
  placa TEXT,
  cor TEXT,
  cidade TEXT,
  cpf TEXT,
  cnh TEXT,
  status status_motorista NOT NULL DEFAULT 'Offline',
  foto TEXT,
  foto_moto TEXT,
  doc_cnh TEXT,
  doc_veiculo TEXT,
  doc_endereco TEXT,
  endereco TEXT,
  telefone_familiar TEXT,
  nome_familiar TEXT,
  corridas INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_motoristas_updated BEFORE UPDATE ON public.motoristas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motoristas TO authenticated;
GRANT ALL ON public.motoristas TO service_role;
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores leem motoristas" ON public.motoristas
  FOR SELECT TO authenticated USING (public.is_operador(auth.uid()));
CREATE POLICY "operadores modificam motoristas" ON public.motoristas
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- MOTORISTA_AUTH
-- =========================================
CREATE TABLE public.motorista_auth (
  motorista_codigo TEXT PRIMARY KEY REFERENCES public.motoristas(codigo) ON DELETE CASCADE,
  senha_hash TEXT NOT NULL,
  senha_plain TEXT,
  status status_motorista_auth NOT NULL DEFAULT 'Ativo',
  device_id TEXT,
  device_nome TEXT,
  ultimo_acesso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_motorista_auth_updated BEFORE UPDATE ON public.motorista_auth
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorista_auth TO authenticated;
GRANT ALL ON public.motorista_auth TO service_role;
ALTER TABLE public.motorista_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores gerenciam motorista_auth" ON public.motorista_auth
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- MOTORISTA_SESSOES
-- =========================================
CREATE TABLE public.motorista_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_codigo TEXT NOT NULL REFERENCES public.motoristas(codigo) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_id TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorista_sessoes TO authenticated;
GRANT ALL ON public.motorista_sessoes TO service_role;
ALTER TABLE public.motorista_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores leem sessoes" ON public.motorista_sessoes
  FOR SELECT TO authenticated USING (public.is_operador(auth.uid()));

-- =========================================
-- CLIENTES
-- =========================================
CREATE TABLE public.clientes (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  observacoes TEXT,
  corridas INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores acessam clientes" ON public.clientes
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- CORRIDAS
-- =========================================
CREATE TABLE public.corridas (
  id BIGSERIAL PRIMARY KEY,
  cliente_codigo TEXT REFERENCES public.clientes(codigo) ON DELETE SET NULL,
  cliente TEXT,
  telefone_cliente TEXT,
  origem TEXT NOT NULL,
  destino TEXT,
  origem_lat NUMERIC,
  origem_lng NUMERIC,
  destino_lat NUMERIC,
  destino_lng NUMERIC,
  tipo TEXT,
  distancia_km NUMERIC,
  valor_final NUMERIC NOT NULL DEFAULT 0,
  motorista_codigo TEXT REFERENCES public.motoristas(codigo) ON DELETE SET NULL,
  motorista TEXT,
  status status_corrida NOT NULL DEFAULT 'Pendente',
  pagamento tipo_pagamento,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_em TIMESTAMPTZ
);
CREATE INDEX idx_corridas_status ON public.corridas(status);
CREATE INDEX idx_corridas_motorista ON public.corridas(motorista_codigo);
CREATE INDEX idx_corridas_criado_em ON public.corridas(criado_em DESC);
CREATE TRIGGER trg_corridas_updated BEFORE UPDATE ON public.corridas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corridas TO authenticated;
GRANT ALL ON public.corridas TO service_role;
ALTER TABLE public.corridas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores acessam corridas" ON public.corridas
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- CORRIDA_OFERTAS
-- =========================================
CREATE TABLE public.corrida_ofertas (
  id BIGSERIAL PRIMARY KEY,
  corrida_id BIGINT NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
  motorista_codigo TEXT NOT NULL REFERENCES public.motoristas(codigo) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(corrida_id, motorista_codigo)
);
CREATE INDEX idx_ofertas_motorista ON public.corrida_ofertas(motorista_codigo, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrida_ofertas TO authenticated;
GRANT ALL ON public.corrida_ofertas TO service_role;
ALTER TABLE public.corrida_ofertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores acessam ofertas" ON public.corrida_ofertas
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- FINANCEIRO (diárias)
-- =========================================
CREATE TABLE public.financeiro (
  id BIGSERIAL PRIMARY KEY,
  motorista_codigo TEXT NOT NULL REFERENCES public.motoristas(codigo) ON DELETE CASCADE,
  motorista TEXT,
  valor NUMERIC NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Diária',
  operador TEXT,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  dia_op DATE GENERATED ALWAYS AS (public.dia_operacional(data)) STORED
);
CREATE UNIQUE INDEX uniq_diaria_dia ON public.financeiro(motorista_codigo, tipo, dia_op);
CREATE INDEX idx_financeiro_dia ON public.financeiro(dia_op DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro TO authenticated;
GRANT ALL ON public.financeiro TO service_role;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores acessam financeiro" ON public.financeiro
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- MOTORISTA_GPS
-- =========================================
CREATE TABLE public.motorista_gps (
  id BIGSERIAL PRIMARY KEY,
  motorista_codigo TEXT NOT NULL REFERENCES public.motoristas(codigo) ON DELETE CASCADE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  velocidade NUMERIC,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gps_motorista_tempo ON public.motorista_gps(motorista_codigo, criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorista_gps TO authenticated;
GRANT ALL ON public.motorista_gps TO service_role;
ALTER TABLE public.motorista_gps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores leem gps" ON public.motorista_gps
  FOR SELECT TO authenticated USING (public.is_operador(auth.uid()));

-- =========================================
-- PUSH_SUBSCRIPTIONS
-- =========================================
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_codigo TEXT NOT NULL REFERENCES public.motoristas(codigo) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores gerenciam push" ON public.push_subscriptions
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- APP_CONFIG
-- =========================================
CREATE TABLE public.app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_app_config_updated BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores leem config" ON public.app_config
  FOR SELECT TO authenticated USING (public.is_operador(auth.uid()));
CREATE POLICY "admin altera config" ON public.app_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- TARIFAS
-- =========================================
CREATE TABLE public.tarifas (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  bandeirada NUMERIC NOT NULL DEFAULT 0,
  por_km NUMERIC NOT NULL DEFAULT 0,
  minimo NUMERIC NOT NULL DEFAULT 0,
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas TO authenticated;
GRANT ALL ON public.tarifas TO service_role;
ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operadores acessam tarifas" ON public.tarifas
  FOR ALL TO authenticated USING (public.is_operador(auth.uid())) WITH CHECK (public.is_operador(auth.uid()));

-- =========================================
-- REALTIME
-- =========================================
ALTER TABLE public.corridas REPLICA IDENTITY FULL;
ALTER TABLE public.corrida_ofertas REPLICA IDENTITY FULL;
ALTER TABLE public.motorista_gps REPLICA IDENTITY FULL;
ALTER TABLE public.motoristas REPLICA IDENTITY FULL;
ALTER TABLE public.financeiro REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.corridas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.corrida_ofertas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.motorista_gps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro;

-- =========================================
-- AUTO ATRIBUIR ROLE 'operador' AO PRIMEIRO USUÁRIO
-- (e operador a todos os demais como padrão)
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'operador');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
