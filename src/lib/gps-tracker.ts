import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/**
 * Rastreamento de posição do motociclista.
 *
 * - No app NATIVO (Capacitor/Android): usa @capacitor-community/background-geolocation,
 *   que mantém o GPS vivo mesmo com o app em segundo plano ou tela bloqueada,
 *   exibindo uma notificação de serviço em primeiro plano. É isso que resolve o
 *   congelamento do ETA automático e a "sessão inválida" do PWA.
 * - No NAVEGADOR/PWA: mantém o comportamento antigo (navigator.geolocation.watchPosition
 *   + reforço periódico), que só funciona com o app em foreground.
 *
 * A escolha é automática via Capacitor.isNativePlatform(). O mesmo bundle web
 * (publicado na Vercel) roda nos dois ambientes.
 *
 * OBS: o pacote do plugin só traz os TIPOS + código nativo (sem JS de runtime);
 * o objeto do plugin vem do `registerPlugin` do @capacitor/core, que fala com a
 * camada nativa via ponte do Capacitor. Por isso o import do pacote é `import type`.
 */

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type PosicaoGps = { lat: number; lng: number; velocidade: number };
type OnPosicao = (p: PosicaoGps) => void;

export function ehNativo(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ─── Estado interno ────────────────────────────────────────────────
let webWatchId: number | null = null;
let webInterval: ReturnType<typeof setInterval> | null = null;
let nativeWatcherId: string | null = null;
let nativeHeartbeat: ReturnType<typeof setInterval> | null = null;
let ultimaPosNativa: PosicaoGps | null = null;

// A cada quanto tempo reenviar a última posição quando o motociclista está parado
// (o plugin só dispara por deslocamento; sem isso a central marcava offline).
const HEARTBEAT_MS = 45_000;

function kmh(speedMs: number | null | undefined): number {
  return speedMs ? Math.round(speedMs * 3.6) : 0;
}

// ─── Nativo (background) ───────────────────────────────────────────
async function iniciarNativo(onPos: OnPosicao) {
  // Remove watcher anterior, se houver, para não duplicar.
  await pararNativo();
  nativeWatcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: "Rota 013 — Online",
      backgroundMessage: "Compartilhando sua localização com a central enquanto você está online.",
      requestPermissions: true,
      // stale:false = só entrega posições novas (evita pin preso).
      stale: false,
      // dispara a cada ~15m de deslocamento.
      distanceFilter: 15,
    },
    (location, error) => {
      if (error) {
        // NOT_AUTHORIZED = usuário negou a permissão de localização.
        console.warn("[bg-geo]", error.code, error.message ?? "");
        return;
      }
      if (!location) return;
      const p: PosicaoGps = {
        lat: location.latitude,
        lng: location.longitude,
        velocidade: kmh(location.speed),
      };
      ultimaPosNativa = p;
      onPos(p);
    },
  );

  // Batimento: mesmo parado (sem deslocamento -> plugin não dispara), reenvia a
  // última posição periodicamente pra central continuar vendo o motociclista online.
  if (nativeHeartbeat) clearInterval(nativeHeartbeat);
  nativeHeartbeat = setInterval(() => {
    if (ultimaPosNativa) onPos(ultimaPosNativa);
  }, HEARTBEAT_MS);
}

async function pararNativo() {
  if (nativeHeartbeat) {
    clearInterval(nativeHeartbeat);
    nativeHeartbeat = null;
  }
  ultimaPosNativa = null;
  if (!nativeWatcherId) return;
  const id = nativeWatcherId;
  nativeWatcherId = null;
  try {
    await BackgroundGeolocation.removeWatcher({ id });
  } catch (e) {
    console.warn("[bg-geo] falha ao remover watcher:", e);
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
export async function iniciarRastreamento(onPos: OnPosicao): Promise<void> {
  if (ehNativo()) await iniciarNativo(onPos);
  else iniciarWeb(onPos);
}

export async function pararRastreamento(): Promise<void> {
  if (ehNativo()) await pararNativo();
  else pararWeb();
}
