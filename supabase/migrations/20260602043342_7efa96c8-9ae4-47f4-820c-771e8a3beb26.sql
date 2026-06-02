
-- ===== USUARIOS DO PAINEL =====
CREATE TABLE public.usuarios_painel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome text NOT NULL,
  email text NOT NULL,
  login text NOT NULL UNIQUE,
  senha_plain text,
  status text NOT NULL DEFAULT 'Ativo',
  motivo_bloqueio text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios_painel TO authenticated;
GRANT ALL ON public.usuarios_painel TO service_role;

ALTER TABLE public.usuarios_painel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin gerencia usuarios_painel" ON public.usuarios_painel
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "self read usuarios_painel" ON public.usuarios_painel
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_usuarios_painel_updated
  BEFORE UPDATE ON public.usuarios_painel
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== MURAL DE RECADOS =====
CREATE TABLE public.mural_recados (
  id bigserial PRIMARY KEY,
  autor_user_id uuid NOT NULL,
  autor_nome text NOT NULL,
  texto text NOT NULL,
  fixado boolean NOT NULL DEFAULT false,
  lido_por jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_recados TO authenticated;
GRANT ALL ON public.mural_recados TO service_role;

ALTER TABLE public.mural_recados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operadores leem mural" ON public.mural_recados
  FOR SELECT TO authenticated
  USING (is_operador(auth.uid()));

CREATE POLICY "operadores inserem mural" ON public.mural_recados
  FOR INSERT TO authenticated
  WITH CHECK (is_operador(auth.uid()) AND autor_user_id = auth.uid());

CREATE POLICY "operadores atualizam mural (lido)" ON public.mural_recados
  FOR UPDATE TO authenticated
  USING (is_operador(auth.uid()))
  WITH CHECK (is_operador(auth.uid()));

CREATE POLICY "autor ou admin deleta mural" ON public.mural_recados
  FOR DELETE TO authenticated
  USING (autor_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.mural_recados;

-- ===== CORRIDAS: alerta agendada =====
ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS alerta_antes_min integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS alerta_disparado boolean NOT NULL DEFAULT false;
