/**
 * Server functions de corridas — disparo de ofertas, log de status e listagens.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enviarPushMotorista } from "@/lib/push.server";

const QTD_MOT = 5;
const MAX_RODADAS = 5;
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

async function _executarDispararOfertas(
  corridaId: number,
  qtd: number,
  reofertar: boolean,
) {



    const { data: corrida, error: corridaErr } = await supabaseAdmin
      .from("corridas")
      .select(
        "id, status, origem, origem_lat, origem_lng, despacho, modelo, motoristas_manuais, valor_final",
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
      // Raio máximo (km) configurável no painel; 0 = sem limite.
      const { data: cfgRow } = await supabaseAdmin
        .from("app_config")
        .select("config_json")
        .eq("id", 1)
        .maybeSingle();
      const raioMaxKm = Number(
        (cfgRow?.config_json as { raioMaxKm?: number } | null)?.raioMaxKm ?? 15,
      );

      // Ordena por proximidade da PARTIDA e pega top N (dentro do raio, se houver)
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
          // Sem GPS recente: com raio ativo a distância é desconhecida (fica de fora);
          // sem raio, mantém o comportamento antigo (usa a base como aproximação).
          const distancia = g
            ? haversine(g.lat, g.lng, origemLat, origemLng)
            : raioMaxKm > 0
              ? Infinity
              : haversine(LAT_BASE, LNG_BASE, origemLat, origemLng);
          return { codigo, distancia };
        })
        .filter((c) => raioMaxKm <= 0 || c.distancia <= raioMaxKm)
        .sort((a, b) => a.distancia - b.distancia)
        .slice(0, qtd)
        .map((c) => c.codigo);

      // Ninguém dentro do raio → trata como "sem motociclista por perto"
      // (o wrapper encerra a corrida e avisa o cliente).
      if (codigosFinais.length === 0) {
        return { ok: true, ofertados: 0, motivo: "nenhum motociclista dentro do raio" };
      }
    }

    const rows = codigosFinais.map((codigo) => ({
      corrida_id: corridaId,
      motorista_codigo: codigo,
      status: "pendente",
      criado_em: new Date().toISOString(),
    }));

    const { error: insErr } = await supabaseAdmin
      .from("corrida_ofertas")
      .upsert(rows, { onConflict: "corrida_id,motorista_codigo" });
    if (insErr) throw new Error(insErr.message);

    // Push: avisa os motociclistas que receberam a oferta (não bloqueia o fluxo)
    const valor = corrida.valor_final != null ? ` — R$ ${Number(corrida.valor_final).toFixed(2)}` : "";
    void enviarPushMotorista(codigosFinais, {
      title: "🏍️ Nova corrida disponível",
      body: `${corrida.origem ?? "Nova corrida"}${valor}`,
      data: { tipo: "corrida", corridaId: String(corridaId) },
    });

    await supabaseAdmin
      .from("corridas")
      .update({ status: "Ofertada" })
      .eq("id", corridaId);
    await registrarLog(corridaId, `Ofertada (${corrida.despacho})`);

    return { ok: true, ofertados: rows.length, modo: corrida.despacho };
}

export const dispararOfertas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      corridaId: z.number().int().positive(),
      quantidade: z.number().int().min(1).max(50).optional(),
      reofertar: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) =>
    _executarDispararOfertas(data.corridaId, data.quantidade ?? QTD_MOT, data.reofertar ?? false),
  );

// Variante para o app do cliente: valida o cliente_token e exige que a
// corrida pertença ao cliente antes de disparar (usado no fluxo de
// modo automático após cliente_solicitar_corrida).
export const dispararOfertasCliente = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      clienteToken: z.string().min(10),
      corridaId: z.number().int().positive(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: sess } = await supabaseAdmin
      .from("cliente_sessoes")
      .select("cliente_codigo")
      .eq("token", data.clienteToken)
      .eq("status", "ativa")
      .maybeSingle();
    if (!sess) throw new Error("Sessão inválida");
    const { data: c } = await supabaseAdmin
      .from("corridas")
      .select("cliente_codigo")
      .eq("id", data.corridaId)
      .maybeSingle();
    if (!c || c.cliente_codigo !== sess.cliente_codigo) {
      throw new Error("Corrida não pertence ao cliente");
    }
    const r = (await _executarDispararOfertas(data.corridaId, QTD_MOT, false)) as {
      ok: boolean; ofertados: number; modo?: string; motivo?: string;
    };
    // Nenhum motociclista online/disponível por perto → encerra a corrida e
    // avisa o cliente (não deixa "Procurando..." pra sempre).
    if (r.ofertados === 0 && !r.modo) {
      await supabaseAdmin.from("corridas").update({ status: "Cancelada" } as never).eq("id", data.corridaId);
      await registrarLog(data.corridaId, "Não aceita", null, "Nenhum motociclista online no momento da solicitação");
      return { ok: true, ofertados: 0, semMotorista: true };
    }
    return { ok: true, ofertados: r.ofertados, semMotorista: false };
  });

// ─── Revisão de ofertas "fantasma" ────────────────────────────────
// Corrige o caso em que a corrida fica "Ofertada" para um motociclista que
// saiu do ar (fechou o app / perdeu conexão) sem o app chamar expirarOferta.
// Expira ofertas pendentes cujo motociclista NÃO está mais disponível (offline,
// pausado, em corrida) ou cuja oferta já está velha; se não sobrar ninguém
// pendente, reoferta (se ainda há rodada) ou encerra avisando "sem motociclista".
// É ADITIVA: não altera o fluxo normal (aceite / expirarOferta do motorista).
async function _revisarOfertasParadas(
  corridaId: number,
): Promise<{ semMotorista: boolean }> {
  const { data: corrida } = await supabaseAdmin
    .from("corridas")
    .select("id, status, rodada_atual")
    .eq("id", corridaId)
    .maybeSingle();
  if (!corrida) return { semMotorista: false };
  if (corrida.status !== "Ofertada" && corrida.status !== "Pendente") {
    return { semMotorista: false };
  }

  const { data: pend } = await supabaseAdmin
    .from("corrida_ofertas")
    .select("id, motorista_codigo, criado_em")
    .eq("corrida_id", corridaId)
    .eq("status", "pendente");
  const pendentes = pend ?? [];

  if (pendentes.length > 0) {
    const codigos = Array.from(new Set(pendentes.map((o) => o.motorista_codigo as string)));
    // Motoristas dessas ofertas que ainda estão realmente online e livres
    const { data: disp } = await supabaseAdmin
      .from("motoristas")
      .select("codigo")
      .in("codigo", codigos)
      .eq("status", "Online")
      .eq("pausado", false);
    const dispSet = new Set((disp ?? []).map((m) => m.codigo as string));
    const { data: ocup } = await supabaseAdmin
      .from("corridas")
      .select("motorista_codigo")
      .in("motorista_codigo", codigos)
      .in("status", ["Aceita", "A caminho", "Chegou", "Em viagem", "Parada"] as never);
    const ocupSet = new Set(
      (ocup ?? []).map((o) => o.motorista_codigo).filter(Boolean) as string[],
    );

    const limiteVelho = Date.now() - 45_000; // pendente há mais de 45s = presa
    const expirar = pendentes
      .filter((o) => {
        const disponivel =
          dispSet.has(o.motorista_codigo as string) && !ocupSet.has(o.motorista_codigo as string);
        const velha = new Date(o.criado_em as string).getTime() < limiteVelho;
        return !disponivel || velha;
      })
      .map((o) => o.id as number);

    if (expirar.length > 0) {
      await supabaseAdmin
        .from("corrida_ofertas")
        .update({ status: "expirada" } as never)
        .in("id", expirar)
        .eq("status", "pendente");
    }
  }

  // Ainda resta alguma oferta pendente (com motorista disponível)? segue aguardando.
  const { count } = await supabaseAdmin
    .from("corrida_ofertas")
    .select("id", { count: "exact", head: true })
    .eq("corrida_id", corridaId)
    .eq("status", "pendente");
  if ((count ?? 0) > 0) return { semMotorista: false };

  // Ninguém pendente → reoferta (se ainda há rodada) ou encerra.
  if ((corrida.rodada_atual ?? 1) >= MAX_RODADAS) {
    await supabaseAdmin.from("corridas").update({ status: "Cancelada" } as never).eq("id", corridaId);
    await registrarLog(corridaId, "Não aceita", null, `Encerrada por inatividade após ${MAX_RODADAS} rodadas`);
    return { semMotorista: true };
  }
  const novaRodada = (corrida.rodada_atual ?? 1) + 1;
  await supabaseAdmin
    .from("corridas")
    .update({ rodada_atual: novaRodada, status: "Pendente" } as never)
    .eq("id", corridaId);
  await registrarLog(corridaId, "Reofertando", null, `Ofertas expiradas — rodada ${novaRodada}`);
  const quantidade = novaRodada >= 2 ? 10 : QTD_MOT;
  const rr = (await _executarDispararOfertas(corridaId, quantidade, true)) as {
    ofertados: number;
  };
  if ((rr.ofertados ?? 0) === 0) {
    await supabaseAdmin.from("corridas").update({ status: "Cancelada" } as never).eq("id", corridaId);
    await registrarLog(corridaId, "Não aceita", null, "Nenhum motociclista disponível na reoferta");
    return { semMotorista: true };
  }
  return { semMotorista: false };
}

// Chamado periodicamente pelo APP DO CLIENTE enquanto ele espera (corrida
// Pendente/Ofertada). Valida a sessão e a posse da corrida e revisa as ofertas.
export const clienteRevisarCorrida = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ clienteToken: z.string().min(10), corridaId: z.number().int().positive() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: sess } = await supabaseAdmin
      .from("cliente_sessoes")
      .select("cliente_codigo")
      .eq("token", data.clienteToken)
      .eq("status", "ativa")
      .maybeSingle();
    if (!sess) throw new Error("Sessão inválida");
    const { data: c } = await supabaseAdmin
      .from("corridas")
      .select("cliente_codigo")
      .eq("id", data.corridaId)
      .maybeSingle();
    if (!c || c.cliente_codigo !== sess.cliente_codigo) {
      throw new Error("Corrida não pertence ao cliente");
    }
    return await _revisarOfertasParadas(data.corridaId);
  });

// ─── Expirar oferta (chamado pelo app do motorista após 30s) ──────
// Se não restar nenhuma oferta pendente para a corrida, dispara automaticamente
// uma nova rodada (reoferta) para os próximos motoristas mais próximos.
export const expirarOferta = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      ofertaId: z.number().int().positive(),
      corridaId: z.number().int().positive(),
      codigo: z.string().min(1),
      token: z.string().min(10),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    // Valida sessão do motorista
    const { data: sess } = await supabaseAdmin
      .from("motorista_sessoes")
      .select("motorista_codigo")
      .eq("token", data.token)
      .eq("motorista_codigo", data.codigo)
      .eq("status", "ativa")
      .maybeSingle();
    if (!sess) throw new Error("Sessão inválida");

    // Garante que a oferta a expirar é do motorista chamador
    const { data: ofertaRow } = await supabaseAdmin
      .from("corrida_ofertas")
      .select("id, motorista_codigo, corrida_id")
      .eq("id", data.ofertaId)
      .maybeSingle();
    if (!ofertaRow || ofertaRow.motorista_codigo !== data.codigo || ofertaRow.corrida_id !== data.corridaId) {
      throw new Error("Oferta não pertence ao motorista");
    }

    await supabaseAdmin
      .from("corrida_ofertas")
      .update({ status: "expirada" })
      .eq("id", data.ofertaId)
      .eq("status", "pendente");

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

    // Limite de rodadas: após MAX_RODADAS sem ninguém aceitar, encerra e registra.
    if ((corrida.rodada_atual ?? 1) >= MAX_RODADAS) {
      await supabaseAdmin.from("corridas").update({ status: "Cancelada" } as never).eq("id", data.corridaId);
      await registrarLog(
        data.corridaId,
        "Não aceita",
        null,
        `Nenhum motociclista aceitou após ${MAX_RODADAS} rodadas`,
      );
      return { ok: true, reofertou: false, encerrou: true };
    }

    const novaRodada = (corrida.rodada_atual ?? 1) + 1;
    try {
      await supabaseAdmin
        .from("corridas")
        .update({ rodada_atual: novaRodada, status: "Pendente" })
        .eq("id", data.corridaId);

      await registrarLog(
        data.corridaId,
        "Reofertando",
        null,
        `Nenhum motorista aceitou — iniciando rodada ${novaRodada}`,
      );

      const quantidade = novaRodada >= 2 ? 10 : QTD_MOT;
      const rr = (await _executarDispararOfertas(data.corridaId, quantidade, true)) as { ofertados: number };
      // Não há mais motociclistas novos para ofertar e nenhuma oferta pendente → encerra.
      if ((rr.ofertados ?? 0) === 0) {
        await supabaseAdmin.from("corridas").update({ status: "Cancelada" } as never).eq("id", data.corridaId);
        await registrarLog(data.corridaId, "Não aceita", null, "Sem motociclistas disponíveis para reoferta");
        return { ok: true, reofertou: false, encerrou: true };
      }
      return { ok: true, reofertou: true, rodada: novaRodada };
    } catch (e) {
      await registrarLog(data.corridaId, "Falha reoferta", null, String((e as Error)?.message ?? e));
      return { ok: true, reofertou: false };
    }
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

// ─── Painel: corridas que NÃO foram aceitas (nenhum motociclista aceitou) ──
// Fonte: eventos "Não aceita" no corrida_status_log + as ofertas já gravadas
// em corrida_ofertas (mostra a quais motociclistas foi ofertada e a resposta).
type OfertaNaoAceita = { codigo: string; nome: string; status: string; quando: string };
type CorridaNaoAceita = {
  corridaId: number; quando: string; motivo: string; cliente: string;
  origem: string | null; destino: string | null; valor: number | null;
  rodadas: number | null; ofertas: OfertaNaoAceita[];
};

export const operadorListarCorridasNaoAceitas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limite: z.number().int().min(1).max(200).optional().default(60) }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { data: logs } = await supabaseAdmin
      .from("corrida_status_log")
      .select("corrida_id, observacao, criado_em")
      .eq("status", "Não aceita")
      .order("criado_em", { ascending: false })
      .limit(data.limite);
    const rows = (logs ?? []) as Array<{ corrida_id: number; observacao: string | null; criado_em: string }>;
    const ids = Array.from(new Set(rows.map((l) => l.corrida_id)));
    if (ids.length === 0) return { corridas: [] as CorridaNaoAceita[] };

    const { data: corridas } = await supabaseAdmin
      .from("corridas")
      .select("id, cliente, origem, destino, valor_final, rodada_atual")
      .in("id", ids as never);
    const cMap = new Map((corridas ?? []).map((c) => [c.id as number, c]));

    const { data: ofertas } = await supabaseAdmin
      .from("corrida_ofertas")
      .select("corrida_id, motorista_codigo, status, criado_em")
      .in("corrida_id", ids as never)
      .order("criado_em", { ascending: true });
    const ofertasRows = (ofertas ?? []) as Array<{ corrida_id: number; motorista_codigo: string; status: string; criado_em: string }>;

    const codigos = Array.from(new Set(ofertasRows.map((o) => o.motorista_codigo)));
    const { data: motos } = codigos.length
      ? await supabaseAdmin.from("motoristas").select("codigo, nome").in("codigo", codigos as never)
      : { data: [] as Array<{ codigo: string; nome: string }> };
    const nomeMap = new Map((motos ?? []).map((m) => [m.codigo as string, m.nome as string]));

    const lista: CorridaNaoAceita[] = ids.map((id) => {
      const c = cMap.get(id) as {
        cliente?: string | null; origem?: string | null; destino?: string | null;
        valor_final?: number | null; rodada_atual?: number | null;
      } | undefined;
      const log = rows.find((l) => l.corrida_id === id);
      const ofs: OfertaNaoAceita[] = ofertasRows
        .filter((o) => o.corrida_id === id)
        .map((o) => ({
          codigo: o.motorista_codigo,
          nome: nomeMap.get(o.motorista_codigo) ?? o.motorista_codigo,
          status: o.status,
          quando: o.criado_em,
        }));
      return {
        corridaId: id,
        quando: log?.criado_em ?? "",
        motivo: log?.observacao ?? "Não aceita",
        cliente: c?.cliente ?? "Cliente",
        origem: c?.origem ?? null,
        destino: c?.destino ?? null,
        valor: c?.valor_final ?? null,
        rodadas: c?.rodada_atual ?? null,
        ofertas: ofs,
      };
    });
    return { corridas: lista };
  });
