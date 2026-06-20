
CREATE OR REPLACE FUNCTION public.cliente_solicitar_reset(_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  -- Segurança: NÃO retorna o token. Entrega futura deve ser via e-mail.
  RETURN jsonb_build_object('ok', true);
END $function$;
