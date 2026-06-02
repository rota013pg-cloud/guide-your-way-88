/**
 * Server functions do app do Motorista (Rota 013 Beta).
 *
 * Sessão é autenticada via token gerado em /login e armazenada
 * em motorista_sessoes. Como os motoristas NÃO são auth.users do
 * Supabase, todas as queries usam supabaseAdmin (bypass RLS) e a
 * autorização é feita validando o token contra a tabela de sessões.
 */
import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SALT = "rota013salt";
function hashSenha(senha: string) {
  return createHash("sha256").update(senha + SALT).digest("hex");
}
function gerarToken() {
  return randomBytes(32).toString("hex");
}

async function validarToken(codigo: string, token: string) {
  const { data, error } = await supabaseAdmin
    .from("motorista_sessoes")
    .select("id, motorista_codigo, status")
    .eq("token", token)
    .eq("motorista_codigo", codigo)
    .eq("status", "ativa")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sessão inválida — faça login novamente.");
  return data;
}

// ─── LOGIN ──────────────────────────────────────────────
export const motoristaLogin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string().min(1).max(20),
      senha: z.string().min(1).max(100),
      deviceId: z.string().max(80).optional().default(""),
      deviceNome: z.string().max(120).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const codigo = data.codigo.toUpperCase();

    const { data: auth } = await supabaseAdmin
      .from("motorista_auth")
      .select("*")
      .eq("motorista_codigo", codigo)
      .maybeSingle();
    if (!auth) throw new Error("Motorista não encontrado");
    if (auth.status === "Bloqueado") throw new Error("Acesso bloqueado. Contate a central.");
    if (auth.senha_hash !== hashSenha(data.senha)) throw new Error("Senha incorreta");

    // login único por device
    if (data.deviceId) {
      const { data: sessaoAtiva } = await supabaseAdmin
        .from("motorista_sessoes")
        .select("id")
        .eq("motorista_codigo", codigo)
        .eq("status", "ativa")
        .limit(1)
        .maybeSingle();
      const deviceSalvo = auth.device_id || "";
      if (sessaoAtiva && deviceSalvo && deviceSalvo !== data.deviceId) {
        throw new Error("Você já está logado em outro dispositivo. Faça logout nele primeiro.");
      }
    }

    const { data: motorista } = await supabaseAdmin
      .from("motoristas")
      .select("codigo,nome,foto,moto,placa,cor,telefone,cidade,status")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!motorista) throw new Error("Motorista não cadastrado");

    // encerrar sessões antigas
    await supabaseAdmin
      .from("motorista_sessoes")
      .update({ status: "encerrada" })
      .eq("motorista_codigo", codigo)
      .eq("status", "ativa");

    const token = gerarToken();
    await supabaseAdmin
      .from("motorista_sessoes")
      .insert({ motorista_codigo: codigo, token, device_id: data.deviceId || null, status: "ativa" });

    await supabaseAdmin
      .from("motoristas")
      .update({ status: "Online" })
      .eq("codigo", codigo);

    await supabaseAdmin
      .from("motorista_auth")
      .update({
        device_id: data.deviceId || null,
        device_nome: data.deviceNome || null,
        ultimo_acesso: new Date().toISOString(),
      })
      .eq("motorista_codigo", codigo);

    return { token, motorista };
  });

// ─── ALTERAR SENHA ──────────────────────────────────────
export const motoristaAlterarSenha = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      senhaAtual: z.string().min(1),
      senhaNova: z.string().min(4).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);
    const { data: auth } = await supabaseAdmin
      .from("motorista_auth").select("senha_hash").eq("motorista_codigo", data.codigo).maybeSingle();
    if (!auth) throw new Error("Motorista não encontrado");
    if (auth.senha_hash !== hashSenha(data.senhaAtual)) throw new Error("Senha atual incorreta");
    await supabaseAdmin
      .from("motorista_auth")
      .update({ senha_hash: hashSenha(data.senhaNova), senha_plain: data.senhaNova })
      .eq("motorista_codigo", data.codigo);
    return { ok: true };
  });

// ─── LOGOUT ─────────────────────────────────────────────
export const motoristaLogout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ codigo: z.string(), token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("motorista_sessoes")
      .update({ status: "encerrada" })
      .eq("token", data.token);
    await supabaseAdmin
      .from("motoristas")
      .update({ status: "Offline" })
      .eq("codigo", data.codigo);
    return { ok: true };
  });

// ─── TOGGLE STATUS (online/offline) ─────────────────────
export const motoristaToggleStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      online: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);
    const novoStatus = data.online ? "Online" : "Offline";
    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ status: novoStatus })
      .eq("codigo", data.codigo)
      .neq("status", "Bloqueado");
    if (error) throw new Error(error.message);
    return { status: novoStatus };
  });

// ─── ENVIO DE POSIÇÃO GPS ───────────────────────────────
export const motoristaEnviarGps = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      lat: z.number(),
      lng: z.number(),
      velocidade: z.number().optional().default(0),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);
    await supabaseAdmin.from("motorista_gps").insert({
      motorista_codigo: data.codigo,
      lat: data.lat,
      lng: data.lng,
      velocidade: data.velocidade,
    });
    return { ok: true };
  });

// ─── ACEITAR OFERTA (atômico) ───────────────────────────
export const motoristaAceitarOferta = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      ofertaId: z.number(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);

    // tentativa atômica: só aceita se ainda pendente
    const { data: aceita, error: e1 } = await supabaseAdmin
      .from("corrida_ofertas")
      .update({ status: "aceita" })
      .eq("id", data.ofertaId)
      .eq("motorista_codigo", data.codigo)
      .eq("status", "pendente")
      .select("corrida_id")
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!aceita) throw new Error("Corrida já não está mais disponível.");

    const corridaId = aceita.corrida_id;

    // cancela demais ofertas
    await supabaseAdmin
      .from("corrida_ofertas")
      .update({ status: "cancelada" })
      .eq("corrida_id", corridaId)
      .neq("id", data.ofertaId)
      .eq("status", "pendente");

    const { data: motorista } = await supabaseAdmin
      .from("motoristas")
      .select("nome")
      .eq("codigo", data.codigo)
      .maybeSingle();

    const { data: corrida, error: e2 } = await supabaseAdmin
      .from("corridas")
      .update({
        motorista: motorista?.nome ?? data.codigo,
        motorista_codigo: data.codigo,
        status: "Aceita",
      })
      .eq("id", corridaId)
      .select("*")
      .maybeSingle();
    if (e2) throw new Error(e2.message);

    await supabaseAdmin
      .from("motoristas")
      .update({ status: "Em corrida" })
      .eq("codigo", data.codigo);

    // ── Auto-baixa de diária via crédito adiantado ──
    // Na 1ª corrida do dia operacional, se o motorista tiver créditos,
    // consome 1 e registra a diária como paga automaticamente.
    try {
      const { data: motCred } = await supabaseAdmin
        .from("motoristas")
        .select("creditos_diaria, nome")
        .eq("codigo", data.codigo)
        .maybeSingle();

      if (motCred && (motCred.creditos_diaria ?? 0) > 0) {
        // Valor = 0 porque já foi cobrado no lançamento de "Diária Adiantada".
        // O registro existe apenas para marcar a diária do dia como paga.
        const { error: insErr } = await supabaseAdmin
          .from("financeiro")
          .insert({
            motorista_codigo: data.codigo,
            motorista: motCred.nome,
            valor: 0,
            tipo: "Diária",
            operador: "AUTO (crédito adiantado)",
          });

        // Só decrementa se a inserção foi nova (não conflito de uniq_diaria_dia)
        if (!insErr) {
          await supabaseAdmin
            .from("motoristas")
            .update({ creditos_diaria: motCred.creditos_diaria - 1 })
            .eq("codigo", data.codigo);
        }
      }
    } catch (e) {
      console.error("[creditos-diaria] falhou auto-baixa:", e);
    }

    return { corrida };
  });

// ─── RECUSAR OFERTA ─────────────────────────────────────
export const motoristaRecusarOferta = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      ofertaId: z.number(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);
    await supabaseAdmin
      .from("corrida_ofertas")
      .update({ status: "recusada" })
      .eq("id", data.ofertaId)
      .eq("motorista_codigo", data.codigo);
    return { ok: true };
  });

// ─── ATUALIZAR STATUS DA CORRIDA ────────────────────────
export const motoristaAtualizarStatusCorrida = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      corridaId: z.number(),
      status: z.enum(["A caminho", "Chegou", "Em viagem", "Finalizada"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);

    const patch =
      data.status === "Finalizada"
        ? { status: data.status, finalizada_em: new Date().toISOString() }
        : { status: data.status };

    const { error } = await supabaseAdmin
      .from("corridas")
      .update(patch)
      .eq("id", data.corridaId)
      .eq("motorista_codigo", data.codigo);
    if (error) throw new Error(error.message);

    if (data.status === "Finalizada") {
      const { data: mot } = await supabaseAdmin
        .from("motoristas")
        .select("corridas")
        .eq("codigo", data.codigo)
        .maybeSingle();
      await supabaseAdmin
        .from("motoristas")
        .update({ corridas: (mot?.corridas ?? 0) + 1, status: "Online" })
        .eq("codigo", data.codigo);
    }

    return { ok: true };
  });

// ─── CARREGAR CORRIDA ATUAL DO MOTORISTA ────────────────
export const motoristaCarregarContexto = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ codigo: z.string(), token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);

    const hojeStart = new Date();
    hojeStart.setHours(0, 0, 0, 0);

    const [{ data: motorista }, { data: corridaAtual }, { data: corridasHoje }, { data: ofertaPendente }, { data: cfg }] =
      await Promise.all([
        supabaseAdmin
          .from("motoristas")
          .select("codigo,nome,foto,moto,placa,cor,telefone,cidade,status")
          .eq("codigo", data.codigo)
          .maybeSingle(),
        supabaseAdmin
          .from("corridas")
          .select("*")
          .eq("motorista_codigo", data.codigo)
          .in("status", ["Aceita", "A caminho", "Chegou", "Em viagem"])
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("corridas")
          .select("id,cliente,origem,destino,status,valor_final,criado_em")
          .eq("motorista_codigo", data.codigo)
          .gte("criado_em", hojeStart.toISOString())
          .order("id", { ascending: false }),
        supabaseAdmin
          .from("corrida_ofertas")
          .select("id, corrida_id, status, criado_em")
          .eq("motorista_codigo", data.codigo)
          .eq("status", "pendente")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin.from("app_config").select("config_json").eq("id", 1).maybeSingle(),
      ]);

    let oferta = null;
    if (ofertaPendente) {
      const { data: corridaOferta } = await supabaseAdmin
        .from("corridas")
        .select("id, cliente, origem, destino, valor_final, distancia_km, status")
        .eq("id", ofertaPendente.corrida_id)
        .maybeSingle();
      // Só mostra se a corrida ainda está Pendente (não foi atribuída a outro)
      if (corridaOferta && corridaOferta.status === "Pendente") {
        oferta = {
          ofertaId: ofertaPendente.id,
          corridaId: corridaOferta.id,
          cliente: corridaOferta.cliente,
          origem: corridaOferta.origem,
          destino: corridaOferta.destino,
          valor: Number(corridaOferta.valor_final ?? 0),
          distancia: corridaOferta.distancia_km,
          criadoEm: ofertaPendente.criado_em,
        };
      }
    }

    return {
      motorista,
      corridaAtual,
      corridasHoje: corridasHoje ?? [],
      oferta,
      config: (cfg?.config_json ?? {}) as { valorDiaria?: number; pixChave?: string },
    };
  });

// ─── BUSCAR DETALHES DE UMA CORRIDA ─────────────────────
export const motoristaCarregarCorrida = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ codigo: z.string(), token: z.string(), corridaId: z.number() }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);
    const { data: corrida } = await supabaseAdmin
      .from("corridas")
      .select("*")
      .eq("id", data.corridaId)
      .maybeSingle();
    return { corrida };
  });

// ─── CONCLUIR PARADA ────────────────────────────────────
export const motoristaConcluirParada = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      codigo: z.string(),
      token: z.string(),
      corridaId: z.number(),
      ordem: z.number().int().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await validarToken(data.codigo, data.token);

    const { data: corrida, error: e1 } = await supabaseAdmin
      .from("corridas")
      .select("paradas")
      .eq("id", data.corridaId)
      .eq("motorista_codigo", data.codigo)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!corrida) throw new Error("Corrida não encontrada");

    const paradas = Array.isArray(corrida.paradas) ? (corrida.paradas as Array<Record<string, unknown>>) : [];
    const novas = paradas.map((p) =>
      Number(p.ordem) === data.ordem && !p.concluida_em
        ? { ...p, concluida_em: new Date().toISOString() }
        : p,
    );

    const { error: e2 } = await supabaseAdmin
      .from("corridas")
      .update({ paradas: novas as never })
      .eq("id", data.corridaId)
      .eq("motorista_codigo", data.codigo);
    if (e2) throw new Error(e2.message);

    return { ok: true };
  });
