/**
 * Modo Automático do painel:
 * - Qualquer operador autenticado pode ler/alternar.
 * - Persistido em app_config.config_json.modoAutomatico (boolean).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const lerModoAutomatico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("config_json")
      .eq("id", 1)
      .maybeSingle();
    const cfg = (data?.config_json ?? {}) as Record<string, unknown>;
    return { ativo: Boolean(cfg.modoAutomatico) };
  });

export const definirModoAutomatico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ativo: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { data: atual } = await supabaseAdmin
      .from("app_config")
      .select("config_json")
      .eq("id", 1)
      .maybeSingle();
    const cfg = { ...((atual?.config_json ?? {}) as Record<string, unknown>) };
    cfg.modoAutomatico = data.ativo;
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: 1, config_json: cfg as never, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true, ativo: data.ativo };
  });
