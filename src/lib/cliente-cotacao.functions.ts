import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { calcularValorComParadas, floorReal } from "@/lib/tarifas-calc";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

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
  cupom: z.string().trim().max(40).optional(),
});

type CupomRow = {
  codigo: string;
  desconto_pct: number;
  aplicacao: string;
  ativo: boolean;
  valido_de: string | null;
  valido_ate: string | null;
  limite_usos: number | null;
  usos: number;
};

function cupomVale(c: CupomRow): boolean {
  if (!c.ativo) return false;
  const agora = Date.now();
  if (c.valido_de && agora < new Date(c.valido_de).getTime()) return false;
  if (c.valido_ate && agora > new Date(c.valido_ate).getTime()) return false;
  if (c.limite_usos != null && (c.usos ?? 0) >= c.limite_usos) return false;
  return true;
}

async function calcularKmRota(origem: { lat: number; lng: number }, destino: { lat: number; lng: number }) {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_SERVER_KEY ausente");

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
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

    // ── Cupom de desconto ──
    // Manual: usa o código digitado. Automático: aplica o melhor cupom ativo.
    let cupomCodigo: string | null = null;
    let cupomPct = 0;
    let cupomErro: string | null = null;
    const valorOriginal = total;
    let valorFinal = total;

    if (total > 0) {
      const codigo = (data.cupom ?? "").trim();
      if (codigo) {
        const { data: c } = await supabaseAdmin
          .from("cupons")
          .select("*")
          .ilike("codigo", codigo)
          .maybeSingle();
        if (c && cupomVale(c as CupomRow)) {
          cupomCodigo = (c as CupomRow).codigo;
          cupomPct = Number((c as CupomRow).desconto_pct);
        } else {
          cupomErro = "Cupom inválido ou expirado.";
        }
      } else {
        const { data: autos } = await supabaseAdmin
          .from("cupons")
          .select("*")
          .eq("aplicacao", "automatico")
          .eq("ativo", true);
        const validos = ((autos ?? []) as CupomRow[])
          .filter(cupomVale)
          .sort((a, b) => Number(b.desconto_pct) - Number(a.desconto_pct));
        if (validos[0]) {
          cupomCodigo = validos[0].codigo;
          cupomPct = Number(validos[0].desconto_pct);
        }
      }
      if (cupomPct > 0) {
        valorFinal = Math.max(0, floorReal(total * (1 - cupomPct / 100)));
      }
    }

    const descontoValor = Math.max(0, valorOriginal - valorFinal);

    return {
      distancia,
      valor: valorFinal,
      valorOriginal,
      descontoValor,
      cupomCodigo,
      cupomPct,
      cupomErro,
      tarifaId: tarifa?.id ?? null,
      tarifaNome: tarifa?.nome ?? null,
      adicionalParadas: adicional,
    };
  });