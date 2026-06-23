
CREATE OR REPLACE FUNCTION public.trg_notificar_cancelamento_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Cancelada'::status_corrida
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.cliente_codigo IS NOT NULL
     AND COALESCE(NEW.observacoes, '') NOT ILIKE 'Convertida em corrida pelo operador%' THEN
    INSERT INTO public.chat_cliente (cliente_codigo, autor, autor_nome, texto)
    VALUES (
      NEW.cliente_codigo,
      'central',
      'Central',
      'Sua corrida #' || NEW.id::text || ' foi cancelada. Caso precise, faça uma nova solicitação ou fale com a central.'
    );
  END IF;
  RETURN NEW;
END $$;
