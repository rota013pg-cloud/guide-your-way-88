/**
 * KPIs do dashboard — janela de 7 dias.
 *  - tempoMedioAtendimento: do criado_em ao primeiro status 'Aceita' (s)
 *  - tempoMedioDistribuicao: do criado_em à primeira oferta (s)
 *  - taxaCancelamento: % de corridas Canceladas / total no período
 *  - ocorrenciasPorNivel: contagem por nivel 1..4
 *  - inadimplenciaHoje: nº de motoristas com cobrança Bloqueado / Aguardando hoje
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getDashboardKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: corridas } = await supabaseAdmin
      .from("corridas")
      .select("id,status,criado_em")
      .gte("criado_em", desde);

    const ids = (corridas ?? []).map((c) => c.id);
    const total = ids.length;
    const canceladas = (corridas ?? []).filter((c) => c.status === "Cancelada").length;

    let tempoMedioAtendimento = 0;
    let tempoMedioDistribuicao = 0;

    if (ids.length) {
      // Primeira oferta por corrida
      const { data: ofertas } = await supabaseAdmin
        .from("corrida_ofertas")
        .select("corrida_id,criado_em")
        .in("corrida_id", ids)
        .order("criado_em", { ascending: true });
      const primeiraOferta = new Map<number, string>();
      for (const o of ofertas ?? []) {
        if (!primeiraOferta.has(o.corrida_id)) primeiraOferta.set(o.corrida_id, o.criado_em);
      }

      // Primeira aceita por corrida
      const { data: logs } = await supabaseAdmin
        .from("corrida_status_log")
        .select("corrida_id,status,criado_em")
        .in("corrida_id", ids)
        .eq("status", "Aceita")
        .order("criado_em", { ascending: true });
      const primeiraAceita = new Map<number, string>();
      for (const l of logs ?? []) {
        if (!primeiraAceita.has(l.corrida_id)) primeiraAceita.set(l.corrida_id, l.criado_em);
      }

      const criadoEm = new Map((corridas ?? []).map((c) => [c.id, c.criado_em]));
      const difsAt: number[] = [];
      const difsDist: number[] = [];
      for (const id of ids) {
        const c = criadoEm.get(id);
        if (!c) continue;
        const t0 = new Date(c).getTime();
        const aceita = primeiraAceita.get(id);
        if (aceita) difsAt.push((new Date(aceita).getTime() - t0) / 1000);
        const oferta = primeiraOferta.get(id);
        if (oferta) difsDist.push((new Date(oferta).getTime() - t0) / 1000);
      }
      if (difsAt.length) tempoMedioAtendimento = Math.round(difsAt.reduce((a, b) => a + b, 0) / difsAt.length);
      if (difsDist.length) tempoMedioDistribuicao = Math.round(difsDist.reduce((a, b) => a + b, 0) / difsDist.length);
    }

    // Ocorrências por nível
    const { data: ocor } = await supabaseAdmin
      .from("ocorrencias_pessoa")
      .select("nivel")
      .gte("criado_em", desde);
    const ocorrenciasPorNivel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const o of ocor ?? []) {
      const n = Number(o.nivel);
      if (n >= 1 && n <= 4) ocorrenciasPorNivel[n] = (ocorrenciasPorNivel[n] ?? 0) + 1;
    }

    // Inadimplência hoje (dia_op)
    const { data: dia } = await supabaseAdmin.rpc("dia_operacional", { _ts: new Date().toISOString() });
    const { data: cobr } = await supabaseAdmin
      .from("motorista_cobranca")
      .select("status")
      .eq("dia_op", dia as unknown as string)
      .in("status", ["Bloqueado", "Aguardando", "Pendente"]);
    const inadimplenciaHoje = (cobr ?? []).length;

    return {
      total,
      canceladas,
      taxaCancelamento: total ? Math.round((canceladas / total) * 1000) / 10 : 0,
      tempoMedioAtendimento,
      tempoMedioDistribuicao,
      ocorrenciasPorNivel,
      inadimplenciaHoje,
    };
  });
