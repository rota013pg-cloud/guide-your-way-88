import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SALT = "rota013salt";
const hashSenha = (s: string) => createHash("sha256").update(s + SALT).digest("hex");

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

export const listarMotoristas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: motoristas, error } = await supabaseAdmin
      .from("motoristas")
      .select("*")
      .neq("status", "Excluido" as any)
      .order("codigo", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: auths } = await supabaseAdmin
      .from("motorista_auth")
      .select("motorista_codigo, status, motivo_bloqueio, ultimo_acesso");
    const mapAuth = new Map((auths ?? []).map((a) => [a.motorista_codigo, a]));
    return (motoristas ?? []).map((m) => ({
      ...m,
      auth_status: mapAuth.get(m.codigo)?.status ?? "Ativo",
      motivo_bloqueio: mapAuth.get(m.codigo)?.motivo_bloqueio ?? null,
      ultimo_acesso: mapAuth.get(m.codigo)?.ultimo_acesso ?? null,
    }));
  });

export const previewProximoCodigoMotorista = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.rpc("preview_proximo_codigo_motorista");
    if (error) throw new Error(error.message);
    return (data as string) ?? "M0001";
  });

const MotoristaSchema = z.object({
  codigo: z.string().regex(/^M\d{4,}$/).optional(),
  nome: z.string().trim().min(1).max(120),
  telefone: z.string().trim().max(20).optional().default(""),
  cpf: z.string().trim().max(20).optional().default(""),
  endereco: z.string().trim().max(255).optional().default(""),
  cidade: z.string().trim().max(80).optional().default("Praia Grande"),
  nome_familiar: z.string().trim().max(120).optional().default(""),
  telefone_familiar: z.string().trim().max(20).optional().default(""),
  moto: z.string().trim().max(80).optional().default(""),
  placa: z.string().trim().max(10).optional().default(""),
  cor: z.string().trim().max(40).optional().default(""),
  foto: z.string().trim().max(500).optional().default(""),
  doc_cnh: z.string().trim().max(500).optional().default(""),
  doc_veiculo: z.string().trim().max(500).optional().default(""),
  foto_moto: z.string().trim().max(500).optional().default(""),
  doc_endereco: z.string().trim().max(500).optional().default(""),
  senha_inicial: z.string().trim().min(4).max(50).optional(),
});

export const salvarMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => MotoristaSchema.parse(d))
  .handler(async ({ data }) => {
    const camposComuns = {
      nome: data.nome,
      telefone: data.telefone,
      cpf: data.cpf,
      endereco: data.endereco,
      cidade: data.cidade,
      nome_familiar: data.nome_familiar,
      telefone_familiar: data.telefone_familiar,
      moto: data.moto,
      placa: data.placa,
      cor: data.cor,
      foto: data.foto,
      doc_cnh: data.doc_cnh,
      doc_veiculo: data.doc_veiculo,
      foto_moto: data.foto_moto,
      doc_endereco: data.doc_endereco,
    };

    if (data.codigo) {
      const { error } = await supabaseAdmin
        .from("motoristas")
        .update(camposComuns)
        .eq("codigo", data.codigo);
      if (error) throw new Error(error.message);
      return { codigo: data.codigo };
    }
    // Criar — gera código com lock e cria auth se senha foi informada
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const { data: codigoData, error: e1 } = await supabaseAdmin.rpc("proximo_codigo_motorista");
      if (e1) throw new Error(e1.message);
      const codigo = codigoData as string;
      const { error: e2 } = await supabaseAdmin.from("motoristas").insert({ codigo, ...camposComuns });
      if (!e2) {
        const senha = data.senha_inicial || codigo.toLowerCase();
        await supabaseAdmin.from("motorista_auth").upsert(
          {
            motorista_codigo: codigo,
            senha_hash: hashSenha(senha),
            senha_plain: senha,
            status: "Ativo" as any,
          },
          { onConflict: "motorista_codigo" },
        );
        return { codigo, senha };
      }
      if (!e2.message.includes("duplicate") && !e2.message.includes("unique")) {
        throw new Error(e2.message);
      }
    }
    throw new Error("Não foi possível gerar código único após 5 tentativas.");
  });

export const excluirMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ status: "Excluido" as any })
      .eq("codigo", data.codigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── ADMIN ──────────────────────────────────────────
export const adminVerSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { data: a, error } = await supabaseAdmin
      .from("motorista_auth")
      .select("senha_plain")
      .eq("motorista_codigo", data.codigo)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { senha: a?.senha_plain ?? null };
  });

export const adminAlterarSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ codigo: z.string(), novaSenha: z.string().min(4).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("motorista_auth")
      .upsert(
        {
          motorista_codigo: data.codigo,
          senha_hash: hashSenha(data.novaSenha),
          senha_plain: data.novaSenha,
        } as any,
        { onConflict: "motorista_codigo" },
      );
    if (error) throw new Error(error.message);
    // Encerra sessões ativas
    await supabaseAdmin
      .from("motorista_sessoes")
      .update({ status: "encerrada" })
      .eq("motorista_codigo", data.codigo)
      .eq("status", "ativa");
    return { ok: true };
  });

export const adminBloquearMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ codigo: z.string(), motivo: z.string().trim().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("motorista_auth")
      .update({ status: "Bloqueado" as any, motivo_bloqueio: data.motivo })
      .eq("motorista_codigo", data.codigo);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("motorista_sessoes")
      .update({ status: "encerrada" })
      .eq("motorista_codigo", data.codigo)
      .eq("status", "ativa");
    await supabaseAdmin
      .from("motoristas")
      .update({ status: "Offline" as any })
      .eq("codigo", data.codigo);
    return { ok: true };
  });

export const adminDesbloquearMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("motorista_auth")
      .update({ status: "Ativo" as any, motivo_bloqueio: null })
      .eq("motorista_codigo", data.codigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
