/**
 * Envio de push via Firebase Cloud Messaging (FCM HTTP v1).
 * Server-only. Usa a service account do Firebase (env FIREBASE_SERVICE_ACCOUNT
 * = JSON completo da chave privada) para autenticar. Sem dependências externas:
 * assina o JWT com node:crypto e troca por um access token OAuth2.
 */
import { createSign } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let cacheToken: { value: string; exp: number } | null = null;

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    // env vars às vezes guardam \n literal na private_key
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    return sa;
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT inválido (não é JSON).");
    return null;
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cacheToken && cacheToken.exp - 60 > now) return cacheToken.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = (await res.json()) as { access_token?: string; error?: string };
  if (!j.access_token) throw new Error("FCM auth falhou: " + JSON.stringify(j));
  cacheToken = { value: j.access_token, exp: now + 3600 };
  return j.access_token;
}

export type PushMsg = { title: string; body: string; data?: Record<string, string> };

/** Envia push para os dispositivos dos motociclistas informados. Silencioso se não configurado. */
export async function enviarPushMotorista(codigos: string[], msg: PushMsg): Promise<void> {
  if (codigos.length === 0) return;
  const sa = getServiceAccount();
  if (!sa) return; // push não configurado ainda — não quebra o fluxo

  const { data: toks } = await supabaseAdmin
    .from("motorista_push_tokens")
    .select("fcm_token")
    .in("motorista_codigo", codigos);
  const tokens = (toks ?? []).map((t) => t.fcm_token as string).filter(Boolean);
  if (tokens.length === 0) return;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    console.error("[push]", e);
    return;
  }

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  await Promise.all(
    tokens.map(async (fcmToken) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: fcmToken,
              notification: { title: msg.title, body: msg.body },
              data: msg.data ?? {},
              android: {
                priority: "HIGH",
                notification: {
                  sound: "default",
                  channel_id: "rota013",
                  notification_priority: "PRIORITY_HIGH",
                  default_vibrate_timings: true,
                },
              },
            },
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          // 404/400 UNREGISTERED = token morto → remove
          if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(t)) {
            await supabaseAdmin.from("motorista_push_tokens").delete().eq("fcm_token", fcmToken);
          } else {
            console.error("[push] envio falhou", res.status, t.slice(0, 200));
          }
        }
      } catch (e) {
        console.error("[push] fetch erro", e);
      }
    }),
  );
}
