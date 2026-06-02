// ═══════════════════════════════════════════════════════
//  BETA-SOCKET.JS — Integração Socket.io no Painel Operador
//  Adiciona comunicação em tempo real com o app do motorista
//  SEM alterar nenhum dos módulos originais do sistema atual
// ═══════════════════════════════════════════════════════

(function () {
  'use strict';

  let _socket = null;
  const MAPS_KEY = 'AIzaSyAooFL5cJ-udcB7MWxSme4ZYSvRLz80DgM';

  // ── Indicador de conexão no topbar ─────────────────
  function setConnStatus(ok, msg) {
    const el = document.getElementById('statusBackend');
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? 'var(--green)' : 'var(--red)';
  }

  // ── Conectar socket (após login) ────────────────────
  function conectar() {
    if (_socket) return;
    const s   = document.createElement('script');
    s.src     = '/socket.io/socket.io.js';
    s.onload  = _init;
    document.head.appendChild(s);
  }

  function _init() {
    _socket = io(window.location.origin, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1500
    });

    _socket.on('connect', () => {
      setConnStatus(true, '🟢 Servidor online');
      _socket.emit('operador:online');
    });

    // Recarregar dados quando servidor notificar mudança
    _socket.on('dados:atualizados', function() {
      if (typeof carregarDados === 'function') {
        carregarDados().then(function() {
          if (typeof renderAll === 'function') renderAll();
          if (typeof renderDashboard === 'function') renderDashboard();
        }).catch(function(){
          if (typeof renderAll === 'function') renderAll();
        });
      }
    });

    _socket.on('disconnect', () => {
      setConnStatus(false, '🔴 Desconectado');
    });

    // ── GPS dos motoristas ──────────────────────────
    const pins = {};
    _socket.on('gps:snapshot', posicoes => {
      Object.entries(posicoes).forEach(([cod, p]) => {
        _atualizarPinDash(cod, p.lat, p.lng, pins);
      });
    });
    _socket.on('gps:update', ({ codigo, lat, lng }) => {
      _atualizarPinDash(codigo, lat, lng, pins);
    });

    // ── Corrida aceita pelo motorista ───────────────
    _socket.on('corrida:aceita', ({ corridaId, motoristaCodigo, motoristaNome }) => {
      const c   = state.corridas.find(x => x.id == corridaId);
      if (c) {
        c.status          = 'Aceita';
        c.motoristaCodigo = motoristaCodigo;
        c.motorista       = motoristaNome;
      }
      renderDashboard();
      if (typeof renderCorridas === 'function') renderCorridas();
      showToast(`✅ Corrida #${corridaId} aceita por ${motoristaNome}!`);
      _somOp('aceita');
    });

    // ── Status atualizado pelo motorista ────────────
    _socket.on('corrida:atualizada', ({ corridaId, status, motoristaCodigo }) => {
      const c = state.corridas.find(x => x.id == corridaId);
      if (c) c.status = status;
      renderDashboard();
      if (typeof renderCorridas === 'function') renderCorridas();
      if (['Finalizada','A caminho','Chegou'].includes(status)) _somOp('status');
    });

    // ── Oferta disparada ────────────────────────────
    _socket.on('corrida:ofertas', ({ corridaId, motoristas, timeout }) => {
      const c = state.corridas.find(x => x.id == corridaId);
      if (c) c.status = 'Divulgada';
      renderDashboard();
      if (typeof renderCorridas === 'function') renderCorridas();
      showToast(`📡 Corrida #${corridaId} enviada para ${motoristas.length} motorista(s)`);
      _somOp('nova_corrida');
    });

    // ── Alerta: sem motoristas ──────────────────────
    _socket.on('alerta:operador', ({ corridaId, motivo }) => {
      showToast(`⚠️ Corrida #${corridaId}: ${motivo}`, 6000);
      _somOp('alerta');
    });

    // ── Pagamento pendente do motorista ─────────────
    _socket.on('alerta:pagamento_pendente', ({ codigo, nome }) => {
      _adicionarAlertaPagamento(codigo, nome);
      _somOp('alerta');
    });

    // ── Diária confirmada ───────────────────────────
    _socket.on('diaria:confirmada', ({ codigo }) => {
      _removerAlertaPagamento(codigo);
      carregarDados();
    });

    // ── Status motorista ────────────────────────────
    _socket.on('motorista:status', ({ codigo, status }) => {
      const m = state.motoristas.find(x => x.codigo === codigo);
      if (m) m.status = status === 'Disponivel' ? 'Online' : status;
      renderDashboard();
    });
  }

  // ── Mapa Leaflet no dashboard ───────────────────────
  let _mapa = null;
  function _iniciarMapa() { /* mapa inicializado no HTML */ }

  
  function _criarMapa(el) {
    _mapa = L.map(el, { zoomControl: true }).setView([-24.0122, -46.4097], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(_mapa);
    setTimeout(() => _mapa.invalidateSize(), 200);
  }

  const _dashPins = {};
  function _atualizarPinDash(codigo, lat, lng, pins) {
    // Usar funcao global inicializada no HTML
    if (window._atualizarPinMapa) {
      const m = state.motoristas.find(function(x){ return x.codigo === codigo; });
      window._atualizarPinMapa(codigo, lat, lng, m ? m.nome : codigo);
      return;
    }
    if (!_mapa) return;
    const m    = state.motoristas.find(x => x.codigo === codigo);
    const nome = m?.nome || codigo;
    if (_dashPins[codigo]) {
      _dashPins[codigo].setLatLng([lat, lng]);
    } else {
      const ic = L.divIcon({
        className: '',
        html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px" title="${nome}">
          <div style="background:#f7c600;color:#111;font-size:10px;font-weight:800;padding:2px 6px;
                      border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4)">
            ${codigo}
          </div>
          <div style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">🏍️</div>
        </div>`,
        iconSize: [40, 40], iconAnchor: [20, 36]
      });
      _dashPins[codigo] = L.marker([lat, lng], { icon: ic })
        .addTo(_mapa)
        .bindPopup(`<b>${nome}</b><br><small>${codigo}</small>`);
    }
  }

  // ── Alertas de pagamento no topo ────────────────────
  const _alertasPag = {};
  function _adicionarAlertaPagamento(codigo, nome) {
    _removerAlertaPagamento(codigo);
    const wrap = document.querySelector('.content') || document.body;
    const div  = document.createElement('div');
    div.dataset.codigo = codigo;
    div.style.cssText  = `background:#fff8e7;border:2px solid #f97316;border-radius:14px;padding:14px 18px;
      margin:12px;display:flex;align-items:center;gap:12px;font-size:14px;`;
    div.innerHTML = `
      <span style="font-size:22px">💰</span>
      <span><b>${nome}</b> (${codigo}) avisou pagamento da diária.</span>
      <button class="btn primary" onclick="liberarDiariaSocket('${codigo}','${nome}')" style="margin-left:auto;white-space:nowrap">
        ✅ Confirmar e Liberar
      </button>
      <button onclick="this.closest('[data-codigo]').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#888">✕</button>`;
    wrap.prepend(div);
    _alertasPag[codigo] = div;
  }

  function _removerAlertaPagamento(codigo) {
    _alertasPag[codigo]?.remove();
    delete _alertasPag[codigo];
  }

  // ── Liberar diária a partir do painel ──────────────
  window.liberarDiariaSocket = async function (codigo, nome) {
    try {
      const res  = await fetch('/beta/api/push/liberar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo })
      });
      const data = await res.json();
      _removerAlertaPagamento(codigo);
      const msg  = `✅ ${nome} liberado!` + (data.registrou ? ' Diária registrada.' : ' (já registrada)');
      showToast(msg, 5000);
      carregarDados();
    } catch (e) {
      showToast('Erro ao liberar: ' + e.message);
    }
  };

  // ── Som de notificação ──────────────────────────────
  let _ctx = null;
  function _somOp(tipo) {
    try {
      if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sons = {
        nova_corrida: [[600,0],[900,.18]],
        aceita:       [[523,0],[659,.12],[784,.24]],
        alerta:       [[440,0],[330,.20],[440,.40]],
        status:       [[800,0]]
      };
      (sons[tipo] || sons.status).forEach(([freq, start]) => {
        const osc  = _ctx.createOscillator();
        const gain = _ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, _ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(.4, _ctx.currentTime + start + .01);
        gain.gain.linearRampToValueAtTime(0,  _ctx.currentTime + start + .12);
        osc.connect(gain); gain.connect(_ctx.destination);
        osc.start(_ctx.currentTime + start);
        osc.stop(_ctx.currentTime + start + .18);
      });
    } catch {}
  }
  document.addEventListener('click', () => {
    if (!_ctx) try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }, { once: true });

  // ── Injetar mapa no dashboard ───────────────────────
  function _injetarMapaDash() { /* mapa inicializado no HTML */ }

  
  // ── Integrar com o sistema após login ──────────────
  const _origAbrirPainel = window.abrirPainel;
  window.abrirPainel = async function (op) {
    await _origAbrirPainel?.(op);
    setTimeout(() => {
      conectar();
    }, 300);
    // Mapa com delay maior — garantir DOM e Leaflet prontos
    setTimeout(() => { _injetarMapaDash(); }, 1200);
  };

  // ── Injetar modal de status dedicado ───────────────
  // Adicionar botão de oferta app ao salvar corrida nova
  const _origSalvarCorrida = window.salvarCorrida;
  window.salvarCorrida = async function () {
    const antesCount = state.corridas.length;
    await _origSalvarCorrida?.apply(this, arguments);
    const depois = state.corridas[0];
    if (depois && state.corridas.length > antesCount && depois.id) {
      // Disparar oferta para o app
      setTimeout(async () => {
        try {
          await fetch(`/beta/api/corridas/${depois.id}/ofertar`, { method: 'POST' });
        } catch {}
      }, 500);
    }
  };

})();




// Recarregar dados ao finalizar corrida
if (window._socket) {
  _socket.on('corrida:finalizada_dados', function() {
    if (typeof carregarDados === 'function') carregarDados().then(renderAll);
  });
}
