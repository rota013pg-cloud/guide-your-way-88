
ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS avaliacao_corrida smallint,
  ADD COLUMN IF NOT EXISTS avaliacao_motorista smallint,
  ADD COLUMN IF NOT EXISTS avaliacao_comentario text,
  ADD COLUMN IF NOT EXISTS avaliada_em timestamptz;

CREATE OR REPLACE FUNCTION public.cliente_avaliar_corrida(
  _token TEXT,
  _corrida_id BIGINT,
  _nota_corrida SMALLINT,
  _nota_motorista SMALLINT,
  _comentario TEXT
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cod TEXT;
BEGIN
  SELECT cliente_codigo INTO v_cod FROM public.cliente_sessoes
   WHERE token = _token AND status = 'ativa' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida' USING ERRCODE='invalid_authorization_specification'; END IF;

  IF _nota_corrida IS NOT NULL AND (_nota_corrida < 1 OR _nota_corrida > 5) THEN
    RAISE EXCEPTION 'Nota da corrida inválida';
  END IF;
  IF _nota_motorista IS NOT NULL AND (_nota_motorista < 1 OR _nota_motorista > 5) THEN
    RAISE EXCEPTION 'Nota do motociclista inválida';
  END IF;

  UPDATE public.corridas
     SET avaliacao_corrida = _nota_corrida,
         avaliacao_motorista = _nota_motorista,
         avaliacao_comentario = NULLIF(trim(_comentario), ''),
         avaliada_em = now()
   WHERE id = _corrida_id AND cliente_codigo = v_cod;

  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.cliente_avaliar_corrida(TEXT,BIGINT,SMALLINT,SMALLINT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_avaliar_corrida(TEXT,BIGINT,SMALLINT,SMALLINT,TEXT) TO anon, authenticated;
