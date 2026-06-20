/**
 * Mural de recados entre operadores.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listarRecados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("mural_recados")
      .select("*")
      .order("fixado", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const criarRecado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ texto: z.string().trim().min(1).max(2000), fixado: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: perfil } = await supabaseAdmin
      .from("usuarios_painel")
      .select("nome")
      .eq("user_id", context.userId as string)
      .maybeSingle();
    const nome = perfil?.nome ?? (context.claims as any)?.email ?? "Operador";
    const { error } = await supabaseAdmin.from("mural_recados").insert({
      autor_user_id: context.userId as string,
      autor_nome: nome,
      texto: data.texto,
      fixado: data.fixado ?? false,
      lido_por: [context.userId],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("mural_recados")
      .select("lido_por")
      .eq("id", data.id)
      .maybeSingle();
    const lidos: string[] = Array.isArray(row?.lido_por) ? (row!.lido_por as any) : [];
    if (!lidos.includes(context.userId as string)) lidos.push(context.userId as string);
    const { error } = await supabaseAdmin
      .from("mural_recados")
      .update({ lido_por: lidos })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const fixarRecado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int().positive(), fixado: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("mural_recados")
      .update({ fixado: data.fixado })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirRecado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId as string;
    const { data: recado } = await supabaseAdmin
      .from("mural_recados")
      .select("autor_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!recado) throw new Error("Recado não encontrado.");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;
    if (recado.autor_user_id !== userId && !isAdmin) {
      throw new Error("Sem permissão para excluir este recado.");
    }
    const { error } = await supabaseAdmin.from("mural_recados").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
