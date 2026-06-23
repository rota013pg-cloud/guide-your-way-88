
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID NULL,
  usuario_nome TEXT NULL,
  usuario_tipo TEXT NULL,
  acao TEXT NOT NULL,
  modulo TEXT NULL,
  entidade_id TEXT NULL,
  detalhes JSONB NULL,
  ip TEXT NULL,
  user_agent TEXT NULL
);

CREATE INDEX idx_audit_logs_criado_em ON public.audit_logs (criado_em DESC);
CREATE INDEX idx_audit_logs_usuario_id ON public.audit_logs (usuario_id);
CREATE INDEX idx_audit_logs_acao ON public.audit_logs (acao);
CREATE INDEX idx_audit_logs_modulo ON public.audit_logs (modulo);
CREATE INDEX idx_audit_logs_usuario_tipo ON public.audit_logs (usuario_tipo);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role gerencia logs" ON public.audit_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.registrar_audit(
  _usuario_id UUID,
  _usuario_nome TEXT,
  _usuario_tipo TEXT,
  _acao TEXT,
  _modulo TEXT,
  _entidade_id TEXT,
  _detalhes JSONB,
  _ip TEXT,
  _user_agent TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO public.audit_logs(
    usuario_id, usuario_nome, usuario_tipo, acao, modulo, entidade_id, detalhes, ip, user_agent
  ) VALUES (
    _usuario_id, _usuario_nome, _usuario_tipo, _acao, _modulo, _entidade_id, _detalhes, _ip, _user_agent
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
