import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TipoPessoa = "cliente" | "motorista";
export type TipoOcorrencia = "elogio" | "reclamacao" | "ocorrencia" | "advertencia" | "observacao";

export type Ocorrencia = {
  id: string;
  tipo_pessoa: TipoPessoa;
  pessoa_codigo: string;
  tipo: TipoOcorrencia;
  nivel: number;
  descricao: string;
  evidencia_url: string | null;
  corrida_id: number | null;
  operador_nome: string | null;
  criado_em: string;
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

async function exigirAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const listarOcorrencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      tipo_pessoa: z.enum(["cliente", "motorista"]),
      pessoa_codigo: z.string().min(1).max(40),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirOperador(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("ocorrencias_pessoa")
      .select("*")
      .eq("tipo_pessoa", data.tipo_pessoa)
      .eq("pessoa_codigo", data.pessoa_codigo)
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Ocorrencia[];
  });

export const criarOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      tipo_pessoa: z.enum(["cliente", "motorista"]),
      pessoa_codigo: z.string().min(1).max(40),
      tipo: z.enum(["elogio", "reclamacao", "ocorrencia", "advertencia", "observacao"]),
      nivel: z.number().int().min(1).max(4).default(1),
      descricao: z.string().min(3).max(2000),
      evidencia_url: z.string().url().max(500).optional().nullable(),
      corrida_id: z.number().int().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirOperador(context.userId);

    let operadorNome: string | null = null;
    const { data: u } = await supabaseAdmin
      .from("usuarios_painel")
      .select("nome")
      .eq("user_id", context.userId)
      .maybeSingle();
    operadorNome = u?.nome ?? null;

    const { data: row, error } = await supabaseAdmin
      .from("ocorrencias_pessoa")
      .insert({
        tipo_pessoa: data.tipo_pessoa,
        pessoa_codigo: data.pessoa_codigo,
        tipo: data.tipo,
        nivel: data.nivel,
        descricao: data.descricao,
        evidencia_url: data.evidencia_url ?? null,
        corrida_id: data.corrida_id ?? null,
        operador_id: context.userId,
        operador_nome: operadorNome,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Ocorrencia;
  });

export const excluirOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("ocorrencias_pessoa")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
