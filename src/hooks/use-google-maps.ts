import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: any;
    __gmapsInitResolve?: () => void;
    __gmapsInitPromise?: Promise<void>;
    __gmapsInitCallback?: () => void;
  }
}

const KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

function load(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsInitPromise) return window.__gmapsInitPromise;
  if (!KEY) return Promise.reject(new Error("VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ausente"));

  window.__gmapsInitPromise = new Promise<void>((resolve, reject) => {
    window.__gmapsInitResolve = resolve;
    window.__gmapsInitCallback = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: KEY,
      libraries: "places",
      language: "pt-BR",
      loading: "async",
      callback: "__gmapsInitCallback",
    });
    if (TRACKING) params.set("channel", TRACKING);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(s);
  });
  return window.__gmapsInitPromise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState<boolean>(() => !!(typeof window !== "undefined" && window.google?.maps?.places));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    load().then(() => setReady(true)).catch((e) => setError(e.message));
  }, [ready]);

  return { ready, error };
}
