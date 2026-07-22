import { Capacitor } from "@capacitor/core";

/**
 * Rastreamento de posição do motociclista.
 *
 * - No app NATIVO (Capacitor/Android/iOS): usa @transistorsoft/capacitor-background-geolocation.
 *   O envio da posição é feito pela CAMADA NATIVA (HTTP nativo com fila SQLite),
 *   direto no PostgREST do Supabase (RPC motorista_gps_ingerir). Por isso continua
 *   enviando mesmo com a tela bloqueada, com o Waze aberto ou o app em segundo plano
 *   — não depende do JavaScript estar "acordado".
 * - No NAVEGADOR/PWA: mantém o comportamento antigo (navigator.geolocation.watchPosition
 *   + reforço periódico), que só funciona com o app em foreground. Aí o envio é pelo
 *   callback onPos (server function), como antes.
 *
 * A escolha é automática via Capacitor.isNativePlatform().
 */

export type PosicaoGps = { lat: number; lng: number; velocidade: number };
type OnPosicao = (p: PosicaoGps) => void;
export type AuthRastreio = { codigo: string; token: string };

export function ehNativo(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function kmh(speedMs: number | null | undefined): number {
  return speedMs && speedMs > 0 ? Math.round(speedMs * 3.6) : 0;
}

// URL + chave pública do Supabase (mesmas usadas pelo cliente do navegador).
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || (globalThis as any).process?.env?.SUPABASE_URL || "";
const SUPABASE_ANON =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (globalThis as any).process?.env?.SUPABASE_PUBLISHABLE_KEY ||
  "";

// ─── Estado interno ────────────────────────────────────────────────
let webWatchId: number | null = null;
let webInterval: ReturnType<typeof setInterval> | null = null;
let nativoIniciado = false;
let heartbeatRegistrado = false;
let nativoJsInterval: ReturnType<typeof setInterval> | null = null;

// ─── Nativo (background real via Transistorsoft) ───────────────────
async function iniciarNativo(auth: AuthRastreio) {
  // Import dinâmico: o plugin só carrega no app nativo (evita quebrar o build web).
  const mod = await import("@transistorsoft/capacitor-background-geolocation");
  const BackgroundGeolocation = (mod as any).default ?? mod;

  await BackgroundGeolocation.ready({
    reset: true,
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 20, // dispara a cada ~20m de deslocamento
    stationaryRadius: 25,
    // Mesmo PARADO, envia um ponto a cada 60s (a central marca offline sem ping em 90s).
    heartbeatInterval: 60,
    // Entra em modo "parado" rápido (1 min) para o heartbeat começar cedo.
    stopTimeout: 1,
    // ── Envio HTTP NATIVO (independe do JavaScript) ──
    url: `${SUPABASE_URL}/rest/v1/rpc/motorista_gps_ingerir`,
    method: "POST",
    httpRootProperty: "_pontos",
    locationTemplate:
      '{"lat":<%= latitude %>,"lng":<%= longitude %>,"vel":<%= speed %>,"ts":"<%= timestamp %>"}',
    params: { _token: auth.token },
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
    },
    autoSync: true, // envia assim que registra
    batchSync: true, // agrupa vários pontos num POST (bom para escala)
    maxBatchSize: 50,
    // ── Comportamento em background ──
    stopOnTerminate: false,
    startOnBoot: false,
    foregroundService: true,
    backgroundPermissionRationale: {
      title: "Permitir localização o tempo todo",
      message:
        "Para enviar sua posição à central durante as corridas, permita a localização “O tempo todo”.",
      positiveAction: "Abrir ajustes",
    },
    notification: {
      title: "Rota 013 — Online",
      text: "Compartilhando sua localização com a central.",
    },
    locationAuthorizationRequest: "Always",
    enableHeadless: true,
    debug: false,
    logLevel: BackgroundGeolocation.LOG_LEVEL_OFF,
  });

  await BackgroundGeolocation.start();

  // Heartbeat: mesmo parado, força um ponto periódico para manter o motociclista
  // Online (a central marca offline se ficar >90s sem ping) e a posição do cliente
  // atualizada. getCurrentPosition grava e o autoSync envia pela camada nativa.
  if (!heartbeatRegistrado) {
    heartbeatRegistrado = true;
    BackgroundGeolocation.onHeartbeat(() => {
      BackgroundGeolocation.getCurrentPosition({
        samples: 1,
        persist: true,
        maximumAge: 10000,
        timeout: 30,
      }).catch(() => undefined);
    });
  }

  // Ponto inicial imediato ao ficar Online (para não esperar o 1º deslocamento/heartbeat).
  BackgroundGeolocation.getCurrentPosition({ samples: 1, persist: true, timeout: 30 }).catch(
    () => undefined,
  );

  // Reforço em JS a cada 45s: garante o ping quando o app está ABERTO na tela
  // (caso mais comum do motociclista esperando corrida). No background o timer
  // do JS congela, mas aí o heartbeat nativo assume. getCurrentPosition grava+envia.
  if (nativoJsInterval) clearInterval(nativoJsInterval);
  nativoJsInterval = setInterval(() => {
    BackgroundGeolocation.getCurrentPosition({
      samples: 1,
      persist: true,
      maximumAge: 10000,
      timeout: 30,
    }).catch(() => undefined);
  }, 45000);

  nativoIniciado = true;
}

async function pararNativo() {
  if (nativoJsInterval) {
    clearInterval(nativoJsInterval);
    nativoJsInterval = null;
  }
  if (!nativoIniciado) return;
  try {
    const mod = await import("@transistorsoft/capacitor-background-geolocation");
    const BackgroundGeolocation = (mod as any).default ?? mod;
    await BackgroundGeolocation.stop();
  } catch (e) {
    console.warn("[bg-geo] falha ao parar:", e);
  } finally {
    nativoIniciado = false;
  }
}

// ─── Web (foreground) ──────────────────────────────────────────────
function iniciarWeb(onPos: OnPosicao) {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  pararWeb();

  const umTiro = () =>
    navigator.geolocation.getCurrentPosition(
      (pos) => onPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, velocidade: kmh(pos.coords.speed) }),
      (err) => console.warn("GPS (one-shot):", err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

  umTiro();

  webWatchId = navigator.geolocation.watchPosition(
    (pos) => onPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, velocidade: kmh(pos.coords.speed) }),
    (err) => console.warn("GPS:", err.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );

  // Backup: alguns navegadores param o watch sem movimento.
  webInterval = setInterval(umTiro, 10000);
}

function pararWeb() {
  if (webWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(webWatchId);
  }
  webWatchId = null;
  if (webInterval) {
    clearInterval(webInterval);
    webInterval = null;
  }
}

// ─── API pública ───────────────────────────────────────────────────
/**
 * Inicia o rastreamento.
 * - Nativo: configura e liga o plugin (envio nativo). `onPos` NÃO é usado para
 *   enviar ao servidor (o nativo já faz isso), evitando envio duplicado.
 * - Web: usa `onPos` para enviar (server function), como antes.
 * `auth` (código + token) é obrigatório no nativo para autenticar o envio.
 */
export async function iniciarRastreamento(onPos: OnPosicao, auth?: AuthRastreio): Promise<void> {
  if (ehNativo()) {
    if (!auth) {
      console.warn("[bg-geo] sem auth (código/token) — rastreamento nativo não iniciado.");
      return;
    }
    await iniciarNativo(auth);
  } else {
    iniciarWeb(onPos);
  }
}

export async function pararRastreamento(): Promise<void> {
  if (ehNativo()) await pararNativo();
  else pararWeb();
}
