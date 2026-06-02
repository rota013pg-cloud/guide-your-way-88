/**
 * Server functions de corridas — disparo de ofertas, log de status e listagens.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QTD_MOT = 5;
const LAT_BASE = -24.0122;
const LNG_BASE = -46.4097;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function registrarLog(
  corridaId: number,
  status: string,
  motoristaCodigo?: string | null,
  observacao?: string | null,
) {
  await supabaseAdmin.from("corrida_status_log").insert({
    corrida_id: corridaId,
    status,
    motorista_codigo: motoristaCodigo ?? null,
    observacao: observacao ?? null,
  });
}

export const dispararOfertas = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ corridaId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { corridaId } = data;

    const { data: corrida, error: corridaErr } = await supabaseAdmin
      .from("corridas")
      .select(
        "id, status, origem_lat, origem_lng, despacho, modelo, motoristas_manuais",
      )
      .eq("id", corridaId)
      .maybeSingle();
    if (corridaErr) throw new Error(corridaErr.message);
    if (!corrida) throw new Error("Corrida não encontrada");

    if (corrida.modelo === "Agendada") {
      return { ok: true, ofertados: 0, modo: "agendada" as const };
    }
    if (corrida.status !== "Pendente") {
      return { ok: true, ofertados: 0, motivo: "corrida não está pendente" };
    }

    // WhatsApp: não insere ofertas, retorna sinal para o cliente gerar o texto
    if (corrida.despacho === "WhatsApp") {
      await registrarLog(corridaId, "Ofertada (WhatsApp)");
      return { ok: true, ofertados: 0, modo: "whatsapp" as const };
    }

    // Motoristas candidatos
    let candidatosCodigos: string[] = [];

    if (corrida.despacho === "Manual") {
      candidatosCodigos = (corrida.motoristas_manuais ?? []) as string[];
      if (candidatosCodigos.length === 0) {
        return {
          ok: true,
          ofertados: 0,
          motivo: "nenhum motorista selecionado",
        };
      }
    } else {
      const { data: motoristas, error: motErr } = await supabaseAdmin
        .from("motoristas")
        .select("codigo")
        .eq("status", "Online");
      if (motErr) throw new Error(motErr.message);
      candidatosCodigos = (motoristas ?? []).map((m) => m.codigo);
      if (candidatosCodigos.length === 0) {
        return { ok: true, ofertados: 0, motivo: "nenhum motorista online" };
      }
    }

    // Já ofertados (não duplicar)
    const { data: jaOfertados } = await supabaseAdmin
      .from("corrida_ofertas")
      .select("motorista_codigo")
      .eq("corrida_id", corridaId);
    const jaSet = new Set((jaOfertados ?? []).map((o) => o.motorista_codigo));
    const codigos = candidatosCodigos.filter((c) => !jaSet.has(c));
    if (codigos.length === 0) {
      return { ok: true, ofertados: 0, motivo: "todos já ofertados" };
    }

    let codigosFinais = codigos;

    if (corrida.despacho === "Automatico") {
      // Ordena por proximidade e pega top N
      const { data: gpsRows } = await supabaseAdmin
        .from("motorista_gps")
        .select("motorista_codigo, lat, lng, criado_em")
        .in("motorista_codigo", codigos)
        .order("criado_em", { ascending: false })
        .limit(500);

      const gpsMap = new Map<string, { lat: number; lng: number }>();
      for (const g of gpsRows ?? []) {
        if (!gpsMap.has(g.motorista_codigo)) {
          gpsMap.set(g.motorista_codigo, {
            lat: Number(g.lat),
            lng: Number(g.lng),
          });
        }
      }
      const origemLat = corrida.origem_lat
        ? Number(corrida.origem_lat)
        : LAT_BASE;
      const origemLng = corrida.origem_lng
        ? Number(corrida.origem_lng)
        : LNG_BASE;
      codigosFinais = codigos
        .map((codigo) => {
          const g = gpsMap.get(codigo);
          const lat = g?.lat ?? LAT_BASE;
          const lng = g?.lng ?? LNG_BASE;
          return {
            codigo,
            distancia: haversine(lat, lng, origemLat, origemLng),
          };
        })
        .sort((a, b) => a.distancia - b.distancia)
        .slice(0, QTD_MOT)
        .map((c) => c.codigo);
    }

    const rows = codigosFinais.map((codigo) => ({
      corrida_id: corridaId,
      motorista_codigo: codigo,
      status: "pendente",
    }));

    const { error: insErr } = await supabaseAdmin
      .from("corrida_ofertas")
      .insert(rows);
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin
      .from("corridas")
      .update({ status: "Ofertada" })
      .eq("id", corridaId);
    await registrarLog(corridaId, `Ofertada (${corrida.despacho})`);

    return { ok: true, ofertados: rows.length, modo: corrida.despacho };
  });

// ─── Registrar evento de status manualmente ───────────────────────
export const registrarStatusCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        corridaId: z.number().int().positive(),
        status: z.string().min(1).max(40),
        motoristaCodigo: z.string().optional(),
        observacao: z.string().max(255).optional(),
        atualizarCorrida: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await registrarLog(
      data.corridaId,
      data.status,
      data.motoristaCodigo,
      data.observacao,
    );
    if (data.atualizarCorrida) {
      // Se o status corresponde a um valor do enum, atualiza
      const validos = [
        "Pendente",
        "Ofertada",
        "Aceita",
        "A caminho",
        "Chegou",
        "Em viagem",
        "Parada",
        "Finalizada",
        "Cancelada",
        "Agendada",
      ];
      if (validos.includes(data.status)) {
        await supabaseAdmin
          .from("corridas")
          .update({ status: data.status as any })
          .eq("id", data.corridaId);
      }
    }
    return { ok: true };
  });

// ─── Buscar logs de uma corrida ───────────────────────────────────
export const listarLogCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ corridaId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("corrida_status_log")
      .select("id, status, motorista_codigo, observacao, criado_em")
      .eq("corrida_id", data.corridaId)
      .order("criado_em", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Listar corridas recentes para o painel ──────────────────────
export const listarCorridasRecentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ limite: z.number().int().min(1).max(200).optional().default(50) })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("corridas")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(data.limite);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
