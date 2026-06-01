
-- Set search_path on remaining functions
CREATE OR REPLACE FUNCTION public.dia_operacional(_ts TIMESTAMPTZ DEFAULT now())
RETURNS DATE LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN EXTRACT(HOUR FROM (_ts AT TIME ZONE 'America/Sao_Paulo')) < 6
    THEN ((_ts AT TIME ZONE 'America/Sao_Paulo')::date - 1)
    ELSE (_ts AT TIME ZONE 'America/Sao_Paulo')::date
  END
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END $$;

-- Lock down the trigger-only function
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
