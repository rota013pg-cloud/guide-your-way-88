/**
 * Server functions de cobrança automática de diária.
 *
 * Fluxo:
 *  - Trigger SQL recalcula cobrança quando corrida é concluída.
 *  - Status: Pendente | Aguardando | Pago | Bloqueado.
 *  - "Pendente": atingiu valor da diária, ainda não pagou.
 *  - "Aguardando": motorista enviou comprovante, esperando confirmação.
 *  - "Bloqueado": faturamento >= valorDiaria * (1 + %bloqueio/100). App trava.
 *  - "Pago": registro existe em financeiro/Diária no dia op.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const COMPROVANTES_BUCKET = "motoristas-docs";
const SIGNED_URL_TTL = 60 * 60; // 1h

async function diaOpHoje(): Promise<string> {
  const { data } = await supabaseAdmin.rpc("dia_operacional", { _ts: new Date().toISOString() });
  return data as unknown as string;
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

async function gerarSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from(COMPROVANTES_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

// ─── OPERADOR: lista cobranças do dia ─────────────────────
export const listarCobrancasHoje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const diaOp = await diaOpHoje();
    const [{ data: cobr }, { data: mots }] = await Promise.all([
      supabaseAdmin.from("motorista_cobranca").select("*").eq("dia_op", diaOp),
      supabaseAdmin.from("motoristas").select("codigo,nome,telefone,status"),
    ]);
    const map = new Map((mots ?? []).map((m) => [m.codigo, m]));
    const cobrancas = await Promise.all(
      (cobr ?? []).map(async (c) => ({
        ...c,
        comprovante_signed_url: await gerarSignedUrl(c.comprovante_url),
        motorista_nome: map.get(c.motorista_codigo)?.nome ?? c.motorista_codigo,
        motorista_telefone: map.get(c.motorista_codigo)?.telefone ?? null,
        motorista_status: map.get(c.motorista_codigo)?.status ?? null,
      })),
    );
    return { diaOp, cobrancas };
  });

// ─── OPERADOR: confirma pagamento e libera motorista ──────
export const liberarMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      motoristaCodigo: z.string().min(1).max(20),
      valor: z.number().positive().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const diaOp = await diaOpHoje();

    const [{ data: cfg }, { data: mot }] = await Promise.all([
      supabaseAdmin.from("app_config").select("config_json").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("motoristas").select("nome").eq("codigo", data.motoristaCodigo).maybeSingle(),
    ]);
    const valorDiaria = data.valor ?? Number((cfg?.config_json as { valorDiaria?: number })?.valorDiaria ?? 19.9);

    const { data: opRow } = await supabaseAdmin
      .from("usuarios_painel")
      .select("nome")
      .eq("user_id", context.userId as string)
      .maybeSingle();
    const operador = opRow?.nome ?? "Operador";

    const { error } = await supabaseAdmin.from("financeiro").insert({
      motorista_codigo: data.motoristaCodigo,
      motorista: mot?.nome,
      valor: valorDiaria,
      tipo: "Diária",
      operador,
    });
    if (error && !error.message.includes("uniq_diaria_dia")) throw new Error(error.message);

    await supabaseAdmin
      .from("motorista_cobranca")
      .update({
        liberado_por: operador,
        liberado_em: new Date().toISOString(),
        comprovante_rejeitado_em: null,
        comprovante_rejeicao_motivo: null,
      })
      .eq("motorista_codigo", data.motoristaCodigo)
      .eq("dia_op", diaOp);

    await supabaseAdmin
      .from("motoristas")
      .update({ status: "Offline" })
      .eq("codigo", data.motoristaCodigo)
      .eq("status", "Bloqueado");

    return { ok: true };
  });

// ─── OPERADOR: rejeita comprovante ────────────────────────
export const rejeitarComprovante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      motoristaCodigo: z.string().min(1).max(20),
      motivo: z.string().min(2).max(300),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const diaOp = await diaOpHoje();
    const { data: cobr } = await supabaseAdmin
      .from("motorista_cobranca")
      .select("comprovante_url")
      .eq("motorista_codigo", data.motoristaCodigo)
      .eq("dia_op", diaOp)
      .maybeSingle();

    // Remove arquivo do storage para o motociclista poder reenviar.
    if (cobr?.comprovante_url) {
      await supabaseAdmin.storage.from(COMPROVANTES_BUCKET).remove([cobr.comprovante_url]).catch(() => {});
    }

    const { error } = await supabaseAdmin
      .from("motorista_cobranca")
      .update({
        status: "Pendente",
        comprovante_url: null,
        comprovante_enviado_em: null,
        comprovante_rejeitado_em: new Date().toISOString(),
        comprovante_rejeicao_motivo: data.motivo,
      })
      .eq("motorista_codigo", data.motoristaCodigo)
      .eq("dia_op", diaOp);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── OPERADOR: força bloqueio manual ─────────────────────
export const bloquearMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ motoristaCodigo: z.string().min(1).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const diaOp = await diaOpHoje();
    await supabaseAdmin
      .from("motorista_cobranca")
      .upsert({
        motorista_codigo: data.motoristaCodigo,
        dia_op: diaOp,
        status: "Bloqueado",
        disparou_bloqueio_em: new Date().toISOString(),
      }, { onConflict: "motorista_codigo,dia_op" });
    await supabaseAdmin
      .from("motoristas")
      .update({ status: "Bloqueado" })
      .eq("codigo", data.motoristaCodigo);
    return { ok: true };
  });

// ─── MOTORISTA: lê cobrança atual ────────────────────────
export const motoristaMinhaCobranca = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ codigo: z.string(), token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await validarTokenMotorista(data.codigo, data.token);
    const diaOp = await diaOpHoje();
    const [{ data: cobr }, { data: cfg }] = await Promise.all([
      supabaseAdmin
        .from("motorista_cobranca")
        .select("*")
        .eq("motorista_codigo", data.codigo)
        .eq("dia_op", diaOp)
        .maybeSingle(),
      supabaseAdmin.from("app_config").select("config_json").eq("id", 1).maybeSingle(),
    ]);
    const config = (cfg?.config_json ?? {}) as {
      pixChave?: string;
      tipoChavePix?: string;
      whatsappCentral?: string;
      valorDiaria?: number;
      empresa?: string;
    };
    return { cobranca: cobr, config };
  });

// ─── MOTORISTA: envia comprovante e solicita liberação ───
const BASE64_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const MAX_COMPROVANTE_BYTES = 4 * 1024 * 1024; // 4MB

export const motoristaSolicitarLiberacao = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      comprovanteBase64: z.string().min(20).max(8_000_000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarTokenMotorista(data.codigo, data.token);

    const match = data.comprovanteBase64.match(BASE64_RE);
    if (!match) throw new Error("Comprovante deve ser uma imagem JPG, PNG ou WEBP.");
    const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
    const contentType = `image/${match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase()}`;
    const base64Body = data.comprovanteBase64.replace(BASE64_RE, "");
    const bytes = Buffer.from(base64Body, "base64");
    if (bytes.byteLength > MAX_COMPROVANTE_BYTES) {
      throw new Error("Imagem maior que 4MB. Reduza a foto e tente novamente.");
    }

    const diaOp = await diaOpHoje();
    const path = `comprovantes/${data.codigo}/${diaOp}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseAdmin
      .storage
      .from(COMPROVANTES_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw new Error(`Falha ao salvar comprovante: ${upErr.message}`);

    const { error } = await supabaseAdmin
      .from("motorista_cobranca")
      .update({
        status: "Aguardando",
        comprovante_enviado_em: new Date().toISOString(),
        comprovante_url: path,
        comprovante_rejeitado_em: null,
        comprovante_rejeicao_motivo: null,
      })
      .eq("motorista_codigo", data.codigo)
      .eq("dia_op", diaOp)
      .neq("status", "Pago");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
