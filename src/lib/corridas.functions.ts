/**
 * Server functions de corridas — disparo de ofertas para motoristas.
 *
 * Quando uma corrida é criada (status = Pendente), buscamos os motoristas
 * Online (top 5 mais próximos por GPS, se houver) e inserimos linhas em
 * corrida_ofertas. O app do motorista escuta essa tabela via Realtime e
 * mostra o modal de oferta automaticamente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export const dispararOfertas = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ corridaId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { corridaId } = data;

    const { data: corrida, error: corridaErr } = await supabaseAdmin
      .from("corridas")
      .select("id, status, origem_lat, origem_lng")
      .eq("id", corridaId)
      .maybeSingle();
    if (corridaErr) throw new Error(corridaErr.message);
    if (!corrida) throw new Error("Corrida não encontrada");
    if (corrida.status !== "Pendente") {
      return { ok: true, ofertados: 0, motivo: "corrida não está pendente" };
    }

    const { data: motoristas, error: motErr } = await supabaseAdmin
      .from("motoristas")
      .select("codigo, nome")
      .eq("status", "Online");
    if (motErr) throw new Error(motErr.message);
    if (!motoristas || motoristas.length === 0) {
      return { ok: true, ofertados: 0, motivo: "nenhum motorista online" };
    }

    // Já ofertados
    const { data: jaOfertados } = await supabaseAdmin
      .from("corrida_ofertas")
      .select("motorista_codigo")
      .eq("corrida_id", corridaId);
    const jaSet = new Set((jaOfertados ?? []).map((o) => o.motorista_codigo));

    // GPS mais recente de cada motorista
    const codigos = motoristas.map((m) => m.codigo).filter((c) => !jaSet.has(c));
    if (codigos.length === 0) {
      return { ok: true, ofertados: 0, motivo: "todos já ofertados" };
    }

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

    const origemLat = corrida.origem_lat ? Number(corrida.origem_lat) : LAT_BASE;
    const origemLng = corrida.origem_lng ? Number(corrida.origem_lng) : LNG_BASE;

    const candidatos = codigos
      .map((codigo) => {
        const g = gpsMap.get(codigo);
        const lat = g?.lat ?? LAT_BASE;
        const lng = g?.lng ?? LNG_BASE;
        return {
          motorista_codigo: codigo,
          distancia: haversine(lat, lng, origemLat, origemLng),
        };
      })
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, QTD_MOT);

    const rows = candidatos.map((c) => ({
      corrida_id: corridaId,
      motorista_codigo: c.motorista_codigo,
      status: "pendente",
    }));

    const { error: insErr } = await supabaseAdmin
      .from("corrida_ofertas")
      .insert(rows);
    if (insErr) throw new Error(insErr.message);

    return { ok: true, ofertados: rows.length };
  });
