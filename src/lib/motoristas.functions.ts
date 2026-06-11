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

async function exigirOperador(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "operador"])
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a operadores.");
}

export const listarMotoristas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: motoristas, error } = await supabaseAdmin
      .from("motoristas")
      .select("*")
      .neq("status", "Excluido")
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
  ear: z.boolean().optional().default(false),
  vistoria_status: z.enum(["pendente", "aprovada", "reprovada", "vencida"]).optional().default("pendente"),
  vistoria_em: z.string().trim().max(20).optional().nullable(),
  prioridade_criterios: z.object({
    experiencia: z.boolean().optional(),
    avaliacao: z.boolean().optional(),
    equipamentos: z.boolean().optional(),
    pontualidade: z.boolean().optional(),
  }).partial().optional().default({}),
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

// Libera o "trava de dispositivo" do motorista: encerra sessões ativas e
// limpa o device_id em motorista_auth para permitir login em novo aparelho.
export const adminResetarDispositivoMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirOperador(context.userId);
    const { error: e1 } = await supabaseAdmin
      .from("motorista_auth")
      .update({ device_id: null, device_nome: null } as any)
      .eq("motorista_codigo", data.codigo);
    if (e1) throw new Error(e1.message);
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

// ─── PAUSAR / RETOMAR MOTORISTA ─────────────────────────
// Quando pausado, o motorista não recebe novas ofertas de corrida.
// O app do motorista não exibe esse estado.
export const pausarMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        codigo: z.string(),
        motivo: z.string().trim().max(255).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({
        pausado: true,
        pausado_em: new Date().toISOString(),
        pausado_motivo: data.motivo || null,
      } as any)
      .eq("codigo", data.codigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const retomarMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({
        pausado: false,
        pausado_em: null,
        pausado_motivo: null,
      } as any)
      .eq("codigo", data.codigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── AUTO-OFFLINE POR INATIVIDADE ────────────────────────
// Marca como Offline motoristas cujo app travou/fechou em background:
//   - status='Online' e
//   - sem ping de GPS nos últimos 90s e
//   - sessão ativa com mais de 90s (ou nenhuma sessão ativa)
//
// Chamada pelo painel a cada poll. Não toca em "Em corrida".
export const marcarStaleOffline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const JANELA_MS = 90_000;
    const cutoffIso = new Date(Date.now() - JANELA_MS).toISOString();

    const { data: onlineMot } = await supabaseAdmin
      .from("motoristas")
      .select("codigo")
      .eq("status", "Online");
    const codigos = (onlineMot ?? []).map((m) => m.codigo as string);
    if (codigos.length === 0) return { atualizados: 0 };

    const { data: pings } = await supabaseAdmin
      .from("motorista_gps")
      .select("motorista_codigo")
      .in("motorista_codigo", codigos)
      .gte("criado_em", cutoffIso);
    const recentes = new Set((pings ?? []).map((p) => p.motorista_codigo as string));

    const { data: sess } = await supabaseAdmin
      .from("motorista_sessoes")
      .select("motorista_codigo, criado_em")
      .in("motorista_codigo", codigos)
      .eq("status", "ativa");
    const sessIdadeMs = new Map<string, number>();
    for (const s of sess ?? []) {
      const idade = Date.now() - new Date(s.criado_em as string).getTime();
      const atual = sessIdadeMs.get(s.motorista_codigo as string) ?? -1;
      if (idade > atual) sessIdadeMs.set(s.motorista_codigo as string, idade);
    }

    const paraOffline = codigos.filter((c) => {
      if (recentes.has(c)) return false;
      const idade = sessIdadeMs.get(c);
      if (idade === undefined) return true; // sem sessão ativa
      return idade > JANELA_MS; // sessão antiga e sem ping
    });

    if (paraOffline.length === 0) return { atualizados: 0 };

    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ status: "Offline" })
      .in("codigo", paraOffline)
      .eq("status", "Online");
    if (error) throw new Error(error.message);

    // encerra sessões dos motoristas marcados como offline
    await supabaseAdmin
      .from("motorista_sessoes")
      .update({ status: "encerrada" })
      .in("motorista_codigo", paraOffline)
      .eq("status", "ativa");

    return { atualizados: paraOffline.length, codigos: paraOffline };
  });
