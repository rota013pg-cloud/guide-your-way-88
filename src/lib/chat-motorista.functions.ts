/**
 * Chat motorista <-> operador (Supabase Realtime).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasRole } from "@/lib/roles.server";

async function validarTokenMotorista(codigo: string, token: string) {
  const { data } = await supabaseAdmin
    .from("motorista_sessoes")
    .select("id")
    .eq("token", token)
    .eq("motorista_codigo", codigo)
    .eq("status", "ativa")
    .maybeSingle();
  if (!data) throw new Error("Sessão inválida.");
}

// ─── MOTORISTA: lista mensagens dele ─────────────────────
export const motoristaListarChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ codigo: z.string(), token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await validarTokenMotorista(data.codigo, data.token);
    const { data: msgs } = await supabaseAdmin
      .from("chat_motorista")
      .select("*")
      .eq("motorista_codigo", data.codigo)
      .order("criado_em", { ascending: true })
      .limit(200);
    // marca msgs do operador como lidas
    await supabaseAdmin
      .from("chat_motorista")
      .update({ lido: true })
      .eq("motorista_codigo", data.codigo)
      .eq("autor", "operador")
      .eq("lido", false);
    return { mensagens: msgs ?? [] };
  });

// ─── MOTORISTA: envia mensagem ───────────────────────────
export const motoristaEnviarMensagem = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      texto: z.string().min(1).max(1000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarTokenMotorista(data.codigo, data.token);
    const { data: mot } = await supabaseAdmin
      .from("motoristas").select("nome").eq("codigo", data.codigo).maybeSingle();
    await supabaseAdmin.from("chat_motorista").insert({
      motorista_codigo: data.codigo,
      autor: "motorista",
      autor_nome: mot?.nome ?? data.codigo,
      texto: data.texto,
    });
    return { ok: true };
  });

// ─── OPERADOR: lista conversas (último por motorista) ───
export const operadorListarConversas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: chats } = await supabaseAdmin
      .from("chat_motorista")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(500);
    const { data: mots } = await supabaseAdmin
      .from("motoristas")
      .select("codigo,nome,telefone,status");
    const motMap = new Map((mots ?? []).map((m) => [m.codigo, m]));

    const ultPorMot = new Map<string, {
      motorista_codigo: string;
      motorista_nome: string;
      telefone: string | null;
      status: string | null;
      ultima_msg: string;
      ultima_em: string;
      nao_lidas: number;
    }>();
    for (const c of chats ?? []) {
      if (!ultPorMot.has(c.motorista_codigo)) {
        const m = motMap.get(c.motorista_codigo);
        ultPorMot.set(c.motorista_codigo, {
          motorista_codigo: c.motorista_codigo,
          motorista_nome: m?.nome ?? c.motorista_codigo,
          telefone: m?.telefone ?? null,
          status: m?.status ?? null,
          ultima_msg: c.texto,
          ultima_em: c.criado_em,
          nao_lidas: 0,
        });
      }
      const entry = ultPorMot.get(c.motorista_codigo)!;
      if (c.autor === "motorista" && !c.lido) entry.nao_lidas += 1;
    }
    return { conversas: Array.from(ultPorMot.values()) };
  });

// ─── OPERADOR: lê mensagens de um motorista ──────────────
export const operadorListarChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ motoristaCodigo: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: msgs } = await supabaseAdmin
      .from("chat_motorista")
      .select("*")
      .eq("motorista_codigo", data.motoristaCodigo)
      .order("criado_em", { ascending: true })
      .limit(200);
    await supabaseAdmin
      .from("chat_motorista")
      .update({ lido: true })
      .eq("motorista_codigo", data.motoristaCodigo)
      .eq("autor", "motorista")
      .eq("lido", false);
    return { mensagens: msgs ?? [] };
  });

// ─── OPERADOR: envia mensagem ────────────────────────────
export const operadorEnviarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      motoristaCodigo: z.string(),
      texto: z.string().min(1).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: op } = await supabaseAdmin
      .from("usuarios_painel").select("nome").eq("user_id", context.userId as string).maybeSingle();
    await supabaseAdmin.from("chat_motorista").insert({
      motorista_codigo: data.motoristaCodigo,
      autor: "operador",
      autor_nome: op?.nome ?? "Central",
      texto: data.texto,
    });
    return { ok: true };
  });
