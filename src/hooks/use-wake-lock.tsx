import { useEffect } from "react";

/**
 * Mantém a tela do dispositivo ligada enquanto o app estiver aberto.
 * Usa Screen Wake Lock API (suportada em Chrome/Android e Safari iOS 16.4+).
 * Re-adquire o lock automaticamente quando o app volta do background.
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        wakeLock = await (navigator as Navigator & {
          wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
        }).wakeLock.request("screen");
        wakeLock?.addEventListener("release", () => {
          // libera referência
          wakeLock = null;
        });
      } catch (e) {
        // ignorar (ex.: aba sem foco, permissão negada)
        console.warn("[wakeLock] falhou:", e);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLock && !cancelled) {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLock?.release().catch(() => {});
      wakeLock = null;
    };
  }, []);
}

// tipos mínimos
interface WakeLockSentinel extends EventTarget {
  release: () => Promise<void>;
}
