/**
 * 2FA por e-mail no login do cliente.
 * - clienteLoginIniciar: valida e-mail+senha (RPC), gera o código e envia por
 *   e-mail (Resend). Retorna só o e-mail mascarado — o código nunca vai ao browser.
 * - clienteLoginVerificar: confere o código (RPC) e devolve o token de sessão.
 * As RPCs são restritas a service_role, então só rodam por aqui (supabaseAdmin).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const IniciarSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
  userAgent: z.string().max(200).optional(),
});

const VerificarSchema = z.object({
  email: z.string().email(),
  codigo: z.string().trim().regex(/^\d{6}$/, "O código tem 6 dígitos."),
  userAgent: z.string().max(200).optional(),
});

function mascararEmail(email: string): string {
  const [user, dominio] = email.split("@");
  if (!dominio) return email;
  const visivel = user.length <= 2 ? user.slice(0, 1) : user.slice(0, 2);
  return `${visivel}${"*".repeat(Math.max(2, user.length - visivel.length))}@${dominio}`;
}

function corpoEmail(codigo: string, nome: string) {
  const nomeCurto = (nome || "").split(" ")[0] || "";
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#111;color:#eee;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:22px;font-weight:bold;color:#fff">R<span style="color:#F5C518">013</span></span>
    </div>
    <div style="background:#1b1b1b;border:1px solid #2a2a2a;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">Seu código de acesso</h1>
      <p style="font-size:14px;line-height:1.6;color:#cfcfcf;margin:0 0 20px">
        ${nomeCurto ? "Olá, " + nomeCurto + "! " : ""}Use o código abaixo para concluir o login na sua conta Rota 013.
        Ele expira em 10 minutos.
      </p>
      <div style="text-align:center;margin:0 0 20px">
        <span style="display:inline-block;background:#0f0f0f;border:1px solid #333;border-radius:10px;
          padding:14px 24px;font-size:30px;font-weight:bold;letter-spacing:8px;color:#F5C518">${codigo}</span>
      </div>
      <p style="font-size:12px;line-height:1.6;color:#8a8a8a;margin:0">
        Se você não tentou entrar, ignore este e-mail e, por segurança, troque sua senha.
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#666;margin-top:20px">Rota 013 — Praia Grande / Litoral Sul de SP</p>
  </div>
</body></html>`;
}

export const clienteLoginIniciar = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IniciarSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: r, error } = await supabaseAdmin.rpc("cliente_login_iniciar", {
      _email: data.email.trim(),
      _senha: data.senha,
    });
    if (error) throw new Error(error.message); // "E-mail ou senha inválidos"
    const info = r as { email: string; nome: string; codigo: string };

    // Conta de teste do revisor da loja: senha validada (RPC acima), mas NÃO
    // envia e-mail — o código é fixo (CLIENTE_REVISOR_CODIGO), informado à loja.
    const revisorEmail = process.env.CLIENTE_REVISOR_EMAIL?.trim().toLowerCase();
    if (revisorEmail && data.email.trim().toLowerCase() === revisorEmail) {
      return { ok: true, email: mascararEmail(info.email) };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY ausente");
    const from = process.env.RESEND_FROM ?? "Rota 013 <no-reply@rota013.com.br>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [info.email],
        subject: `${info.codigo} é o seu código de acesso — Rota 013`,
        html: corpoEmail(info.codigo, info.nome),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }

    return { ok: true, email: mascararEmail(info.email) };
  });

export const clienteLoginVerificar = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerificarSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Atalho da conta de teste do revisor da loja: e-mail + código fixo (via env).
    // Cria a sessão direto — o revisor não tem acesso ao e-mail pra pegar o código.
    // Vale só para esse e-mail específico (conta de teste descartável).
    const revisorEmail = process.env.CLIENTE_REVISOR_EMAIL?.trim().toLowerCase();
    const revisorCodigo = process.env.CLIENTE_REVISOR_CODIGO?.trim();
    const emailLower = data.email.trim().toLowerCase();

    // ⚠️ DIAGNÓSTICO 2 TEMPORÁRIO — remover depois. Mostra tudo de uma vez.
    if (data.codigo.trim() === "424242") {
      const { data: a, error: ae } = await supabaseAdmin
        .from("cliente_auth").select("cliente_codigo").eq("email_lower", emailLower).maybeSingle();
      throw new Error(
        `DIAG2 • envEmail="${revisorEmail ?? "UNSET"}" • envCod="${revisorCodigo ?? "UNSET"}" • ` +
        `emailBate=${emailLower === revisorEmail} • codBate=${data.codigo.trim() === revisorCodigo} • ` +
        `contaAchada=${!!a?.cliente_codigo} • authErr="${ae?.message ?? "-"}"`,
      );
    }

    if (revisorEmail && revisorCodigo && emailLower === revisorEmail && data.codigo.trim() === revisorCodigo) {
      const { data: auth } = await supabaseAdmin
        .from("cliente_auth").select("cliente_codigo").eq("email_lower", emailLower).maybeSingle();
      if (auth?.cliente_codigo) {
        const cod = auth.cliente_codigo as string;
        const { randomBytes } = await import("node:crypto");
        const token = randomBytes(32).toString("hex");
        await supabaseAdmin.from("cliente_sessoes").insert({
          cliente_codigo: cod, token, user_agent: data.userAgent ?? null, status: "ativa",
        } as never);
        await supabaseAdmin.from("cliente_login_2fa").delete().eq("cliente_codigo", cod);
        await supabaseAdmin.from("cliente_auth").update({ ultimo_acesso_em: new Date().toISOString() }).eq("cliente_codigo", cod);
        const { data: cli } = await supabaseAdmin.from("clientes").select("nome").eq("codigo", cod).maybeSingle();
        return { token, nome: (cli?.nome as string) ?? "" };
      }
    }

    const { data: r, error } = await supabaseAdmin.rpc("cliente_login_verificar", {
      _email: data.email.trim(),
      _codigo: data.codigo.trim(),
      _user_agent: data.userAgent ?? null,
    });
    if (error) throw new Error(error.message); // "Código incorreto" / "Código expirado" / etc.
    const info = r as { token: string; nome: string; email: string };
    return { token: info.token, nome: info.nome };
  });
