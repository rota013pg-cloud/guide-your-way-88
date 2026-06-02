/**
 * Beep curto via Web Audio API (sem assets). Seguro para chamar em SSR
 * (faz nada fora do browser). Reaproveitado no painel e no app motorista.
 *
 * iOS Safari exige um gesto do usuário para "desbloquear" o AudioContext.
 * Por isso registramos listeners globais que tocam um buffer silencioso
 * no primeiro toque/clique/tecla — assim chamadas futuras de playChatBeep
 * disparadas por eventos de realtime conseguem emitir som.
 */
let ctx: AudioContext | null = null;
let unlocked = false;
let unlockBound = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function doUnlock() {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    // toca um buffer silencioso para satisfazer o iOS
    const buffer = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    src.start(0);
    unlocked = true;
  } catch {
    /* ignore */
  }
}

export function ensureAudioUnlock() {
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  const handler = () => {
    doUnlock();
    if (unlocked) {
      window.removeEventListener("touchend", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    }
  };
  window.addEventListener("touchend", handler, { passive: true });
  window.addEventListener("touchstart", handler, { passive: true });
  window.addEventListener("click", handler);
  window.addEventListener("keydown", handler);
}

export function playChatBeep() {
  try {
    const ac = getCtx();
    if (!ac) return;
    if (ac.state === "suspended") void ac.resume();
    const now = ac.currentTime;
    const tones = [880, 1175]; // duas notas curtas
    tones.forEach((freq, i) => {
      const t = now + i * 0.14;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {
    /* ignore */
  }
}
