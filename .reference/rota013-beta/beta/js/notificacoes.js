// ═══════════════════════════════════════════════════════════
//  NOTIFICACOES.JS — Rota 013 Beta 2.0
//  Som + notificação visual no painel do operador
// ═══════════════════════════════════════════════════════════
'use strict';

let _audioCtxOp = null;
let _somDesbloqueado = false;

// ── Desbloquear AudioContext no primeiro clique ───────────
document.addEventListener('click', () => {
  if (_somDesbloqueado) return;
  _somDesbloqueado = true;
  try {
    _audioCtxOp = new (window.AudioContext || window.webkitAudioContext)();
  } catch {}
}, { once: true });

// ── Sons distintos por evento ─────────────────────────────
function tocarSomOp(tipo) {
  if (!_audioCtxOp) {
    try { _audioCtxOp = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return; }
  }
  const ctx = _audioCtxOp;

  const sons = {
    // Nova corrida criada — 2 beeps ascendentes
    nova_corrida: [
      { freq: 600,  start: 0,    dur: 0.12, gain: 0.4 },
      { freq: 900,  start: 0.18, dur: 0.12, gain: 0.4 },
    ],
    // Corrida aceita pelo motorista — 3 tons positivos
    aceita: [
      { freq: 523,  start: 0,    dur: 0.10, gain: 0.35 },
      { freq: 659,  start: 0.12, dur: 0.10, gain: 0.35 },
      { freq: 784,  start: 0.24, dur: 0.18, gain: 0.45 },
    ],
    // Alerta — pagamento / sem motoristas
    alerta: [
      { freq: 440,  start: 0,    dur: 0.15, gain: 0.5 },
      { freq: 330,  start: 0.20, dur: 0.15, gain: 0.5 },
      { freq: 440,  start: 0.40, dur: 0.15, gain: 0.5 },
    ],
    // Status atualizado — 1 bip leve
    status: [
      { freq: 800,  start: 0,    dur: 0.08, gain: 0.25 },
    ]
  };

  const seq = sons[tipo] || sons.status;
  seq.forEach(({ freq, start, dur, gain }) => {
    const osc  = ctx.createOscillator();
    const g    = ctx.createGain();
    osc.type   = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0,    ctx.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
    g.gain.linearRampToValueAtTime(0,    ctx.currentTime + start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  });
}

// ── Notificação toast expandida ───────────────────────────
function notifOp(msg, tipo = 'info', durMs = 5000) {
  // Toast já existente reutilizado
  showToast(msg, durMs);

  // Badge piscante no título da página
  piscaTitle(tipo === 'aceita' ? '✅ Aceita!' : tipo === 'nova' ? '🏍️ Nova!' : '⚠️ Alerta');

  // Browser Notification se permitido
  if (Notification?.permission === 'granted') {
    try {
      new Notification('Rota 013', {
        body: msg.replace(/<[^>]+>/g, ''),
        icon: '/img/icon-192x192.png',
        tag:  'rota013-op',
        renotify: true
      });
    } catch {}
  }
}

// ── Piscar título da aba ──────────────────────────────────
let _titleTimer = null;
let _titleOrig  = document.title;
function piscaTitle(msg) {
  clearInterval(_titleTimer);
  let tog = true;
  _titleTimer = setInterval(() => {
    document.title = tog ? msg : _titleOrig;
    tog = !tog;
  }, 1000);
  setTimeout(() => {
    clearInterval(_titleTimer);
    document.title = _titleOrig;
  }, 10000);
}

// ── Interceptar eventos do Socket para adicionar som ─────
// Aguardar socket estar pronto
function hookSocketNotificacoes() {
  if (!state.socket) {
    setTimeout(hookSocketNotificacoes, 500); return;
  }

  // Nova corrida criada (POST de corrida)
  // — sem evento socket direto, usa o fluxo de oferta

  // Oferta disparada
  state.socket.on('corrida:ofertas', ({ corridaId, motoristas }) => {
    tocarSomOp('nova_corrida');
    notifOp(`📡 Corrida #${corridaId} ofertada para ${motoristas.length} motoristas`, 'nova');
  });

  // Corrida aceita
  state.socket.on('corrida:aceita', ({ corridaId, motoristaNome }) => {
    tocarSomOp('aceita');
    notifOp(`✅ Corrida #${corridaId} aceita por ${motoristaNome}`, 'aceita', 6000);
  });

  // Status atualizado pelo motorista
  state.socket.on('corrida:atualizada', ({ corridaId, status }) => {
    if (['Finalizada', 'A caminho', 'Chegou'].includes(status)) {
      tocarSomOp('status');
    }
  });

  // Alerta operador (sem motoristas)
  state.socket.on('alerta:operador', ({ corridaId, motivo }) => {
    tocarSomOp('alerta');
    notifOp(`⚠️ Corrida #${corridaId} — ${motivo}`, 'alerta', 8000);
  });

  // Pagamento pendente
  state.socket.on('alerta:pagamento_pendente', ({ codigo, nome }) => {
    tocarSomOp('alerta');
    notifOp(`💰 ${nome} (${codigo}) aguardando confirmação de pagamento`, 'alerta', 8000);
  });
}

// ── Solicitar permissão de notificação ────────────────────
async function solicitarPermissaoNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Solicitar permissão após o primeiro clique no painel
  document.addEventListener('click', () => {
    solicitarPermissaoNotif();
  }, { once: true });

  // Hook no socket quando estiver pronto
  hookSocketNotificacoes();
});

window.tocarSomOp = tocarSomOp;
window.notifOp    = notifOp;
