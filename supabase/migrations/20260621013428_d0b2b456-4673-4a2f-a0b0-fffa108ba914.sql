CREATE OR REPLACE FUNCTION public.cliente_cotar(
  _distancia_km numeric,
  _qtd_paradas integer DEFAULT 0,
  _origem text DEFAULT NULL,
  _destino text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cfg jsonb;
  v_min numeric;
  v_km  numeric;
  v_parada numeric;
  v_valor numeric;
  v_tab_id text;
  v_orig text;
  v_dest text;
  v_fix jsonb;
BEGIN
  SELECT config_json INTO v_cfg FROM public.app_config WHERE id = 1;
  v_parada := COALESCE((v_cfg ->> 'valorParadaExtra')::numeric, 3);

  -- Normaliza: tira acentos, lowercase
  v_orig := lower(coalesce(_origem, ''));
  v_dest := lower(coalesce(_destino, ''));
  v_orig := translate(v_orig, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_dest := translate(v_dest, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  -- Detecta cidade (origem e destino) — se destino vazio, usa origem como ambos (corrida local)
  IF v_dest = '' THEN v_dest := v_orig; END IF;

  -- Casamento de tabelas fixas (mesma lógica do operador: PG↔PG, PG↔SV, PG↔Santos, PG↔Cubatão)
  IF (v_orig LIKE '%praia grande%' AND v_dest LIKE '%praia grande%') THEN
    v_tab_id := 'pgpg';
  ELSIF (v_orig LIKE '%praia grande%' AND v_dest LIKE '%sao vicente%')
     OR (v_orig LIKE '%sao vicente%'  AND v_dest LIKE '%praia grande%') THEN
    v_tab_id := 'pgsv';
  ELSIF (v_orig LIKE '%praia grande%' AND v_dest LIKE '%santos%')
     OR (v_orig LIKE '%santos%'       AND v_dest LIKE '%praia grande%') THEN
    v_tab_id := 'pgsantos';
  ELSIF (v_orig LIKE '%praia grande%' AND v_dest LIKE '%cubatao%')
     OR (v_orig LIKE '%cubatao%'      AND v_dest LIKE '%praia grande%') THEN
    v_tab_id := 'pgcubatao';
  END IF;

  IF v_tab_id IS NOT NULL THEN
    SELECT t INTO v_fix
    FROM jsonb_array_elements(v_cfg #> '{tarifas,tabelasFixas}') t
    WHERE t->>'id' = v_tab_id
    LIMIT 1;
  END IF;

  IF v_fix IS NOT NULL THEN
    v_min := COALESCE((v_fix->>'tarifaMinima')::numeric, 30);
    v_km  := COALESCE((v_fix->>'valorKm')::numeric, 3.6);
  ELSE
    v_min := COALESCE((v_cfg #>> '{tarifas,tabelaHibrida,tarifaMinima}')::numeric, 30);
    v_km  := COALESCE((v_cfg #>> '{tarifas,tabelaHibrida,valorKm}')::numeric, 3.6);
    v_tab_id := 'hibrida';
  END IF;

  v_valor := GREATEST(v_min, COALESCE(_distancia_km,0) * v_km) + COALESCE(_qtd_paradas,0) * v_parada;
  v_valor := floor(v_valor);
  RETURN jsonb_build_object('valor', v_valor, 'tarifa_id', v_tab_id, 'tarifa_minima', v_min, 'valor_km', v_km, 'valor_parada', v_parada);
END $$;

GRANT EXECUTE ON FUNCTION public.cliente_cotar(numeric, integer, text, text) TO anon, authenticated;
-- Mantém versão antiga para compatibilidade (fallback hibrida)
GRANT EXECUTE ON FUNCTION public.cliente_cotar(numeric, integer) TO anon, authenticated;