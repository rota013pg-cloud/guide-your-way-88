import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { calcularValorComParadas } from "@/lib/tarifas-calc";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type TarifaOpt = { id: string; nome: string; tarifaMinima: number; valorKm: number };

const TARIFAS_DEFAULT = {
  tabelasFixas: [
    { id: "pgpg", titulo: "Praia Grande → Praia Grande", tarifaMinima: 4.5, valorKm: 1.2 },
    { id: "pgsv", titulo: "Praia Grande → São Vicente", tarifaMinima: 15, valorKm: 2.0 },
    { id: "pgsantos", titulo: "Praia Grande → Santos", tarifaMinima: 20, valorKm: 2.2 },
    { id: "pgcubatao", titulo: "Praia Grande → Cubatão", tarifaMinima: 20, valorKm: 2.2 },
  ],
  tabelaHibrida: { titulo: "Híbrida (outras rotas)", tarifaMinima: 30, valorKm: 3.6 },
};

const PontoSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const CotacaoSchema = z.object({
  token: z.string().min(10),
  origem: PontoSchema,
  destino: PontoSchema,
  paradas: z.array(PontoSchema).default([]),
});

async function calcularKmRota(origem: { lat: number; lng: number }, destino: { lat: number; lng: number }) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY ausente");
  if (!connKey) throw new Error("GOOGLE_MAPS_API_KEY ausente (connector Google Maps não conectado)");

  const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origem.lat, longitude: origem.lng } } },
      destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "pt-BR",
      regionCode: "BR",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Routes API ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { routes?: Array<{ distanceMeters?: number }> };
  return (json.routes?.[0]?.distanceMeters ?? 0) / 1000;
}

export const cotarCorridaCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CotacaoSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sessao, error: sessaoError } = await supabaseAdmin
      .from("cliente_sessoes")
      .select("id")
      .eq("token", data.token)
      .eq("status", "ativa")
      .maybeSingle();

    if (sessaoError) throw new Error(sessaoError.message);
    if (!sessao) throw new Error("Sessão inválida — faça login novamente.");

    const { data: cfgRow } = await supabaseAdmin.from("app_config").select("config_json").eq("id", 1).maybeSingle();
    const cfg = (cfgRow?.config_json ?? {}) as any;
    const tarifasCfg = cfg.tarifas ?? TARIFAS_DEFAULT;
    const tarifas: TarifaOpt[] = [
      ...((tarifasCfg.tabelasFixas ?? TARIFAS_DEFAULT.tabelasFixas) as any[]).map((t) => ({
        id: t.id,
        nome: t.titulo,
        tarifaMinima: Number(t.tarifaMinima ?? 0),
        valorKm: Number(t.valorKm ?? 0),
      })),
      {
        id: "hibrida",
        nome: tarifasCfg.tabelaHibrida?.titulo ?? TARIFAS_DEFAULT.tabelaHibrida.titulo,
        tarifaMinima: Number(tarifasCfg.tabelaHibrida?.tarifaMinima ?? TARIFAS_DEFAULT.tabelaHibrida.tarifaMinima),
        valorKm: Number(tarifasCfg.tabelaHibrida?.valorKm ?? TARIFAS_DEFAULT.tabelaHibrida.valorKm),
      },
    ];

    const tarifa = tarifas[0];
    const destinos = [data.destino, ...data.paradas];
    const rotas = await Promise.all(destinos.map((destino) => calcularKmRota(data.origem, destino).catch(() => 0)));
    const maiorKm = rotas.reduce((acc, km) => (km > acc ? km : acc), 0);
    const distancia = Number(maiorKm.toFixed(1));
    const valorBase = tarifa && distancia > 0 ? Math.max(distancia * tarifa.valorKm, tarifa.tarifaMinima) : 0;
    const { total, adicional } = calcularValorComParadas(valorBase, data.paradas.length, Number(cfg.valorParadaExtra ?? 3));

    return { distancia, valor: total, tarifaId: tarifa?.id ?? null, tarifaNome: tarifa?.nome ?? null, adicionalParadas: adicional };
  });