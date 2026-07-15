/**
 * Chat motorista <-> operador (Supabase Realtime).
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

// Gera uma URL de upload assinada — o cliente sobe o arquivo direto pro Storage
// (aguenta vídeo grande sem passar pelo payload da server function).
async function gerarUploadUrl(prefixo: string, ext: string) {
  const safeExt = (ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  const nome = `${Date.now()}-${randomBytes(8).toString("hex")}.${safeExt}`;
  const path = `${prefixo}/${nome}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_CHAT).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar upload.");
  const { data: pub } = supabaseAdmin.storage.from(BUCKET_CHAT).getPublicUrl(path);
  return { path: data.path, token: data.token, publicUrl: pub.publicUrl };
}

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

// ─── MOTORISTA: URL de upload de mídia ───────────────────
export const motoristaChatUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ codigo: z.string(), token: z.string(), ext: z.string().max(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarTokenMotorista(data.codigo, data.token);
    return gerarUploadUrl(`motorista/${data.codigo}`, data.ext);
  });

// ─── MOTORISTA: envia mensagem (texto e/ou mídia) ────────
const EnviarMotoristaSchema = z
  .object({
    codigo: z.string(),
    token: z.string(),
    texto: z.string().max(1000).optional().default(""),
    midiaUrl: z.string().url().optional(),
    midiaTipo: MidiaTipoEnum.optional(),
    midiaNome: z.string().max(200).optional(),
  })
  .refine((v) => v.texto.trim().length > 0 || !!v.midiaUrl, {
    message: "Mensagem vazia.",
  });

export const motoristaEnviarMensagem = createServerFn({ method: "POST" })
  .inputValidator((d) => EnviarMotoristaSchema.parse(d))
  .handler(async ({ data }) => {
    await validarTokenMotorista(data.codigo, data.token);
    const { data: mot } = await supabaseAdmin
      .from("motoristas").select("nome").eq("codigo", data.codigo).maybeSingle();
    await supabaseAdmin.from("chat_motorista").insert({
      motorista_codigo: data.codigo,
      autor: "motorista",
      autor_nome: mot?.nome ?? data.codigo,
      texto: data.texto?.trim() || null,
      midia_url: data.midiaUrl ?? null,
      midia_tipo: data.midiaTipo ?? null,
      midia_nome: data.midiaNome ?? null,
    } as never);
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
          ultima_msg: c.texto || rotuloMidia((c as { midia_tipo?: string | null }).midia_tipo),
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

// ─── OPERADOR: URL de upload de mídia ────────────────────
export const operadorChatUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ext: z.string().max(10) }).parse(d))
  .handler(async ({ data }) => gerarUploadUrl("operador", data.ext));

// ─── OPERADOR: envia mensagem (texto e/ou mídia) ─────────
const EnviarOperadorSchema = z
  .object({
    motoristaCodigo: z.string(),
    texto: z.string().max(1000).optional().default(""),
    midiaUrl: z.string().url().optional(),
    midiaTipo: MidiaTipoEnum.optional(),
    midiaNome: z.string().max(200).optional(),
  })
  .refine((v) => v.texto.trim().length > 0 || !!v.midiaUrl, { message: "Mensagem vazia." });

export const operadorEnviarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => EnviarOperadorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: op } = await supabaseAdmin
      .from("usuarios_painel").select("nome").eq("user_id", context.userId as string).maybeSingle();
    await supabaseAdmin.from("chat_motorista").insert({
      motorista_codigo: data.motoristaCodigo,
      autor: "operador",
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

// ─── ADMIN: apagar mensagem ─────────────────────────────
export const adminApagarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId as string);
    const { error } = await supabaseAdmin
      .from("chat_motorista")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── ADMIN: apagar conversa completa ────────────────────
export const adminApagarConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ motoristaCodigo: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId as string);
    const { error } = await supabaseAdmin
      .from("chat_motorista")
      .delete()
      .eq("motorista_codigo", data.motoristaCodigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
