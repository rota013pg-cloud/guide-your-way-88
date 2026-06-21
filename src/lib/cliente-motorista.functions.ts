import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  token: z.string().min(10),
  corridaId: z.number().int().positive(),
});

export const clienteMotoristaCorridaInfo = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Valida sessão do cliente
    const { data: sess } = await supabaseAdmin
      .from("cliente_sessoes")
      .select("cliente_codigo,status")
      .eq("token", data.token)
      .eq("status", "ativa")
      .maybeSingle();
    if (!sess) throw new Error("Sessão inválida");

    // Garante que a corrida pertence ao cliente e pega motorista_codigo
    const { data: corrida } = await supabaseAdmin
      .from("corridas")
      .select("motorista_codigo,cliente_codigo")
      .eq("id", data.corridaId)
      .maybeSingle();
    if (!corrida || corrida.cliente_codigo !== sess.cliente_codigo) {
      throw new Error("Corrida não encontrada");
    }
    if (!corrida.motorista_codigo) return null;

    const { data: m } = await supabaseAdmin
      .from("motoristas")
      .select("codigo,nome,foto,moto,cor,placa,telefone")
      .eq("codigo", corrida.motorista_codigo)
      .maybeSingle();
    return m ?? null;
  });
