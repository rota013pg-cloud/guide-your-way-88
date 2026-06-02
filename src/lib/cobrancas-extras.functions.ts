/**
 * Cobranças extras do motorista (camiseta, itens, manutenção, etc).
 * - Item de cobrança = "dívida" com valor_total e valor_parcela_dia (sugestão).
 * - Lançamentos = pagamentos parciais. Trigger no DB atualiza status automaticamente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CATEGORIAS = [
  "uniforme",
  "itens_cliente",
  "manutencao",
  "equipamento",
  "multa",
  "adiantamento",
  "outros",
] as const;
const FORMAS = ["por_dia", "parcela_fixa", "avulsa"] as const;

function operadorFrom(context: { claims?: Record<string, unknown> | null; userId?: string | null }) {
  const email = (context.claims?.email as string | undefined) ?? undefined;
  return email ?? context.userId ?? "Painel";
}

// ─── CRIAR cobrança ───────────────────────────────────────
export const criarCobrancaExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      motoristaCodigo: z.string().min(1).max(20),
      descricao: z.string().min(1).max(200),
      categoria: z.enum(CATEGORIAS).default("outros"),
      formaCobranca: z.enum(FORMAS).default("por_dia"),
      valorTotal: z.number().positive(),
      valorParcelaDia: z.number().min(0).default(0),
      observacoes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: mot } = await supabaseAdmin
      .from("motoristas")
      .select("codigo")
      .eq("codigo", data.motoristaCodigo)
      .maybeSingle();
    if (!mot) throw new Error("Motorista não encontrado");

    const { data: inserido, error } = await supabaseAdmin
      .from("motorista_cobrancas_extras")
      .insert({
        motorista_codigo: data.motoristaCodigo,
        descricao: data.descricao,
        categoria: data.categoria,
        forma_cobranca: data.formaCobranca,
        valor_total: data.valorTotal,
        valor_parcela_dia: data.valorParcelaDia,
        observacoes: data.observacoes ?? null,
        operador: operadorFrom(context),
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, registro: inserido };
  });

// ─── LISTAR todas as cobranças (com saldo) ────────────────
export const listarCobrancasExtras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      motoristaCodigo: z.string().min(1).max(20).optional(),
      somenteAbertas: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("motorista_cobrancas_extras")
      .select("*")
      .order("criado_em", { ascending: false });
    if (data.motoristaCodigo) q = q.eq("motorista_codigo", data.motoristaCodigo);
    if (data.somenteAbertas) q = q.eq("status", "aberta");
    const { data: itens, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (itens ?? []).map((i) => i.id);
    let lancamentosByCobranca = new Map<number, number>();
    if (ids.length) {
      const { data: lancs } = await supabaseAdmin
        .from("motorista_cobranca_lancamentos")
        .select("cobranca_id, valor")
        .in("cobranca_id", ids);
      for (const l of lancs ?? []) {
        const cur = lancamentosByCobranca.get(l.cobranca_id) ?? 0;
        lancamentosByCobranca.set(l.cobranca_id, cur + Number(l.valor));
      }
    }

    return {
      itens: (itens ?? []).map((i) => {
        const pago = lancamentosByCobranca.get(i.id) ?? 0;
        const total = Number(i.valor_total);
        return {
          ...i,
          valor_total: total,
          valor_parcela_dia: Number(i.valor_parcela_dia),
          valor_pago: pago,
          saldo: Math.max(0, total - pago),
        };
      }),
    };
  });

// ─── EXTRATO de uma cobrança ──────────────────────────────
export const extratoCobrancaExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cobrancaId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { data: item } = await supabaseAdmin
      .from("motorista_cobrancas_extras")
      .select("*")
      .eq("id", data.cobrancaId)
      .maybeSingle();
    if (!item) throw new Error("Cobrança não encontrada");
    const { data: lancs } = await supabaseAdmin
      .from("motorista_cobranca_lancamentos")
      .select("*")
      .eq("cobranca_id", data.cobrancaId)
      .order("data", { ascending: false });
    const pago = (lancs ?? []).reduce((s, l) => s + Number(l.valor), 0);
    return {
      item: { ...item, valor_pago: pago, saldo: Math.max(0, Number(item.valor_total) - pago) },
      lancamentos: lancs ?? [],
    };
  });

// ─── LANÇAR pagamento parcial ─────────────────────────────
export const lancarPagamentoCobrancaExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      cobrancaId: z.number().int().positive(),
      valor: z.number().positive(),
      observacoes: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: item } = await supabaseAdmin
      .from("motorista_cobrancas_extras")
      .select("motorista_codigo, status")
      .eq("id", data.cobrancaId)
      .maybeSingle();
    if (!item) throw new Error("Cobrança não encontrada");
    if (item.status === "cancelada") throw new Error("Cobrança cancelada");
    const { data: inserido, error } = await supabaseAdmin
      .from("motorista_cobranca_lancamentos")
      .insert({
        cobranca_id: data.cobrancaId,
        motorista_codigo: item.motorista_codigo,
        valor: data.valor,
        operador: operadorFrom(context),
        observacoes: data.observacoes ?? null,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, registro: inserido };
  });

// ─── REMOVER lançamento ───────────────────────────────────
export const removerLancamentoCobrancaExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("motorista_cobranca_lancamentos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── CANCELAR cobrança ────────────────────────────────────
export const cancelarCobrancaExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cobrancaId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("motorista_cobrancas_extras")
      .update({ status: "cancelada", atualizado_em: new Date().toISOString() })
      .eq("id", data.cobrancaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── LISTAR ABERTAS para o motorista (público via token) ──
export const motoristaListarCobrancasExtras = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string().min(1).max(20),
      token: z.string().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: sess } = await supabaseAdmin
      .from("motorista_sessoes")
      .select("motorista_codigo, status")
      .eq("token", data.token)
      .eq("motorista_codigo", data.codigo)
      .maybeSingle();
    if (!sess || sess.status !== "ativa") throw new Error("Sessão inválida");

    const { data: itens } = await supabaseAdmin
      .from("motorista_cobrancas_extras")
      .select("*")
      .eq("motorista_codigo", data.codigo)
      .neq("status", "cancelada")
      .order("status", { ascending: true })
      .order("criado_em", { ascending: false });

    const ids = (itens ?? []).map((i) => i.id);
    let lancsMap = new Map<number, { valor: number; data: string }[]>();
    if (ids.length) {
      const { data: lancs } = await supabaseAdmin
        .from("motorista_cobranca_lancamentos")
        .select("cobranca_id, valor, data")
        .in("cobranca_id", ids)
        .order("data", { ascending: false });
      for (const l of lancs ?? []) {
        const arr = lancsMap.get(l.cobranca_id) ?? [];
        arr.push({ valor: Number(l.valor), data: l.data });
        lancsMap.set(l.cobranca_id, arr);
      }
    }

    return {
      itens: (itens ?? []).map((i) => {
        const lancs = lancsMap.get(i.id) ?? [];
        const pago = lancs.reduce((s, l) => s + l.valor, 0);
        const total = Number(i.valor_total);
        return {
          id: i.id,
          descricao: i.descricao,
          categoria: i.categoria,
          forma_cobranca: i.forma_cobranca,
          valor_total: total,
          valor_parcela_dia: Number(i.valor_parcela_dia),
          valor_pago: pago,
          saldo: Math.max(0, total - pago),
          status: i.status,
          criado_em: i.criado_em,
          lancamentos: lancs,
        };
      }),
    };
  });
