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
    z.object({
      corridaId: z.number().int().positive(),
      quantidade: z.number().int().min(1).max(50).optional(),
      reofertar: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { corridaId, reofertar } = data;
    const qtd = data.quantidade ?? QTD_MOT;


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
    if (corrida.status !== "Pendente" && !reofertar) {
      return { ok: true, ofertados: 0, motivo: "corrida não está pendente" };
    }

    // Reoferta: expira ofertas pendentes anteriores para liberar os mesmos motoristas
    if (reofertar) {
      await supabaseAdmin
        .from("corrida_ofertas")
        .update({ status: "expirada" })
        .eq("corrida_id", corridaId)
        .eq("status", "pendente");
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
        .eq("status", "Online")
        .eq("pausado", false);
      if (motErr) throw new Error(motErr.message);
      candidatosCodigos = (motoristas ?? []).map((m) => m.codigo);
      if (candidatosCodigos.length === 0) {
        return { ok: true, ofertados: 0, motivo: "nenhum motorista online" };
      }
    }

    // Exclui motoristas pausados (vale também para despacho Manual)
    const { data: pausados } = await supabaseAdmin
      .from("motoristas")
      .select("codigo")
      .in("codigo", candidatosCodigos)
      .eq("pausado", true);
    const pausadosSet = new Set((pausados ?? []).map((p) => p.codigo));

    // Exclui motoristas com corrida ativa (evita aceitar várias e cancelar)
    const STATUS_ATIVOS = [
      "Aceita",
      "A caminho",
      "Chegou",
      "Em viagem",
      "Parada",
    ];
    const { data: ocupados } = await supabaseAdmin
      .from("corridas")
      .select("motorista_codigo")
      .in("motorista_codigo", candidatosCodigos)
      .in("status", STATUS_ATIVOS as any);
    const ocupadosSet = new Set(
      (ocupados ?? []).map((o) => o.motorista_codigo).filter(Boolean) as string[],
    );

    candidatosCodigos = candidatosCodigos.filter(
      (c) => !pausadosSet.has(c) && !ocupadosSet.has(c),
    );
    if (candidatosCodigos.length === 0) {
      return {
        ok: true,
        ofertados: 0,
        motivo: "nenhum motorista disponível (pausados ou em corrida)",
      };
    }

    // Já ofertados (não duplicar)
    // - Reoferta: só exclui motoristas com oferta ativa (pendente/aceita) — expiradas/recusadas podem receber de novo
    // - Oferta inicial: exclui todos que já tenham qualquer registro de oferta nessa corrida
    const ofertasQuery = supabaseAdmin
      .from("corrida_ofertas")
      .select("motorista_codigo,status")
      .eq("corrida_id", corridaId);
    const { data: jaOfertados } = reofertar
      ? await ofertasQuery.in("status", ["pendente", "aceita"])
      : await ofertasQuery;
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
        .slice(0, qtd)
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

// ─── Expirar oferta (chamado pelo app do motorista após 30s) ──────
// Se não restar nenhuma oferta pendente para a corrida, dispara automaticamente
// uma nova rodada (reoferta) para os próximos motoristas mais próximos.
export const expirarOferta = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      ofertaId: z.number().int().positive(),
      corridaId: z.number().int().positive(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    // marca esta oferta como expirada (só se ainda estiver pendente)
    await supabaseAdmin
      .from("corrida_ofertas")
      .update({ status: "expirada" })
      .eq("id", data.ofertaId)
      .eq("status", "pendente");

    // verifica estado atual da corrida e se restam ofertas pendentes
    const { data: corrida } = await supabaseAdmin
      .from("corridas")
      .select("id, status, rodada_atual")
      .eq("id", data.corridaId)
      .maybeSingle();
    if (!corrida) return { ok: true, reofertou: false };
    if (corrida.status !== "Ofertada" && corrida.status !== "Pendente") {
      return { ok: true, reofertou: false };
    }

    const { count } = await supabaseAdmin
      .from("corrida_ofertas")
      .select("id", { count: "exact", head: true })
      .eq("corrida_id", data.corridaId)
      .eq("status", "pendente");

    if ((count ?? 0) > 0) return { ok: true, reofertou: false };

    // Nenhuma pendente: dispara próxima rodada automaticamente
    try {
      await supabaseAdmin
        .from("corridas")
        .update({ rodada_atual: (corrida.rodada_atual ?? 1) + 1, status: "Pendente" })
        .eq("id", data.corridaId);

      // chama lógica interna de oferta reaproveitando o handler
      await (dispararOfertas as any)({ data: { corridaId: data.corridaId, reofertar: true } });
      return { ok: true, reofertou: true };
    } catch {
      return { ok: true, reofertou: false };
    }
  });


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

// ─── Lançar corrida agendada imediatamente ───────────────────────
export const lancarCorridaAgendada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ corridaId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: c } = await supabaseAdmin
      .from("corridas")
      .select("id, motorista_codigo, motoristas_manuais")
      .eq("id", data.corridaId)
      .maybeSingle();
    if (!c) throw new Error("Corrida não encontrada");

    const updates: any = { modelo: "Imediata", status: "Pendente" };
    if (c.motorista_codigo && (!c.motoristas_manuais || c.motoristas_manuais.length === 0)) {
      updates.despacho = "Manual";
      updates.motoristas_manuais = [c.motorista_codigo];
    }

    const { error } = await supabaseAdmin
      .from("corridas")
      .update(updates)
      .eq("id", data.corridaId);
    if (error) throw new Error(error.message);

    await registrarLog(data.corridaId, "Lançada manualmente", null, "Operador lançou corrida agendada");
    return { ok: true };
  });
