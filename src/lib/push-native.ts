/**
 * Push no app do motociclista (nativo/Android via FCM).
 * Só roda no app nativo (Capacitor). Pede permissão, registra e envia o token
 * FCM pro servidor (registrarPushToken). Background: o Android exibe a
 * notificação sozinho; foreground: mostramos um toast.
 */
import { toast } from "sonner";
import { ehNativo } from "@/lib/gps-tracker";
import { registrarPushToken } from "@/lib/motorista.functions";

let iniciado = false;

export async function iniciarPushMotorista(codigo: string, sessaoToken: string): Promise<void> {
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
        name: "Rota 013 — Corridas e mensagens",
        description: "Novas corridas e mensagens da central",
        importance: 5, // MAX → heads-up
        visibility: 1, // pública
        vibration: true,
        lights: true,
      });
    } catch (e) {
      console.warn("[push] createChannel:", e);
    }

    // Token FCM -> servidor
    await PushNotifications.addListener("registration", (tk) => {
      registrarPushToken({
        data: { codigo, token: sessaoToken, fcmToken: tk.value, plataforma: "android" },
      }).catch((e) => console.warn("[push] registrar token:", e));
    });

    await PushNotifications.addListener("registrationError", (e) =>
      console.warn("[push] erro de registro:", e),
    );

    // App aberto (foreground): Android não mostra o balão sozinho -> toast.
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
