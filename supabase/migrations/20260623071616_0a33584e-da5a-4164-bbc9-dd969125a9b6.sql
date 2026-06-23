
CREATE OR REPLACE FUNCTION public.trg_audit_operador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_nome text;
  v_entidade text;
  v_detalhes jsonb;
  v_acao text;
BEGIN
  -- Operador apenas: clientes/motoristas usam tokens custom, auth.uid() é NULL
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT nome INTO v_nome FROM public.usuarios_painel WHERE user_id = v_user_id LIMIT 1;
  IF v_nome IS NULL THEN
    SELECT email INTO v_nome FROM auth.users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'criar';
    v_entidade := COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(NEW)->>'codigo'));
    v_detalhes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'atualizar';
    v_entidade := COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(NEW)->>'codigo'));
    v_detalhes := jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW));
  ELSE
    v_acao := 'excluir';
    v_entidade := COALESCE((to_jsonb(OLD)->>'id'), (to_jsonb(OLD)->>'codigo'));
    v_detalhes := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs(usuario_id, usuario_nome, usuario_tipo, acao, modulo, entidade_id, detalhes)
  VALUES (v_user_id, v_nome, 'operador', v_acao, TG_TABLE_NAME, v_entidade, v_detalhes);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'audit trigger falhou em %: % %', TG_TABLE_NAME, SQLERRM, SQLSTATE;
  RETURN COALESCE(NEW, OLD);
END $$;

-- Anexa o trigger nas tabelas operadas pelo painel
DROP TRIGGER IF EXISTS trg_audit_corridas ON public.corridas;
CREATE TRIGGER trg_audit_corridas AFTER INSERT OR UPDATE OR DELETE ON public.corridas
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_clientes ON public.clientes;
CREATE TRIGGER trg_audit_clientes AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_motoristas ON public.motoristas;
CREATE TRIGGER trg_audit_motoristas AFTER INSERT OR UPDATE OR DELETE ON public.motoristas
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_usuarios_painel ON public.usuarios_painel;
CREATE TRIGGER trg_audit_usuarios_painel AFTER INSERT OR UPDATE OR DELETE ON public.usuarios_painel
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_tarifas ON public.tarifas;
CREATE TRIGGER trg_audit_tarifas AFTER INSERT OR UPDATE OR DELETE ON public.tarifas
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_app_config ON public.app_config;
CREATE TRIGGER trg_audit_app_config AFTER INSERT OR UPDATE OR DELETE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_financeiro ON public.financeiro;
CREATE TRIGGER trg_audit_financeiro AFTER INSERT OR UPDATE OR DELETE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_mural_recados ON public.mural_recados;
CREATE TRIGGER trg_audit_mural_recados AFTER INSERT OR UPDATE OR DELETE ON public.mural_recados
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_cobrancas_extras ON public.motorista_cobrancas_extras;
CREATE TRIGGER trg_audit_cobrancas_extras AFTER INSERT OR UPDATE OR DELETE ON public.motorista_cobrancas_extras
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();

DROP TRIGGER IF EXISTS trg_audit_ocorrencias_pessoa ON public.ocorrencias_pessoa;
CREATE TRIGGER trg_audit_ocorrencias_pessoa AFTER INSERT OR UPDATE OR DELETE ON public.ocorrencias_pessoa
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_operador();
