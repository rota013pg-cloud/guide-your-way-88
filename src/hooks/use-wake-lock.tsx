import { useEffect } from "react";

/**
 * Mantém a tela do dispositivo ligada enquanto o app estiver aberto.
 * Usa Screen Wake Lock API (suportada em Chrome/Android e Safari iOS 16.4+).
 *
 * Particularidades do iOS:
 * - O lock só é concedido quando a aba está visível e tipicamente após um
 *   gesto do usuário. Por isso, além de tentar adquirir no mount, tentamos
 *   novamente no primeiro toque/clique e sempre que a aba volta do background.
 * - O lock é liberado automaticamente quando o app vai para background ou a
 *   tela é desligada manualmente; precisamos re-adquirir ao voltar.
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (cancelled || wakeLock) return;
      if (document.visibilityState !== "visible") return;
      try {
        wakeLock = await (navigator as Navigator & {
          wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
        }).wakeLock.request("screen");
        wakeLock?.addEventListener("release", () => {
          wakeLock = null;
          // se ainda estiver visível, tenta re-adquirir
          if (!cancelled && document.visibilityState === "visible") {
            void request();
          }
        });
      } catch (e) {
        console.warn("[wakeLock] falhou:", e);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    const handleGesture = () => { void request(); };

    void request();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("touchend", handleGesture, { passive: true });
    window.addEventListener("click", handleGesture);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("touchend", handleGesture);
      window.removeEventListener("click", handleGesture);
      wakeLock?.release().catch(() => {});
      wakeLock = null;
    };
  }, []);
}

interface WakeLockSentinel extends EventTarget {
  release: () => Promise<void>;
}
