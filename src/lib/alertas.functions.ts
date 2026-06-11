import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AlertaMotorista = {
  id: number;
  motorista_codigo: string;
  motorista_nome: string | null;
  tipo: "panico" | "suspeito";
  corrida_id: number | null;
  latitude: number | null;
  longitude: number | null;
  observacao: string | null;
  criado_em: string;
  atendido_em: string | null;
  atendido_por: string | null;
  atendido_observacao: string | null;
};

async function exigirOperador(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "operador"])
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito a operadores.");
}

export const listarAlertasAbertos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirOperador(context.userId);
    const { data, error } = await supabaseAdmin
      .from("motorista_alertas")
      .select("*")
      .is("atendido_em", null)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    const codigos = Array.from(new Set((data ?? []).map((a) => a.motorista_codigo)));
    let nomes: Record<string, string> = {};
    if (codigos.length) {
      const { data: mots } = await supabaseAdmin
        .from("motoristas")
        .select("codigo, nome")
        .in("codigo", codigos);
      nomes = Object.fromEntries((mots ?? []).map((m) => [m.codigo, m.nome]));
    }
    return (data ?? []).map((a) => ({
      ...a,
      motorista_nome: nomes[a.motorista_codigo] ?? null,
    })) as AlertaMotorista[];
  });

export const marcarAlertaAtendido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.number(), observacao: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirOperador(context.userId);
    const { error } = await supabaseAdmin
      .from("motorista_alertas")
      .update({
        atendido_em: new Date().toISOString(),
        atendido_por: context.userId,
        atendido_observacao: data.observacao ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
