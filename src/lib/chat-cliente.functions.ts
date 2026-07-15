/**
 * Chat cliente <-> operador (Supabase Realtime).
 */
import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET_CHAT = "chat-midia";
const MidiaTipoEnum = z.enum(["imagem", "video", "audio", "arquivo"]);

function rotuloMidia(tipo?: string | null): string {
  switch (tipo) {
    case "imagem": return "📷 Foto";
    case "video": return "🎬 Vídeo";
    case "audio": return "🎤 Áudio";
    case "arquivo": return "📎 Arquivo";
    default: return "";
  }
}

async function gerarUploadUrl(prefixo: string, ext: string) {
  const safeExt = (ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  const nome = `${Date.now()}-${randomBytes(8).toString("hex")}.${safeExt}`;
  const path = `${prefixo}/${nome}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_CHAT).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar upload.");
  const { data: pub } = supabaseAdmin.storage.from(BUCKET_CHAT).getPublicUrl(path);
  return { path: data.path, token: data.token, publicUrl: pub.publicUrl };
}

async function validarTokenCliente(token: string): Promise<{ codigo: string; nome: string }> {
  const { data: sess } = await supabaseAdmin
    .from("cliente_sessoes")
    .select("cliente_codigo")
    .eq("token", token)
    .eq("status", "ativa")
    .maybeSingle();
  if (!sess) throw new Error("Sessão inválida — faça login novamente.");
  const codigo = sess.cliente_codigo as string;
  const { data: cli } = await supabaseAdmin.from("clientes").select("nome").eq("codigo", codigo).maybeSingle();
  return { codigo, nome: cli?.nome ?? codigo };
}

// ─── CLIENTE: registra token FCM do dispositivo ──────────
export const clienteRegistrarPushToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token: z.string().min(10),
      fcmToken: z.string().min(20),
      plataforma: z.string().max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { codigo } = await validarTokenCliente(data.token);
    await supabaseAdmin.from("cliente_push_tokens").upsert(
      {
        cliente_codigo: codigo,
        fcm_token: data.fcmToken,
        plataforma: data.plataforma ?? "android",
        atualizado_em: new Date().toISOString(),
      } as never,
      { onConflict: "fcm_token" },
    );
    return { ok: true };
  });

// ─── CLIENTE: URL de upload de mídia ─────────────────────
export const clienteChatUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10), ext: z.string().max(10) }).parse(d))
  .handler(async ({ data }) => {
    const { codigo } = await validarTokenCliente(data.token);
    return gerarUploadUrl(`cliente/${codigo}`, data.ext);
  });

// ─── CLIENTE: envia mídia ────────────────────────────────
export const clienteEnviarMidia = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token: z.string().min(10),
      midiaUrl: z.string().url(),
      midiaTipo: MidiaTipoEnum,
      midiaNome: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { codigo, nome } = await validarTokenCliente(data.token);
    await supabaseAdmin.from("chat_cliente").insert({
      cliente_codigo: codigo,
      autor: "cliente",
      autor_nome: nome,
      texto: null,
      midia_url: data.midiaUrl,
      midia_tipo: data.midiaTipo,
      midia_nome: data.midiaNome ?? null,
    } as never);
    return { ok: true };
  });

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
          ultima_msg: c.texto || rotuloMidia((c as { midia_tipo?: string | null }).midia_tipo),
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

// ─── OPERADOR: URL de upload de mídia (chat cliente) ─────
export const operadorChatClienteUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ext: z.string().max(10) }).parse(d))
  .handler(async ({ data }) => gerarUploadUrl("operador", data.ext));

// ─── OPERADOR: envia mensagem (texto e/ou mídia) ─────────
const EnviarClienteSchema = z
  .object({
    clienteCodigo: z.string(),
    texto: z.string().max(1000).optional().default(""),
    midiaUrl: z.string().url().optional(),
    midiaTipo: MidiaTipoEnum.optional(),
    midiaNome: z.string().max(200).optional(),
  })
  .refine((v) => v.texto.trim().length > 0 || !!v.midiaUrl, { message: "Mensagem vazia." });

export const operadorEnviarMensagemCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => EnviarClienteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: op } = await supabaseAdmin
      .from("usuarios_painel").select("nome").eq("user_id", context.userId as string).maybeSingle();
    await supabaseAdmin.from("chat_cliente").insert({
      cliente_codigo: data.clienteCodigo,
      autor: "central",
      autor_nome: op?.nome ?? "Central",
      texto: data.texto?.trim() || null,
      midia_url: data.midiaUrl ?? null,
      midia_tipo: data.midiaTipo ?? null,
      midia_nome: data.midiaNome ?? null,
    } as never);
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
