/**
 * Gestão de usuários do painel (apenas admin).
 * Login + senha mapeados para email do Supabase Auth via sufixo @painel.local.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SUFIXO = "@painel.local";

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

const loginToEmail = (login: string) =>
  login.includes("@") ? login : `${login}${SUFIXO}`;

const LoginField = z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use letras, números, . _ -");

// ─── LISTAR ─────────────────────────────────────────
export const listarUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("usuarios_painel")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const map = new Map<string, string>();
    (roles ?? []).forEach((r: any) => {
      // admin tem prioridade
      if (r.role === "admin" || !map.has(r.user_id)) map.set(r.user_id, r.role);
    });
    return (data ?? []).map((u: any) => ({ ...u, role: map.get(u.user_id) ?? "operador" }));
  });

// ─── CRIAR ──────────────────────────────────────────
const CriarSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  login: LoginField,
  senha: z.string().min(6).max(72),
  role: z.enum(["admin", "operador"]).default("operador"),
});

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CriarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);

    const authEmail = loginToEmail(data.login);

    // Cria no Supabase Auth
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome, login: data.login, email_contato: data.email },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Falha ao criar usuário");

    const userId = created.user.id;

    // Insere registro no usuarios_painel
    const { error: insErr } = await supabaseAdmin.from("usuarios_painel").insert({
      user_id: userId,
      nome: data.nome,
      email: data.email,
      login: data.login,
      senha_plain: data.senha,
      status: "Ativo",
    });
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(insErr.message);
    }

    // Define role conforme escolha (substitui o default do trigger)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role as any });

    return { ok: true, userId };
  });

// ─── ALTERAR ROLE ───────────────────────────────────
export const alterarRoleUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "operador"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("Você não pode remover seu próprio acesso de administrador.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role as any });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── ALTERAR SENHA ──────────────────────────────────
export const alterarSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), senha: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("usuarios_painel")
      .update({ senha_plain: data.senha })
      .eq("user_id", data.userId);
    return { ok: true };
  });

// ─── BLOQUEAR ───────────────────────────────────────
export const bloquearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      motivo: z.string().trim().min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    // Banir no Auth (100 anos)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: "876000h",
    } as any);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("usuarios_painel")
      .update({ status: "Bloqueado", motivo_bloqueio: data.motivo })
      .eq("user_id", data.userId);
    return { ok: true };
  });

// ─── DESBLOQUEAR ────────────────────────────────────
export const desbloquearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: "none",
    } as any);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("usuarios_painel")
      .update({ status: "Ativo", motivo_bloqueio: null })
      .eq("user_id", data.userId);
    return { ok: true };
  });

// ─── EXCLUIR ────────────────────────────────────────
export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    await supabaseAdmin.from("usuarios_painel").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── VER SENHA ──────────────────────────────────────
export const verSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { data: row } = await supabaseAdmin
      .from("usuarios_painel")
      .select("senha_plain")
      .eq("user_id", data.userId)
      .maybeSingle();
    return { senha: row?.senha_plain ?? null };
  });
