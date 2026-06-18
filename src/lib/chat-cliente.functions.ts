/**
 * Chat cliente <-> operador (Supabase Realtime).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── OPERADOR: lista conversas (último por cliente) ───
export const operadorListarConversasCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: chats } = await supabaseAdmin
      .from("chat_cliente")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(500);
    const { data: clientes } = await supabaseAdmin
      .from("clientes")
      .select("codigo,nome,telefone");
    const cliMap = new Map((clientes ?? []).map((c) => [c.codigo, c]));

    const ult = new Map<string, {
      cliente_codigo: string;
      cliente_nome: string;
      telefone: string | null;
      ultima_msg: string;
      ultima_em: string;
      nao_lidas: number;
    }>();
    for (const c of chats ?? []) {
      if (!ult.has(c.cliente_codigo)) {
        const m = cliMap.get(c.cliente_codigo);
        ult.set(c.cliente_codigo, {
          cliente_codigo: c.cliente_codigo,
          cliente_nome: m?.nome ?? c.cliente_codigo,
          telefone: m?.telefone ?? null,
          ultima_msg: c.texto,
          ultima_em: c.criado_em,
          nao_lidas: 0,
        });
      }
      const entry = ult.get(c.cliente_codigo)!;
      if (c.autor === "cliente" && !c.lido) entry.nao_lidas += 1;
    }
    return { conversas: Array.from(ult.values()) };
  });

// ─── OPERADOR: lê mensagens de um cliente ──────────────
export const operadorListarChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clienteCodigo: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: msgs } = await supabaseAdmin
      .from("chat_cliente")
      .select("*")
      .eq("cliente_codigo", data.clienteCodigo)
      .order("criado_em", { ascending: true })
      .limit(500);
    await supabaseAdmin
      .from("chat_cliente")
      .update({ lido: true })
      .eq("cliente_codigo", data.clienteCodigo)
      .eq("autor", "cliente")
      .eq("lido", false);
    return { mensagens: msgs ?? [] };
  });

// ─── OPERADOR: envia mensagem ────────────────────────────
export const operadorEnviarMensagemCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clienteCodigo: z.string(),
      texto: z.string().min(1).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: op } = await supabaseAdmin
      .from("usuarios_painel").select("nome").eq("user_id", context.userId as string).maybeSingle();
    await supabaseAdmin.from("chat_cliente").insert({
      cliente_codigo: data.clienteCodigo,
      autor: "central",
      autor_nome: op?.nome ?? "Central",
      texto: data.texto,
    });
    return { ok: true };
  });

async function exigirAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const adminApagarMensagemCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId as string);
    const { error } = await supabaseAdmin
      .from("chat_cliente")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminApagarConversaCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clienteCodigo: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId as string);
    const { error } = await supabaseAdmin
      .from("chat_cliente")
      .delete()
      .eq("cliente_codigo", data.clienteCodigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
