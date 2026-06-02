/**
 * Server functions do módulo Financeiro.
 * Regras:
 * - "Diária" é única por (motorista_codigo, tipo='Diária', dia_op) — uniq_diaria_dia.
 * - dia_op é coluna gerada via dia_operacional(data) (corte 06h America/Sao_Paulo).
 * - valorDiaria vem de app_config.config_json.valorDiaria.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type FinRow = {
  id: number;
  motorista_codigo: string;
  motorista: string | null;
  valor: number;
  tipo: string;
  operador: string | null;
  data: string;
  dia_op: string | null;
};

async function lerValorDiaria(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("config_json")
    .eq("id", 1)
    .maybeSingle();
  const cfg = (data?.config_json ?? {}) as { valorDiaria?: number };
  return Number(cfg.valorDiaria ?? 19.9);
}

async function diaOperacionalHoje(): Promise<string> {
  const { data } = await supabaseAdmin.rpc("dia_operacional", { _ts: new Date().toISOString() });
  return data as unknown as string;
}

// ─── LISTAR FINANCEIRO DO DIA OPERACIONAL ─────────────────
export const listarFinanceiroHoje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const diaOp = await diaOperacionalHoje();
    const valorDiaria = await lerValorDiaria();

    const [{ data: motoristas }, { data: pagamentos }] = await Promise.all([
      supabaseAdmin
        .from("motoristas")
        .select("codigo, nome, telefone, status, creditos_diaria")
        .order("codigo"),
      supabaseAdmin
        .from("financeiro")
        .select("*")
        .eq("dia_op", diaOp)
        .order("data", { ascending: false }),
    ]);

    const pagamentosPorMot = new Map<string, FinRow[]>();
    for (const p of (pagamentos ?? []) as FinRow[]) {
      const arr = pagamentosPorMot.get(p.motorista_codigo) ?? [];
      arr.push(p);
      pagamentosPorMot.set(p.motorista_codigo, arr);
    }

    const linhas = (motoristas ?? []).map((m) => {
      const lista = pagamentosPorMot.get(m.codigo) ?? [];
      const diaria = lista.find((p) => p.tipo === "Diária");
      return {
        codigo: m.codigo,
        nome: m.nome,
        telefone: m.telefone,
        status: m.status,
        pago: !!diaria,
        valorPago: diaria ? Number(diaria.valor) : null,
        operador: diaria?.operador ?? null,
        pagamentoId: diaria?.id ?? null,
        data: diaria?.data ?? null,
      };
    });

    const total = (pagamentos ?? [])
      .filter((p) => p.tipo === "Diária")
      .reduce((s, p) => s + Number(p.valor), 0);

    return {
      diaOp,
      valorDiaria,
      linhas,
      total,
      pagas: linhas.filter((l) => l.pago).length,
      pendentes: linhas.filter((l) => !l.pago).length,
    };
  });

// ─── MARCAR DIÁRIA PAGA ───────────────────────────────────
export const marcarDiariaPaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      motoristaCodigo: z.string().min(1).max(20),
      valor: z.number().positive().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: mot } = await supabaseAdmin
      .from("motoristas")
      .select("codigo, nome")
      .eq("codigo", data.motoristaCodigo)
      .maybeSingle();
    if (!mot) throw new Error("Motorista não encontrado");

    const valor = data.valor ?? (await lerValorDiaria());

    const operador =
      (context.claims?.email as string | undefined) ??
      (context.userId as string | undefined) ??
      "Painel";

    const { data: inserido, error } = await supabaseAdmin
      .from("financeiro")
      .insert({
        motorista_codigo: mot.codigo,
        motorista: mot.nome,
        valor,
        tipo: "Diária",
        operador,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      // Conflito por uniq_diaria_dia => já existia
      if (error.code === "23505") {
        return { ok: true, jaExistia: true };
      }
      throw new Error(error.message);
    }
    return { ok: true, jaExistia: false, registro: inserido };
  });

// ─── REMOVER PAGAMENTO ────────────────────────────────────
export const removerPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("financeiro").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── RELATÓRIO POR PERÍODO (dia_op) ──────────────────────
export const relatorioFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("financeiro")
      .select("*")
      .gte("dia_op", data.de)
      .lte("dia_op", data.ate)
      .order("dia_op", { ascending: false })
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);

    const lista = (rows ?? []) as FinRow[];
    const total = lista.reduce((s, r) => s + Number(r.valor), 0);
    const totalDiarias = lista
      .filter((r) => r.tipo === "Diária")
      .reduce((s, r) => s + Number(r.valor), 0);
    const totalExtras = total - totalDiarias;

    // Ranking por motorista
    const porMot = new Map<string, { motorista: string; total: number; diarias: number; extras: number; qtd: number }>();
    for (const r of lista) {
      const key = r.motorista_codigo;
      const cur = porMot.get(key) ?? {
        motorista: r.motorista ?? r.motorista_codigo,
        total: 0,
        diarias: 0,
        extras: 0,
        qtd: 0,
      };
      cur.total += Number(r.valor);
      if (r.tipo === "Diária") cur.diarias += Number(r.valor);
      else cur.extras += Number(r.valor);
      cur.qtd += 1;
      porMot.set(key, cur);
    }
    const ranking = [...porMot.entries()]
      .map(([codigo, v]) => ({ codigo, ...v }))
      .sort((a, b) => b.total - a.total);

    return {
      de: data.de,
      ate: data.ate,
      registros: lista,
      total,
      totalDiarias,
      totalExtras,
      ranking,
    };
  });
