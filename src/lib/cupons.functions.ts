/**
 * Cupons de desconto para corridas.
 * - CRUD no painel (operador/admin, via requireSupabaseAuth).
 * - registrarUsoCupom: chamado pelo app do cliente (token) logo após criar a
 *   corrida, para gravar o desconto na corrida e contabilizar o uso.
 *
 * O desconto em si é calculado na cotação (cliente-cotacao.functions.ts). O
 * crédito de diária (compensação ao motociclista) é aplicado por trigger no
 * banco quando a corrida é FINALIZADA (migração 20260824100000_cupons.sql).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── LISTAR (painel) ────────────────────────────────────
export const listarCupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("cupons")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── CRIAR / EDITAR (painel) ────────────────────────────
const CupomSchema = z.object({
  id: z.number().optional(),
  codigo: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use letras, números, . _ -"),
  descontoPct: z.number().positive().max(100),
  aplicacao: z.enum(["automatico", "manual"]),
  limiteUsos: z.number().int().positive().max(1_000_000).nullable().optional(),
  validoDe: z.string().nullable().optional(),
  validoAte: z.string().nullable().optional(),
  compensacao: z.enum(["absorve", "credito_diaria"]),
  ativo: z.boolean().default(true),
});

export const salvarCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CupomSchema.parse(d))
  .handler(async ({ data }) => {
    const registro = {
      codigo: data.codigo.toUpperCase(),
      desconto_pct: data.descontoPct,
      aplicacao: data.aplicacao,
      limite_usos: data.limiteUsos ?? null,
      valido_de: data.validoDe || null,
      valido_ate: data.validoAte || null,
      compensacao: data.compensacao,
      ativo: data.ativo,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("cupons").update(registro).eq("id", data.id);
      if (error) throw new Error(traduzErro(error.message));
      return { id: data.id };
    }
    const { data: novo, error } = await supabaseAdmin
      .from("cupons")
      .insert(registro)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(traduzErro(error.message));
    return { id: novo?.id ?? null };
  });

function traduzErro(msg: string): string {
  if (/duplicate|unique|uniq_cupom_codigo/i.test(msg)) return "Já existe um cupom com esse código.";
  return msg;
}

// ─── REMOVER (painel) ───────────────────────────────────
export const removerCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("cupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── REGISTRAR USO (app do cliente) ─────────────────────
// Chamado logo depois que a corrida é criada. Grava o cupom + valores na
// corrida e conta o uso. Idempotente por corrida (índice único em corrida_id).
export const registrarUsoCupom = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(10),
        corridaId: z.number(),
        cupomCodigo: z.string().min(1),
        valorOriginal: z.number().nonnegative(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // valida sessão do cliente
    const { data: sessao } = await supabaseAdmin
      .from("cliente_sessoes")
      .select("cliente_codigo")
      .eq("token", data.token)
      .eq("status", "ativa")
      .maybeSingle();
    if (!sessao) throw new Error("Sessão inválida — faça login novamente.");

    // corrida precisa ser deste cliente e ainda não ter cupom
    const { data: corrida } = await supabaseAdmin
      .from("corridas")
      .select("id, cliente_codigo, valor_final, cupom_codigo")
      .eq("id", data.corridaId)
      .maybeSingle();
    if (!corrida) throw new Error("Corrida não encontrada.");
    if (corrida.cliente_codigo && corrida.cliente_codigo !== sessao.cliente_codigo) {
      throw new Error("Corrida de outro cliente.");
    }
    if (corrida.cupom_codigo) return { ok: true, jaRegistrado: true };

    // revalida o cupom
    const { data: cupom } = await supabaseAdmin
      .from("cupons")
      .select("*")
      .ilike("codigo", data.cupomCodigo)
      .maybeSingle();
    if (!cupom || !cupomValidoAgora(cupom)) {
      // cupom não vale mais — não bloqueia a corrida, só não aplica registro
      return { ok: false, motivo: "Cupom indisponível." };
    }

    // Anexa SÓ o cupom_codigo. Quem aplica o desconto no valor_final é o TRIGGER
    // do banco (corridas_aplicar_desconto_cupom, migração 20260824180000): ele
    // calcula em cima do valor cheio e é blindado contra descontar 2x. O app NÃO
    // escreve valor_final/valor_original/desconto — senão briga com o gatilho
    // (era isso que causava desconto duplo em umas corridas e nenhum em outras).
    await supabaseAdmin
      .from("corridas")
      .update({ cupom_codigo: cupom.codigo })
      .eq("id", data.corridaId);

    // Relê o que o trigger gravou, só para registrar o uso do cupom.
    const { data: pos } = await supabaseAdmin
      .from("corridas")
      .select("valor_original, desconto_valor")
      .eq("id", data.corridaId)
      .maybeSingle();
    const valorCheio = Number(pos?.valor_original ?? corrida.valor_final ?? 0);
    const descontoValor = Number(pos?.desconto_valor ?? 0);

    // conta o uso (respeita o limite global; best-effort read-then-write)
    const { data: incrementado } = await supabaseAdmin
      .from("cupons")
      .update({ usos: (cupom.usos ?? 0) + 1 })
      .eq("id", cupom.id)
      .or(`limite_usos.is.null,usos.lt.${cupom.limite_usos ?? Number.MAX_SAFE_INTEGER}`)
      .select("id")
      .maybeSingle();

    await supabaseAdmin.from("cupom_usos").insert({
      cupom_id: cupom.id,
      cupom_codigo: cupom.codigo,
      corrida_id: data.corridaId,
      cliente_codigo: sessao.cliente_codigo,
      valor_original: valorCheio,
      valor_desconto: descontoValor,
    });

    return { ok: true, descontoValor, contado: !!incrementado };
  });

// ─── Validade (compartilhado) ───────────────────────────
export function cupomValidoAgora(c: {
  ativo: boolean;
  valido_de: string | null;
  valido_ate: string | null;
  limite_usos: number | null;
  usos: number;
}): boolean {
  if (!c.ativo) return false;
  const agora = Date.now();
  if (c.valido_de && agora < new Date(c.valido_de).getTime()) return false;
  if (c.valido_ate && agora > new Date(c.valido_ate).getTime()) return false;
  if (c.limite_usos != null && (c.usos ?? 0) >= c.limite_usos) return false;
  return true;
}
