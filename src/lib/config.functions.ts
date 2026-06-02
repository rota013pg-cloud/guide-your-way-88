/**
 * Server functions de configuração da empresa (app_config).
 * Leitura aberta para qualquer operador; escrita só para admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppConfig = {
  empresa: string;
  cidadeBase: string;
  whatsappCentral: string;
  pixChave: string;
  valorDiaria: number;
};

const CONFIG_DEFAULT: AppConfig = {
  empresa: "Rota 013",
  cidadeBase: "Santos",
  whatsappCentral: "",
  pixChave: "",
  valorDiaria: 19.9,
};

const ConfigSchema = z.object({
  empresa: z.string().min(1).max(100),
  cidadeBase: z.string().min(1).max(80),
  whatsappCentral: z.string().max(20).regex(/^\d*$/, "Só números (DDI+DDD+número)"),
  pixChave: z.string().max(120),
  valorDiaria: z.number().positive().max(9999),
});

// ─── LER CONFIG ──────────────────────────────────────────
export const lerConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("config_json, atualizado_em")
      .eq("id", 1)
      .maybeSingle();
    const cfg = { ...CONFIG_DEFAULT, ...((data?.config_json ?? {}) as Partial<AppConfig>) };
    return { config: cfg, atualizadoEm: data?.atualizado_em ?? null };
  });

// ─── SALVAR CONFIG (admin) ───────────────────────────────
export const salvarConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verifica role admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId as string);
    const ehAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!ehAdmin) throw new Error("Apenas administradores podem alterar a configuração.");

    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: 1, config_json: data, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true, config: data };
  });
