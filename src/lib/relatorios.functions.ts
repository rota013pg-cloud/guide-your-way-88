/**
 * Server functions de relatórios do painel (Rota 013).
 * Autenticadas como operador/admin via requireSupabaseAuth.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SessaoRow = {
  motorista_codigo: string;
  inicio: string;
  fim: string | null;
};

export type LinhaRankingOnline = {
  codigo: string;
  nome: string;
  online: boolean;
  totalSeg: number;
  sessoes: number;
  primeiroInicioIso: string | null;
  ultimoFimIso: string | null;
};

// ─── RELATÓRIO: TEMPO ONLINE DOS MOTOCICLISTAS ──────────
// Soma, dentro do período [de, ate], quanto tempo cada motociclista ficou
// online (status Online/Em corrida). Sessões ainda abertas contam até agora
// (limitado ao fim do período). Retorna um ranking do maior para o menor.
export const operadorRelatorioOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deIso: z.string(),
        ateIso: z.string(),
        motoristaCodigo: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const de = new Date(data.deIso).getTime();
    const ate = new Date(data.ateIso).getTime();
    const agora = Date.now();
    if (!Number.isFinite(de) || !Number.isFinite(ate) || ate < de) {
      throw new Error("Período inválido.");
    }

    // Mapa código -> nome/status (para o ranking e o "online agora").
    const { data: mots } = await supabaseAdmin
      .from("motoristas")
      .select("codigo, nome, status")
      .neq("status", "Excluido");
    const nomePorCod = new Map<string, string>();
    const onlineAgora = new Set<string>();
    for (const m of mots ?? []) {
      nomePorCod.set(m.codigo as string, (m.nome as string) ?? (m.codigo as string));
      if (m.status === "Online" || m.status === "Em corrida") onlineAgora.add(m.codigo as string);
    }

    // Sessões que cruzam o período: inicio <= ate E (fim is null OU fim >= de).
    // Pagina para não esbarrar no limite de 1000 linhas do PostgREST.
    const sessoes: SessaoRow[] = [];
    const PAGINA = 1000;
    for (let offset = 0; ; offset += PAGINA) {
      let q = supabaseAdmin
        .from("motorista_online_sessoes")
        .select("motorista_codigo, inicio, fim")
        .lte("inicio", new Date(ate).toISOString())
        .or(`fim.is.null,fim.gte.${new Date(de).toISOString()}`)
        .order("inicio", { ascending: true })
        .range(offset, offset + PAGINA - 1);
      if (data.motoristaCodigo) q = q.eq("motorista_codigo", data.motoristaCodigo);
      const { data: pagina, error } = await q;
      if (error) throw new Error(error.message);
      const linhas = (pagina ?? []) as SessaoRow[];
      sessoes.push(...linhas);
      if (linhas.length < PAGINA) break;
    }

    // Agrega por motorista, somando o overlap de cada sessão com [de, ate].
    type Acc = {
      totalSeg: number;
      sessoes: number;
      primeiroInicioMs: number | null;
      ultimoFimMs: number | null;
    };
    const acc = new Map<string, Acc>();
    for (const s of sessoes) {
      const inicioMs = new Date(s.inicio).getTime();
      const fimMs = s.fim ? new Date(s.fim).getTime() : Math.min(agora, ate);
      const ini = Math.max(inicioMs, de);
      const fim = Math.min(fimMs, ate);
      const seg = Math.max(0, Math.floor((fim - ini) / 1000));
      const cur =
        acc.get(s.motorista_codigo) ??
        { totalSeg: 0, sessoes: 0, primeiroInicioMs: null, ultimoFimMs: null };
      cur.totalSeg += seg;
      cur.sessoes += 1;
      if (cur.primeiroInicioMs === null || inicioMs < cur.primeiroInicioMs) {
        cur.primeiroInicioMs = inicioMs;
      }
      if (s.fim) {
        const f = new Date(s.fim).getTime();
        if (cur.ultimoFimMs === null || f > cur.ultimoFimMs) cur.ultimoFimMs = f;
      }
      acc.set(s.motorista_codigo, cur);
    }

    const ranking: LinhaRankingOnline[] = [...acc.entries()]
      .map(([codigo, a]) => ({
        codigo,
        nome: nomePorCod.get(codigo) ?? codigo,
        online: onlineAgora.has(codigo),
        totalSeg: a.totalSeg,
        sessoes: a.sessoes,
        primeiroInicioIso: a.primeiroInicioMs ? new Date(a.primeiroInicioMs).toISOString() : null,
        ultimoFimIso: a.ultimoFimMs ? new Date(a.ultimoFimMs).toISOString() : null,
      }))
      .sort((x, y) => y.totalSeg - x.totalSeg);

    const totalGeralSeg = ranking.reduce((s, r) => s + r.totalSeg, 0);

    return { de: data.deIso, ate: data.ateIso, ranking, totalGeralSeg };
  });
