/**
 * Chat da CORRIDA — canal direto cliente <-> motociclista enquanto a corrida
 * está ativa, com a Central monitorando (observa, intervém, remove mensagem).
 *
 * Arquitetura:
 *  - Tabela `chat_corrida` (ver migração 20260730195526_chat_corrida.sql),
 *    escopada por `corrida_id`, com autor ∈ (cliente | motociclista | central).
 *  - Os apps leem/escrevem SÓ por estas server functions (service role). Não há
 *    realtime anon: os apps fazem polling, igual ao chat com a central.
 *  - "Abre" quando a corrida tem motociclista e está em status ativo; "fecha"
 *    sozinho quando a corrida sai desses status (finaliza/cancela) — aí os apps
 *    voltam a falar com a Central.
 *  - Identidade: só o primeiro nome, sem telefone.
 */
import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarPushCliente, enviarPushMotorista } from "@/lib/push.server";

const BUCKET_CHAT = "chat-midia";
const MidiaTipoEnum = z.enum(["imagem", "video", "audio", "arquivo"]);

// Status em que a corrida tem motociclista e o canal direto fica aberto.
const STATUS_ATIVOS = ["Aceita", "A caminho", "Chegou", "Em viagem", "Parada"];

// Acesso à tabela nova (ainda não está nos tipos gerados do Supabase).
const chat = () => (supabaseAdmin as unknown as {
  from: (t: string) => ReturnType<typeof supabaseAdmin.from>;
}).from("chat_corrida");

function primeiroNome(nome?: string | null): string {
  const n = (nome ?? "").trim();
  if (!n) return "";
  return n.split(/\s+/)[0];
}

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

async function validarCliente(token: string): Promise<{ codigo: string; nome: string }> {
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

async function validarMotorista(codigo: string, token: string) {
  const { data } = await supabaseAdmin
    .from("motorista_sessoes")
    .select("id")
    .eq("token", token)
    .eq("motorista_codigo", codigo)
    .eq("status", "ativa")
    .maybeSingle();
  if (!data) throw new Error("Sessão inválida — faça login novamente.");
}

type CorridaChat = {
  id: number;
  status: string;
  cliente_codigo: string | null;
  motorista_codigo: string | null;
  motorista: string | null;
};

// Corrida ativa (com motociclista) de um cliente, ou null.
async function corridaAtivaDoCliente(clienteCodigo: string): Promise<CorridaChat | null> {
  const { data } = await supabaseAdmin
    .from("corridas")
    .select("id, status, cliente_codigo, motorista_codigo, motorista")
    .eq("cliente_codigo", clienteCodigo)
    .in("status", STATUS_ATIVOS as never)
    .not("motorista_codigo", "is", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CorridaChat) ?? null;
}

// Confere que a corrida pertence ao motociclista e ainda está ativa.
async function corridaDoMotorista(corridaId: number, motoristaCodigo: string): Promise<CorridaChat | null> {
  const { data } = await supabaseAdmin
    .from("corridas")
    .select("id, status, cliente_codigo, motorista_codigo, motorista")
    .eq("id", corridaId)
    .eq("motorista_codigo", motoristaCodigo)
    .maybeSingle();
  const c = (data as CorridaChat) ?? null;
  if (!c || !STATUS_ATIVOS.includes(c.status)) return null;
  return c;
}

async function nomeCliente(clienteCodigo: string | null): Promise<string> {
  if (!clienteCodigo) return "Passageiro";
  const { data } = await supabaseAdmin.from("clientes").select("nome").eq("codigo", clienteCodigo).maybeSingle();
  return primeiroNome(data?.nome) || "Passageiro";
}

type MsgOut = {
  id: number; autor: string; autor_nome: string | null; texto: string | null;
  midia_url: string | null; midia_tipo: string | null; midia_nome: string | null;
  removida: boolean; criado_em: string;
};

type ConversaOut = {
  corridaId: number; status: string; ativa: boolean;
  clienteNome: string; motoristaNome: string;
  origem: string | null; destino: string | null;
  ultima_msg: string; ultima_em: string;
};

async function listarMensagens(corridaId: number): Promise<MsgOut[]> {
  const { data } = await chat()
    .select("id, autor, autor_nome, texto, midia_url, midia_tipo, midia_nome, removida, criado_em")
    .eq("corrida_id", corridaId)
    .order("criado_em", { ascending: true })
    .limit(500);
  return (data ?? []) as unknown as MsgOut[];
}

// ════════════════ CLIENTE ════════════════

// Estado + mensagens do chat da corrida para o cliente. Se não há corrida ativa
// com motociclista, retorna { corridaId: null } e o app volta pra Central.
export const clienteChatCorridaSync = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { codigo } = await validarCliente(data.token);
    const corrida = await corridaAtivaDoCliente(codigo);
    if (!corrida) return { corridaId: null as number | null, motoristaNome: null as string | null, status: null as string | null, mensagens: [] as MsgOut[] };

    // marca como lidas as mensagens que chegaram pro cliente
    await chat().update({ lido_cliente: true } as never)
      .eq("corrida_id", corrida.id)
      .in("autor", ["motociclista", "central"])
      .eq("lido_cliente", false);

    return {
      corridaId: corrida.id,
      motoristaNome: primeiroNome(corrida.motorista) || "Motociclista",
      status: corrida.status,
      mensagens: await listarMensagens(corrida.id),
    };
  });

export const clienteChatCorridaEnviar = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(10),
    corridaId: z.number().int().positive(),
    texto: z.string().max(1000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { codigo, nome } = await validarCliente(data.token);
    const corrida = await corridaAtivaDoCliente(codigo);
    if (!corrida || corrida.id !== data.corridaId) throw new Error("Corrida não está ativa.");
    const t = data.texto.trim();
    if (!t) throw new Error("Mensagem vazia.");
    await chat().insert({
      corrida_id: corrida.id,
      autor: "cliente",
      autor_nome: primeiroNome(nome) || "Passageiro",
      texto: t,
      lido_cliente: true,
    } as never);
    if (corrida.motorista_codigo) {
      void enviarPushMotorista([corrida.motorista_codigo], {
        title: `💬 ${primeiroNome(nome) || "Passageiro"}`,
        body: t.length > 120 ? t.slice(0, 120) + "…" : t,
        data: { tipo: "chat_corrida", corridaId: String(corrida.id) },
      });
    }
    return { ok: true };
  });

export const clienteChatCorridaUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(10),
    corridaId: z.number().int().positive(),
    ext: z.string().max(10),
  }).parse(d))
  .handler(async ({ data }) => {
    await validarCliente(data.token);
    return gerarUploadUrl(`corrida/${data.corridaId}/cliente`, data.ext);
  });

export const clienteChatCorridaEnviarMidia = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(10),
    corridaId: z.number().int().positive(),
    midiaUrl: z.string().url(),
    midiaTipo: MidiaTipoEnum,
    midiaNome: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { codigo, nome } = await validarCliente(data.token);
    const corrida = await corridaAtivaDoCliente(codigo);
    if (!corrida || corrida.id !== data.corridaId) throw new Error("Corrida não está ativa.");
    await chat().insert({
      corrida_id: corrida.id,
      autor: "cliente",
      autor_nome: primeiroNome(nome) || "Passageiro",
      texto: null,
      midia_url: data.midiaUrl,
      midia_tipo: data.midiaTipo,
      midia_nome: data.midiaNome ?? null,
      lido_cliente: true,
    } as never);
    if (corrida.motorista_codigo) {
      void enviarPushMotorista([corrida.motorista_codigo], {
        title: `💬 ${primeiroNome(nome) || "Passageiro"}`,
        body: rotuloMidia(data.midiaTipo) || "Nova mensagem",
        data: { tipo: "chat_corrida", corridaId: String(corrida.id) },
      });
    }
    return { ok: true };
  });

// ════════════════ MOTOCICLISTA ════════════════

export const motoristaChatCorridaSync = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    codigo: z.string().min(1),
    token: z.string().min(10),
    corridaId: z.number().int().positive(),
  }).parse(d))
  .handler(async ({ data }) => {
    await validarMotorista(data.codigo, data.token);
    const corrida = await corridaDoMotorista(data.corridaId, data.codigo);
    if (!corrida) return { corridaId: null as number | null, clienteNome: null as string | null, status: null as string | null, mensagens: [] as MsgOut[] };

    await chat().update({ lido_motorista: true } as never)
      .eq("corrida_id", corrida.id)
      .in("autor", ["cliente", "central"])
      .eq("lido_motorista", false);

    return {
      corridaId: corrida.id,
      clienteNome: await nomeCliente(corrida.cliente_codigo),
      status: corrida.status,
      mensagens: await listarMensagens(corrida.id),
    };
  });

export const motoristaChatCorridaEnviar = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    codigo: z.string().min(1),
    token: z.string().min(10),
    corridaId: z.number().int().positive(),
    texto: z.string().max(1000),
  }).parse(d))
  .handler(async ({ data }) => {
    await validarMotorista(data.codigo, data.token);
    const corrida = await corridaDoMotorista(data.corridaId, data.codigo);
    if (!corrida) throw new Error("Corrida não está ativa.");
    const t = data.texto.trim();
    if (!t) throw new Error("Mensagem vazia.");
    const nome = primeiroNome(corrida.motorista) || "Motociclista";
    await chat().insert({
      corrida_id: corrida.id,
      autor: "motociclista",
      autor_nome: nome,
      texto: t,
      lido_motorista: true,
    } as never);
    if (corrida.cliente_codigo) {
      void enviarPushCliente([corrida.cliente_codigo], {
        title: `💬 ${nome}`,
        body: t.length > 120 ? t.slice(0, 120) + "…" : t,
        data: { tipo: "chat_corrida", corridaId: String(corrida.id) },
      });
    }
    return { ok: true };
  });

export const motoristaChatCorridaUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    codigo: z.string().min(1),
    token: z.string().min(10),
    corridaId: z.number().int().positive(),
    ext: z.string().max(10),
  }).parse(d))
  .handler(async ({ data }) => {
    await validarMotorista(data.codigo, data.token);
    return gerarUploadUrl(`corrida/${data.corridaId}/motorista`, data.ext);
  });

export const motoristaChatCorridaEnviarMidia = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    codigo: z.string().min(1),
    token: z.string().min(10),
    corridaId: z.number().int().positive(),
    midiaUrl: z.string().url(),
    midiaTipo: MidiaTipoEnum,
    midiaNome: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await validarMotorista(data.codigo, data.token);
    const corrida = await corridaDoMotorista(data.corridaId, data.codigo);
    if (!corrida) throw new Error("Corrida não está ativa.");
    const nome = primeiroNome(corrida.motorista) || "Motociclista";
    await chat().insert({
      corrida_id: corrida.id,
      autor: "motociclista",
      autor_nome: nome,
      texto: null,
      midia_url: data.midiaUrl,
      midia_tipo: data.midiaTipo,
      midia_nome: data.midiaNome ?? null,
      lido_motorista: true,
    } as never);
    if (corrida.cliente_codigo) {
      void enviarPushCliente([corrida.cliente_codigo], {
        title: `💬 ${nome}`,
        body: rotuloMidia(data.midiaTipo) || "Nova mensagem",
        data: { tipo: "chat_corrida", corridaId: String(corrida.id) },
      });
    }
    return { ok: true };
  });

// ════════════════ CENTRAL / PAINEL ════════════════

// Lista as conversas de corrida (mais recentes primeiro), com nomes e status.
export const operadorChatCorridaConversas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: msgs } = await chat()
      .select("corrida_id, texto, midia_tipo, criado_em")
      .order("criado_em", { ascending: false })
      .limit(800);
    const linhas = (msgs ?? []) as unknown as Array<{
      corrida_id: number; texto: string | null; midia_tipo: string | null; criado_em: string;
    }>;
    const ids: number[] = [];
    const ult = new Map<number, { ultima_msg: string; ultima_em: string }>();
    for (const m of linhas) {
      if (!ult.has(m.corrida_id)) {
        ult.set(m.corrida_id, {
          ultima_msg: m.texto || rotuloMidia(m.midia_tipo),
          ultima_em: m.criado_em,
        });
        ids.push(m.corrida_id);
      }
    }
    if (ids.length === 0) return { conversas: [] as ConversaOut[] };

    const { data: corridas } = await supabaseAdmin
      .from("corridas")
      .select("id, status, cliente, motorista, cliente_codigo, motorista_codigo, origem, destino")
      .in("id", ids as never);
    const cMap = new Map((corridas ?? []).map((c) => [c.id as number, c]));

    const conversas = ids.map((id) => {
      const c = cMap.get(id) as
        | { status?: string; cliente?: string | null; motorista?: string | null; origem?: string | null; destino?: string | null }
        | undefined;
      const u = ult.get(id)!;
      return {
        corridaId: id,
        status: c?.status ?? "—",
        ativa: c?.status ? STATUS_ATIVOS.includes(c.status) : false,
        clienteNome: c?.cliente ?? "Cliente",
        motoristaNome: c?.motorista ?? "Motociclista",
        origem: c?.origem ?? null,
        destino: c?.destino ?? null,
        ultima_msg: u.ultima_msg,
        ultima_em: u.ultima_em,
      };
    });
    return { conversas };
  });

export const operadorChatCorridaListar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ corridaId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    return { mensagens: await listarMensagens(data.corridaId) };
  });

export const operadorChatCorridaEnviar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    corridaId: z.number().int().positive(),
    texto: z.string().min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: op } = await supabaseAdmin
      .from("usuarios_painel").select("nome").eq("user_id", context.userId as string).maybeSingle();
    const nome = op?.nome ?? "Central";
    const t = data.texto.trim();
    await chat().insert({
      corrida_id: data.corridaId,
      autor: "central",
      autor_nome: nome,
      texto: t,
    } as never);

    // Notifica os dois lados da corrida.
    const { data: c } = await supabaseAdmin
      .from("corridas")
      .select("cliente_codigo, motorista_codigo")
      .eq("id", data.corridaId)
      .maybeSingle();
    const preview = t.length > 120 ? t.slice(0, 120) + "…" : t;
    if (c?.cliente_codigo) {
      void enviarPushCliente([c.cliente_codigo], { title: `💬 ${nome}`, body: preview, data: { tipo: "chat_corrida", corridaId: String(data.corridaId) } });
    }
    if (c?.motorista_codigo) {
      void enviarPushMotorista([c.motorista_codigo], { title: `💬 ${nome}`, body: preview, data: { tipo: "chat_corrida", corridaId: String(data.corridaId) } });
    }
    return { ok: true };
  });

// Remove (modera) uma mensagem — vira "Mensagem removida pela central".
export const operadorChatCorridaRemover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: op } = await supabaseAdmin
      .from("usuarios_painel").select("nome").eq("user_id", context.userId as string).maybeSingle();
    await chat().update({ removida: true, removida_por: op?.nome ?? "Central" } as never).eq("id", data.id);
    return { ok: true };
  });
