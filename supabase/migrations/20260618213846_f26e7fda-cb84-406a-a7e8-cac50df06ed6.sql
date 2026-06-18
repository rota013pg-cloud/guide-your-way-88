-- Corrige funções de auth de cliente: pgcrypto vive no schema `extensions`
-- e precisa estar no search_path para crypt()/gen_salt() resolverem.

ALTER FUNCTION public.cliente_cadastrar(text,text,text,text,text,text,text,text,text,text,text,text)
  SET search_path = public, extensions;

ALTER FUNCTION public.cliente_login(text,text,text,text)
  SET search_path = public, extensions;

ALTER FUNCTION public.cliente_redefinir_senha(text,text)
  SET search_path = public, extensions;

ALTER FUNCTION public.cliente_solicitar_reset(text)
  SET search_path = public, extensions;