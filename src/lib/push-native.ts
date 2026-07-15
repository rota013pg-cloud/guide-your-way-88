/**
 * Push nos apps nativos (Android via FCM). Só roda no app nativo (Capacitor).
 * Pede permissão, cria o canal de alta importância (heads-up), registra e envia
 * o token FCM pro servidor. Foreground mostra um toast.
 */
import { toast } from "sonner";
import { ehNativo } from "@/lib/gps-tracker";
import { registrarPushToken } from "@/lib/motorista.functions";
import { clienteRegistrarPushToken } from "@/lib/chat-cliente.functions";

let iniciado = false;

async function iniciarPush(registrar: (fcmToken: string) => Promise<unknown>): Promise<void> {
  if (!ehNativo() || iniciado) return;
  iniciado = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      iniciado = false;
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
      registrar(tk.value).catch((e) => console.warn("[push] registrar token:", e));
    });
    await PushNotifications.addListener("registrationError", (e) => console.warn("[push] erro:", e));
    await PushNotifications.addListener("pushNotificationReceived", (n) => {
      const t = n.title ?? "Rota 013";
      const b = n.body ?? "";
      toast(`${t}${b ? " — " + b : ""}`);
    });

    await PushNotifications.register();
  } catch (e) {
    iniciado = false;
    console.warn("[push] init:", e);
  }
}

export function iniciarPushMotorista(codigo: string, sessaoToken: string): Promise<void> {
  return iniciarPush((fcmToken) =>
    registrarPushToken({ data: { codigo, token: sessaoToken, fcmToken, plataforma: "android" } }),
  );
}

export function iniciarPushCliente(clienteToken: string): Promise<void> {
  return iniciarPush((fcmToken) =>
    clienteRegistrarPushToken({ data: { token: clienteToken, fcmToken, plataforma: "android" } }),
  );
}
