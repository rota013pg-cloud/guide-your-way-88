/**
 * Server functions de cobrança automática de diária.
 *
 * Fluxo:
 *  - Trigger SQL recalcula cobrança quando corrida é concluída.
 *  - Status: Pendente | Aguardando | Pago | Bloqueado.
 *  - "Pendente": atingiu valor da diária, ainda não pagou.
 *  - "Aguardando": motorista clicou "Já paguei", esperando confirmação.
 *  - "Bloqueado": faturamento >= valorDiaria * (1 + %bloqueio/100). App trava.
 *  - "Pago": registro existe em financeiro/Diária no dia op.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

// ─── OPERADOR: lista cobranças do dia ─────────────────────
export const listarCobrancasHoje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const diaOp = await diaOpHoje();
    const { data, error } = await supabaseAdmin
      .from("motorista_cobranca")
      .select("*, motoristas:motoristas!motorista_cobranca_motorista_codigo_fkey(nome,telefone,status)")
      .eq("dia_op", diaOp)
      .order("disparou_bloqueio_em", { ascending: false, nullsFirst: false });

    // foreign key pode não existir — fallback manual
    if (error) {
      const [{ data: cobr }, { data: mots }] = await Promise.all([
        supabaseAdmin.from("motorista_cobranca").select("*").eq("dia_op", diaOp),
        supabaseAdmin.from("motoristas").select("codigo,nome,telefone,status"),
      ]);
      const map = new Map((mots ?? []).map((m) => [m.codigo, m]));
      return {
        diaOp,
        cobrancas: (cobr ?? []).map((c) => ({
          ...c,
          motorista_nome: map.get(c.motorista_codigo)?.nome ?? c.motorista_codigo,
          motorista_telefone: map.get(c.motorista_codigo)?.telefone ?? null,
          motorista_status: map.get(c.motorista_codigo)?.status ?? null,
        })),
      };
    }

    return { diaOp, cobrancas: data ?? [] };
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

    // pega valor da diária / motorista
    const [{ data: cfg }, { data: mot }] = await Promise.all([
      supabaseAdmin.from("app_config").select("config_json").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("motoristas").select("nome").eq("codigo", data.motoristaCodigo).maybeSingle(),
    ]);
    const valorDiaria = data.valor ?? Number((cfg?.config_json as { valorDiaria?: number })?.valorDiaria ?? 19.9);

    // operador
    const { data: opRow } = await supabaseAdmin
      .from("usuarios_painel")
      .select("nome")
      .eq("user_id", context.userId as string)
      .maybeSingle();
    const operador = opRow?.nome ?? "Operador";

    // insere diária (trigger marca cobrança como Pago)
    const { error } = await supabaseAdmin.from("financeiro").insert({
      motorista_codigo: data.motoristaCodigo,
      motorista: mot?.nome,
      valor: valorDiaria,
      tipo: "Diária",
      operador,
    });
    if (error && !error.message.includes("uniq_diaria_dia")) throw new Error(error.message);

    // marca liberado_por
    await supabaseAdmin
      .from("motorista_cobranca")
      .update({ liberado_por: operador, liberado_em: new Date().toISOString() })
      .eq("motorista_codigo", data.motoristaCodigo)
      .eq("dia_op", diaOp);

    // se motorista estava bloqueado, volta para Offline (motorista decide online de novo)
    await supabaseAdmin
      .from("motoristas")
      .update({ status: "Offline" })
      .eq("codigo", data.motoristaCodigo)
      .eq("status", "Bloqueado");

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

// ─── MOTORISTA: marca "já paguei" (Aguardando) ───────────
export const motoristaSolicitarLiberacao = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ codigo: z.string(), token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await validarTokenMotorista(data.codigo, data.token);
    const diaOp = await diaOpHoje();
    const { error } = await supabaseAdmin
      .from("motorista_cobranca")
      .update({
        status: "Aguardando",
        comprovante_enviado_em: new Date().toISOString(),
      })
      .eq("motorista_codigo", data.codigo)
      .eq("dia_op", diaOp)
      .neq("status", "Pago");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
