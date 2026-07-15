import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const Schema = z.object({ email: z.string().email() });

const APP_BASE = "https://cliente.rota013.com.br";

function corpoEmail(link: string) {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#111;color:#eee;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:22px;font-weight:bold;color:#fff">R<span style="color:#F5C518">013</span></span>
    </div>
    <div style="background:#1b1b1b;border:1px solid #2a2a2a;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">Redefinição de senha</h1>
      <p style="font-size:14px;line-height:1.6;color:#cfcfcf;margin:0 0 20px">
        Recebemos um pedido para redefinir a senha da sua conta Rota 013.
        Clique no botão abaixo para escolher uma nova senha. Este link expira em 1 hora.
      </p>
      <p style="text-align:center;margin:0 0 20px">
        <a href="${link}" style="display:inline-block;background:#F5C518;color:#111;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;font-size:14px">
          Redefinir minha senha
        </a>
      </p>
      <p style="font-size:12px;line-height:1.6;color:#8a8a8a;margin:0">
        Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="color:#cfcfcf;word-break:break-all">${link}</span>
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#666;margin-top:20px">Rota 013 — Praia Grande / Litoral Sul de SP</p>
  </div>
</body></html>`;
}

export const solicitarResetCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailTrim = data.email.trim();
    const emailLower = emailTrim.toLowerCase();

    const { data: conta, error: contaErr } = await supabaseAdmin
      .from("cliente_auth")
      .select("cliente_codigo")
      .eq("email_lower", emailLower)
      .maybeSingle();
    if (contaErr) throw new Error(contaErr.message);

    // Não revela se o e-mail existe — sempre responde ok.
    if (!conta) return { ok: true };

    const token = randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: upErr } = await supabaseAdmin
      .from("cliente_auth")
      .update({ reset_token: token, reset_token_expira_em: expira })
      .eq("cliente_codigo", conta.cliente_codigo);
    if (upErr) throw new Error(upErr.message);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY ausente");
    const from = process.env.RESEND_FROM ?? "Rota 013 <no-reply@rota013.com.br>";
    const link = `${APP_BASE}/cliente/redefinir-senha?token=${token}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [emailTrim],
        subject: "Redefinição de senha — Rota 013",
        html: corpoEmail(link),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }

    return { ok: true };
  });
