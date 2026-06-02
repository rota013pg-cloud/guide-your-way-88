/**
 * Server functions do Histórico operacional.
 * Lista corridas finalizadas/canceladas com filtros.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FiltroSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["Todos", "Finalizada", "Cancelada", "Em viagem", "A caminho", "Chegou"]).optional(),
  motorista: z.string().max(20).optional(),
  cliente: z.string().max(120).optional(),
});

export const listarHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FiltroSchema.parse(d))
  .handler(async ({ data }) => {
    const inicio = `${data.de}T00:00:00-03:00`;
    const fim = `${data.ate}T23:59:59-03:00`;

    let q = supabaseAdmin
      .from("corridas")
      .select("id, cliente, cliente_codigo, telefone_cliente, motorista, motorista_codigo, origem, destino, valor_final, status, pagamento, criado_em, finalizada_em, distancia_km, tipo, observacoes")
      .gte("criado_em", inicio)
      .lte("criado_em", fim)
      .order("criado_em", { ascending: false })
      .limit(500);

    if (data.status && data.status !== "Todos") {
      q = q.eq("status", data.status);
    }
    if (data.motorista) {
      q = q.eq("motorista_codigo", data.motorista);
    }
    if (data.cliente && data.cliente.trim()) {
      const termo = data.cliente.trim().replace(/[,()]/g, "");
      q = q.or(
        `cliente_codigo.eq.${termo},cliente.ilike.%${termo}%,telefone_cliente.ilike.%${termo}%`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const lista = rows ?? [];
    const totalValor = lista
      .filter((r) => r.status === "Finalizada")
      .reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
    const totalFinalizadas = lista.filter((r) => r.status === "Finalizada").length;
    const totalCanceladas = lista.filter((r) => r.status === "Cancelada").length;

    const { data: motoristas } = await supabaseAdmin
      .from("motoristas")
      .select("codigo, nome")
      .order("codigo");

    return {
      lista,
      totalValor,
      totalFinalizadas,
      totalCanceladas,
      motoristas: motoristas ?? [],
    };
  });
