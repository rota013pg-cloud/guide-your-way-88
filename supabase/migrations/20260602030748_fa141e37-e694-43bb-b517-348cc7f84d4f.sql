-- 1. Coluna indicacao em clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS indicacao text;

-- 2. Coluna motivo_bloqueio em motorista_auth
ALTER TABLE public.motorista_auth ADD COLUMN IF NOT EXISTS motivo_bloqueio text;

-- 3. Função para gerar próximo código de cliente (C0001, C0002...)
CREATE OR REPLACE FUNCTION public.proximo_codigo_cliente()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_codigo text;
BEGIN
  LOCK TABLE public.clientes IN SHARE ROW EXCLUSIVE MODE;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0)
    INTO v_max
    FROM public.clientes
   WHERE codigo ~ '^C\d+$';
  v_codigo := 'C' || lpad((v_max + 1)::text, 4, '0');
  RETURN v_codigo;
END $$;

-- 4. Função para próximo código de motorista (M0001...)
CREATE OR REPLACE FUNCTION public.proximo_codigo_motorista()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_codigo text;
BEGIN
  LOCK TABLE public.motoristas IN SHARE ROW EXCLUSIVE MODE;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0)
    INTO v_max
    FROM public.motoristas
   WHERE codigo ~ '^M\d+$';
  v_codigo := 'M' || lpad((v_max + 1)::text, 4, '0');
  RETURN v_codigo;
END $$;

-- 5. Versão "preview" (sem lock) só para mostrar na UI
CREATE OR REPLACE FUNCTION public.preview_proximo_codigo_cliente()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'C' || lpad((COALESCE(MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0) + 1)::text, 4, '0')
  FROM public.clientes WHERE codigo ~ '^C\d+$'
$$;

CREATE OR REPLACE FUNCTION public.preview_proximo_codigo_motorista()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'M' || lpad((COALESCE(MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0) + 1)::text, 4, '0')
  FROM public.motoristas WHERE codigo ~ '^M\d+$'
$$;

-- 6. Garantir unicidade (anti-bug de IDs duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_codigo_unique ON public.clientes(codigo);
CREATE UNIQUE INDEX IF NOT EXISTS motoristas_codigo_unique ON public.motoristas(codigo);

-- 7. Bucket de documentos dos motoristas (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('motoristas-docs', 'motoristas-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 8. Policies do bucket — operadores autenticados gerenciam tudo
CREATE POLICY "operadores leem docs motoristas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'motoristas-docs' AND public.is_operador(auth.uid()));

CREATE POLICY "operadores enviam docs motoristas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'motoristas-docs' AND public.is_operador(auth.uid()));

CREATE POLICY "operadores atualizam docs motoristas"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'motoristas-docs' AND public.is_operador(auth.uid()));

CREATE POLICY "operadores deletam docs motoristas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'motoristas-docs' AND public.is_operador(auth.uid()));