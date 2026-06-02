/**
 * Server functions de tarifas — tabelas fixas + híbrida.
 * Persistidas em app_config.config_json.tarifas para evitar nova tabela.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TabelaFixa = {
  id: "pgpg" | "pgsv" | "pgsantos" | "pgcubatao";
  titulo: string;
  tarifaMinima: number;
  valorKm: number;
};

export type TabelaHibrida = {
  titulo: string;
  tarifaMinima: number;
  valorKm: number;
};

export type TarifasConfig = {
  tabelasFixas: TabelaFixa[];
  tabelaHibrida: TabelaHibrida;
};

export const TARIFAS_DEFAULT: TarifasConfig = {
  tabelasFixas: [
    { id: "pgpg",      titulo: "Praia Grande → Praia Grande", tarifaMinima: 4.5,  valorKm: 1.2 },
    { id: "pgsv",      titulo: "Praia Grande → São Vicente",  tarifaMinima: 15,   valorKm: 2.0 },
    { id: "pgsantos",  titulo: "Praia Grande → Santos",       tarifaMinima: 20,   valorKm: 2.2 },
    { id: "pgcubatao", titulo: "Praia Grande → Cubatão",      tarifaMinima: 20,   valorKm: 2.2 },
  ],
  tabelaHibrida: { titulo: "Híbrida (outras rotas)", tarifaMinima: 30, valorKm: 3.6 },
};

const TabelaFixaSchema = z.object({
  id: z.enum(["pgpg", "pgsv", "pgsantos", "pgcubatao"]),
  titulo: z.string().min(1).max(80),
  tarifaMinima: z.number().min(0).max(999),
  valorKm: z.number().min(0).max(99),
});

const TarifasSchema = z.object({
  tabelasFixas: z.array(TabelaFixaSchema).length(4),
  tabelaHibrida: z.object({
    titulo: z.string().min(1).max(80),
    tarifaMinima: z.number().min(0).max(999),
    valorKm: z.number().min(0).max(99),
  }),
});

export const lerTarifas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("config_json")
      .eq("id", 1)
      .maybeSingle();
    const raw = (data?.config_json ?? {}) as { tarifas?: Partial<TarifasConfig> };
    const tarifas: TarifasConfig = {
      tabelasFixas: raw.tarifas?.tabelasFixas ?? TARIFAS_DEFAULT.tabelasFixas,
      tabelaHibrida: raw.tarifas?.tabelaHibrida ?? TARIFAS_DEFAULT.tabelaHibrida,
    };
    return { tarifas };
  });

export const salvarTarifas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TarifasSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: atual } = await supabaseAdmin
      .from("app_config")
      .select("config_json")
      .eq("id", 1)
      .maybeSingle();
    const cfg = { ...((atual?.config_json ?? {}) as Record<string, unknown>), tarifas: data };
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: 1, config_json: cfg, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
