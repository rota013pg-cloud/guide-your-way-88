/**
 * Push nos apps nativos (Android via FCM). Só roda no app nativo (Capacitor).
 * Pede permissão, cria o canal de alta importância (heads-up), registra e envia
 * o token FCM pro servidor. Foreground mostra um toast.
 *
 * IMPORTANTE (privacidade): o token FCM é do APARELHO, não do usuário. Por isso
 * separamos "iniciar o sistema" (uma vez) de "associar o token ao usuário atual"
 * (toda vez que loga). No logout, o token é REMOVIDO do servidor pra o aparelho
 * não continuar recebendo notificações do usuário anterior.
 */
import { toast } from "sonner";
import { ehNativo } from "@/lib/gps-tracker";
import { registrarPushToken } from "@/lib/motorista.functions";
import { clienteRegistrarPushToken, clienteDesregistrarPushToken } from "@/lib/chat-cliente.functions";

let sistemaIniciado = false;
let ultimoFcmToken: string | null = null;
let registrarAtual: ((fcmToken: string) => Promise<unknown>) | null = null;

/** Sobe o sistema de push (permissão, canal, listeners, register) uma única vez. */
async function garantirSistema(): Promise<void> {
  if (!ehNativo() || sistemaIniciado) return;
  sistemaIniciado = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      sistemaIniciado = false;
      return;
    }

    // Canal de ALTA importância → notificação "heads-up" (banner + som), igual WhatsApp.
    try {
      await PushNotifications.createChannel({
        id: "rota013",
        name: "Rota 013 — Avisos",
        description: "Corridas e mensagens",
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
      });
    } catch (e) {
      console.warn("[push] createChannel:", e);
    }

    await PushNotifications.addListener("registration", (tk) => {
      ultimoFcmToken = tk.value;
      // Associa o token ao usuário logado no momento (se houver).
      registrarAtual?.(tk.value).catch((e) => console.warn("[push] registrar token:", e));
    });
    await PushNotifications.addListener("registrationError", (e) => console.warn("[push] erro:", e));
    await PushNotifications.addListener("pushNotificationReceived", (n) => {
      const t = n.title ?? "Rota 013";
      const b = n.body ?? "";
      toast(`${t}${b ? " — " + b : ""}`);
    });

    await PushNotifications.register();
  } catch (e) {
    sistemaIniciado = false;
    console.warn("[push] init:", e);
  }
}

/**
 * Define quem é o usuário atual do aparelho e (re)registra o token nele.
 * Chamado a cada login — inclusive ao trocar de usuário no mesmo aparelho.
 */
async function associar(registrar: (fcmToken: string) => Promise<unknown>): Promise<void> {
  registrarAtual = registrar;
  await garantirSistema();
  // Se o token já é conhecido (troca de usuário sem reinstalar o app),
  // reassocia na hora — o listener de "registration" pode não disparar de novo.
  if (ultimoFcmToken) {
    registrar(ultimoFcmToken).catch((e) => console.warn("[push] reassociar token:", e));
  }
}

export function iniciarPushMotorista(codigo: string, sessaoToken: string): Promise<void> {
  return associar((fcmToken) =>
    registrarPushToken({ data: { codigo, token: sessaoToken, fcmToken, plataforma: "android" } }),
  );
}

export function iniciarPushCliente(clienteToken: string): Promise<void> {
  return associar((fcmToken) =>
    clienteRegistrarPushToken({ data: { token: clienteToken, fcmToken, plataforma: "android" } }),
  );
}

/**
 * Remove o token deste aparelho do cliente (chamar no logout do cliente).
 * Garante que o aparelho pare de receber push do usuário que saiu.
 */
export async function desregistrarPushCliente(): Promise<void> {
  registrarAtual = null;
  if (!ehNativo() || !ultimoFcmToken) return;
  try {
    await clienteDesregistrarPushToken({ data: { fcmToken: ultimoFcmToken } });
  } catch (e) {
    console.warn("[push] desregistrar cliente:", e);
  }
}
