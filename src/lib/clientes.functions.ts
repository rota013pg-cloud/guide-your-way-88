import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listarClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("clientes")
      .select("*")
      .order("codigo", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const previewProximoCodigoCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.rpc("preview_proximo_codigo_cliente");
    if (error) throw new Error(error.message);
    return (data as string) ?? "C0001";
  });

const ClienteSchema = z.object({
  codigo: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^C\d{4,}$/).optional()),
  nome: z.string().trim().min(1).max(120),
  telefone: z.string().trim().max(20).optional().default(""),
  endereco: z.string().trim().max(255).optional().default(""),
  cidade: z.string().trim().max(80).optional().default(""),
  indicacao: z.string().trim().max(120).optional().default(""),
  observacoes: z.string().trim().max(500).optional().default(""),
});

export const salvarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ClienteSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.codigo) {
      const { error } = await supabaseAdmin
        .from("clientes")
        .update({
          nome: data.nome,
          telefone: data.telefone,
          endereco: data.endereco,
          cidade: data.cidade,
          indicacao: data.indicacao || null,
          observacoes: data.observacoes || null,
        })
        .eq("codigo", data.codigo);
      if (error) throw new Error(error.message);
      return { codigo: data.codigo };
    }
    // Inserir com código gerado por função SQL (com lock)
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const { data: codigoData, error: e1 } = await supabaseAdmin.rpc("proximo_codigo_cliente");
      if (e1) throw new Error(e1.message);
      const codigo = codigoData as string;
      const { error: e2 } = await supabaseAdmin.from("clientes").insert({
        codigo,
        nome: data.nome,
        telefone: data.telefone,
        endereco: data.endereco,
        cidade: data.cidade,
        indicacao: data.indicacao || null,
        observacoes: data.observacoes || null,
      });
      if (!e2) return { codigo };
      if (!e2.message.includes("duplicate") && !e2.message.includes("unique")) {
        throw new Error(e2.message);
      }
    }
    throw new Error("Não foi possível gerar código único após 5 tentativas.");
  });

export const excluirCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("clientes").delete().eq("codigo", data.codigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
