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

// Áudio personalizado da oferta (ex.: voz "Nova corrida!"). Fica em
// public/sons/nova-corrida.mp3. Se o arquivo não existir/der erro, cai no
// som sintetizado (playOfertaAlerta).
const OFERTA_SOM_URL = "/sons/nova-corrida.mp3";
let ofertaAudio: HTMLAudioElement | null = null;

function getOfertaAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!ofertaAudio) {
    ofertaAudio = new Audio(OFERTA_SOM_URL);
    ofertaAudio.preload = "auto";
  }
  return ofertaAudio;
}

// "Prime" o elemento de áudio no gesto do usuário, pra poder tocar depois
// a partir de um evento de realtime (política de autoplay do navegador).
function primeOfertaAudio() {
  const a = getOfertaAudio();
  if (!a) return;
  try {
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    } else {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    }
  } catch {
    a.muted = false;
  }
}

function doUnlock() {
  const ac = getCtx();
  if (ac) {
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
  primeOfertaAudio();
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

/**
 * Alerta de NOVA CORRIDA (motociclista). Mais forte e chamativo que o beep de
 * chat: sequência ascendente de notas, volume alto. Pensado para tocar repetido
 * enquanto o card da oferta está na tela.
 */
export function playOfertaAlerta() {
  try {
    const ac = getCtx();
    if (!ac) return;
    if (ac.state === "suspended") void ac.resume();
    const now = ac.currentTime;
    const seq = [660, 880, 1175, 880, 1320]; // toque urgente
    seq.forEach((freq, i) => {
      const t = now + i * 0.15;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.32, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  } catch {
    /* ignore */
  }
}

/**
 * Toca o som personalizado da oferta (public/sons/nova-corrida.mp3).
 * Se o arquivo não existir ou o navegador bloquear, cai no som sintetizado.
 */
export function playOfertaSom() {
  const a = getOfertaAudio();
  if (!a) {
    playOfertaAlerta();
    return;
  }
  try {
    a.muted = false;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.catch(() => playOfertaAlerta());
    }
  } catch {
    playOfertaAlerta();
  }
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
