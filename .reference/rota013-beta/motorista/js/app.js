// ═══════════════════════════════════════════════════════
//  APP.JS — Rota 013 Motorista — Beta Turbo
// ═══════════════════════════════════════════════════════
const API = '/beta/api';
const MAPS_KEY = 'AIzaSyAooFL5cJ-udcB7MWxSme4ZYSvRLz80DgM';

const state = {
  motorista: null, token: null, online: false,
  corridaAtual: null, ofertaAtual: null,
  socket: null, gpsWatch: null, countdown: null,
  wakeLock: null, ultimaPosicao: null, gpsHeartbeat: null,
  mapGoogle: null, directionsService: null, directionsRenderer: null,
  bloqueado: false, configBeta: null
};

// ─── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const sessao = localStorage.getItem('rota013_motorista');
  if (sessao) {
    try {
      const { motorista, token } = JSON.parse(sessao);
      state.motorista = motorista; state.token = token;
      await carregarConfig();
      mostrarHome();
      conectarSocket();
    } catch { mostrarLogin(); }
  } else { mostrarLogin(); }
});

async function carregarConfig() {
  try {
    const r = await fetch(`${API}/config`);
    state.configBeta = await r.json();
  } catch {}
}

// ─── Telas ───────────────────────────────────────────
function mostrarLogin()    { mostrarTela('telaLogin'); }
function mostrarHome()     { mostrarTela('telaHome'); renderHome(); }
function mostrarCorrente() { mostrarTela('telaCorrente'); renderCorrente(); }
function voltarHome()      { mostrarTela('telaHome'); }

function mostrarTela(id) {
  document.querySelectorAll('.tela').forEach(t => t.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

// ─── Login ───────────────────────────────────────────
async function fazerLogin() {
  const codigo = document.getElementById('loginCodigo').value.trim().toUpperCase();
  const senha  = document.getElementById('loginSenha').value;
  const erroEl = document.getElementById('loginErro');
  erroEl.textContent = '';
  if (!codigo || !senha) { erroEl.textContent = 'Preencha código e senha.'; return; }
  showAguarde();
  try {
    const res  = await fetch(`${API}/motorista-auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo, senha,
        deviceId: (function(){
          var d = localStorage.getItem('rota013_device_id');
          if (!d) { d = 'dev_'+Date.now()+'_'+Math.random().toString(36).slice(2,8); localStorage.setItem('rota013_device_id',d); }
          return d;
        })()
      })
    });
    const data = await res.json();
    hideAguarde();
    if (!res.ok) { erroEl.textContent = data.erro || 'Erro ao entrar.'; return; }
    state.motorista = data.motorista;
    state.token     = data.token;
    localStorage.setItem('rota013_motorista', JSON.stringify({ motorista: data.motorista, token: data.token }));
    await carregarConfig();
    mostrarHome();
    conectarSocket();
    registrarPush();
  } catch(e) { hideAguarde(); erroEl.textContent = 'Erro de conexão.'; }
}

async function sair() {
  if (!confirm('Deseja sair?')) return;
  // Fechar modal de perfil se estiver aberto
  const modal = document.getElementById('modalPerfilMot');
  if (modal) modal.classList.add('hidden');
  // Esconder bottom nav
  const nav = document.getElementById('bottomNav');
  if (nav) nav.classList.remove('visivel');
  try {
    await fetch(`${API}/motorista-auth/logout`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token: state.token })
    });
  } catch {}
  pararGPS();
  desconectarSocket();
  desativarWakeLock();
  localStorage.removeItem('rota013_motorista');
  Object.assign(state, { motorista:null, token:null, online:false, corridaAtual:null, bloqueado:false, pagamentoPendente:false });
  mostrarLogin();
}

// ─── Home ────────────────────────────────────────────
async function renderHome() {
  const m = state.motorista; if (!m) return;
  const av = document.getElementById('fotoPerfil');
  if (m.foto) { av.style.backgroundImage=`url('${m.foto}')`; av.textContent=''; }
  else { av.style.backgroundImage=''; av.textContent=(m.nome||'M').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(); }
  document.getElementById('nomeMotorista').textContent = m.nome || '-';
  document.getElementById('motoInfo').textContent      = `${m.moto||''} • ${m.placa||''}`;
  atualizarStatusVisual();

  // Se tem corrida ativa retomar
  if (state.corridaAtual && ['Aceita','A caminho','Chegou'].includes(state.corridaAtual.status)) {
    mostrarCorrente(); return;
  }
  carregarCorridasHoje();
}

function atualizarStatusVisual() {
  const _g = id => document.getElementById(id);
  const _q = sel => document.querySelector(sel);

  // Toggle switch premium
  const _track = _q('.toggle-track');
  const _tlabel = _g('toggleLabel');
  if (_track)  _track.classList.toggle('is-online', !!state.online);
  if (_tlabel) _tlabel.textContent = state.online ? 'ONLINE' : 'OFFLINE';

  // Status dot e texto
  const dot = _g('statusDot');
  const txt = _g('statusTexto');
  if (dot) dot.className = 'status-dot ' + (state.online ? 'online' : 'offline');
  if (txt) txt.textContent = state.online
    ? 'Online — aguardando corridas'
    : 'Offline';

  // Botão toggle (fallback para versão antiga)
  const btn = _g('btnToggleStatus');
  if (btn) {
    btn.textContent = state.online ? 'Ficar Offline' : 'Ficar Online';
    btn.className   = 'btn-status' + (state.online ? ' online' : '');
  }

  // Diária
  const diaria = Number(state.configBeta?.valorDiaria || 19.90);
  const ganhoHoje = (state.corridasHojeList || [])
    .reduce((s, c) => s + Number(c.valorFinal || c.valor_final || 0), 0);
  const limiar = diaria * 0.5;
  const st = _g('diariaSt');
  if (st) {
    if (state.bloqueado)       st.textContent = '🔒';
    else if (ganhoHoje >= diaria) st.textContent = '✅';
    else if (ganhoHoje >= limiar) st.textContent = '⚡';
    else                          st.textContent = '⏳';
  }
}


async function toggleStatus() {
  if (!state.socket) { showToast('Sem conexão'); return; }
  if (state.bloqueado && !state.online) { mostrarBloqueio(); return; }
  state.online = !state.online;
  if (state.online) {
    state.socket.emit('motorista:online', { codigo: state.motorista.codigo, token: state.token });
    iniciarGPS();
    ativarWakeLock();
  } else {
    state.socket.emit('motorista:offline', { codigo: state.motorista.codigo });
    pararGPS();
    if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; }
  }
  atualizarStatusVisual();
}

async function carregarCorridasHoje() {
  try {
    const hoje = new Date().toLocaleDateString('sv'); // YYYY-MM-DD local
    const res  = await fetch(`${API}/corridas`);
    const todas = await res.json();
    const minhas = todas.filter(c => c.motoristaCodigo===state.motorista.codigo && (c.criadoEm||'').startsWith(hoje));
    const fins   = minhas.filter(c => c.status==='Finalizada');
    const ganho  = fins.reduce((s,c) => s+(c.valorFinal||0), 0);
    document.getElementById('corridasHoje').textContent = fins.length;
    document.getElementById('ganhoHoje').textContent    = `R$ ${ganho.toFixed(2).replace('.',',')}`;

    // Verificar bloqueio diária
    await verificarBloqueio(ganho);

    const lista = document.getElementById('listaUltimas');
    lista.innerHTML = minhas.length
      ? minhas.slice(0,8).map(c=>`
          <div class="corrida-item">
            <div class="corrida-item-header">
              <span class="corrida-item-id">#${c.id} — ${c.cliente}</span>
              <span class="corrida-item-valor">R$ ${(c.valorFinal||0).toFixed(2).replace('.',',')}</span>
            </div>
            <div class="corrida-item-end">📍 ${c.origem}<br>🏁 ${c.destino}</div>
            <div style="margin-top:6px"><span class="badge ${badgeClass(c.status)}">${c.status}</span></div>
          </div>`).join('')
      : '<div class="empty-msg">Nenhuma corrida hoje</div>';
  } catch(e) { console.error(e); }
}

// ─── Verificar bloqueio de diária ────────────────────
async function verificarBloqueio(ganhoAtual) {
  const cfg    = state.configBeta;
  const diaria = Number(cfg?.valorDiaria || 20);
  const limiar = diaria * 0.5; // 50% da diária

  // Verificar se já pagou diária hoje
  try {
    const hoje  = new Date().toISOString().split('T')[0];
    const res   = await fetch(`${API}/financeiro`);
    const fins  = await res.json();
    const pagou = fins.some(f =>
      (f.motoristaCodigo||f.motorista_codigo) === state.motorista.codigo &&
      f.tipo === 'Diária' && (f.data||'').startsWith(hoje)
    );

    if (pagou) {
      state.bloqueado = false;
      document.getElementById('diariaSt').textContent = '✅';
      document.getElementById('cardDiaria').style.borderColor = 'var(--green)';
      return;
    }

    if (ganhoAtual >= limiar) {
      state.bloqueado = true;
      document.getElementById('diariaSt').textContent = '⚠️';
      document.getElementById('cardDiaria').style.borderColor = 'var(--orange)';
      if (state.online) mostrarBloqueio();
    }
  } catch {}
}

function mostrarBloqueio() {
  const cfg    = state.configBeta;
  const diaria = Number(cfg?.valorDiaria || 20);
  const ganho  = parseFloat(document.getElementById('ganhoHoje').textContent.replace('R$ ','').replace(',','.')) || 0;
  const pix    = cfg?.pixChave || 'Chave Pix não configurada';

  document.getElementById('bloqueioMsg').textContent =
    `Você recebeu R$ ${ganho.toFixed(2).replace('.',',')} hoje. Ao atingir 50% da diária (R$ ${(diaria*0.5).toFixed(2).replace('.',',')}), é necessário quitar a diária de R$ ${diaria.toFixed(2).replace('.',',')} para continuar recebendo corridas.`;
  document.getElementById('pixChave').textContent = pix;

  // Pausar online se estava
  if (state.online) {
    state.online = false;
    state.socket?.emit('motorista:offline', { codigo: state.motorista.codigo });
    pararGPS();
    atualizarStatusVisual();
  }

  document.getElementById('modalBloqueio').classList.remove('hidden');
}

function copiarPix() {
  const chave = document.getElementById('pixChave').textContent;
  navigator.clipboard?.writeText(chave).catch(()=>{});
  showToast('Chave Pix copiada! ✅');
}

async function jaEnviei() {
  document.getElementById('modalBloqueio').classList.add('hidden');
  showToast('Aguardando confirmação do operador...');
  // Notificar operador via socket
  state.socket?.emit('motorista:pagamento_pendente', {
    codigo: state.motorista.codigo,
    nome:   state.motorista.nome
  });
}

// ─── Corrida em andamento ────────────────────────────
function renderCorrente() {
  const c = state.corridaAtual; if (!c) return;
  document.getElementById('cCliente').textContent = c.cliente || '-';
  document.getElementById('cOrigem').textContent  = c.origem  || '-';
  document.getElementById('cDestino').textContent = c.destino || '-';
  document.getElementById('cValor').textContent   = `R$ ${(c.valorFinal||0).toFixed(2).replace('.',',')}`;
  document.getElementById('corridaStatusBadge').textContent = c.status || 'Aceita';
  renderAcoes();
  carregarMapa();
}

function renderAcoes() {
  const c  = state.corridaAtual;
  const el = document.getElementById('acoesCorrente');
  const b  = {
    'Aceita':    `<button class="btn-acao caminho"   onclick="atualizarStatus('A caminho')">🏍️ A caminho</button>`,
    'A caminho': `<button class="btn-acao chegou"    onclick="atualizarStatus('Chegou')">📍 Cheguei ao local</button>`,
    'Chegou':    `<button class="btn-acao finalizar" onclick="atualizarStatus('Finalizada')">✅ Finalizar corrida</button>`
  };
  el.innerHTML = b[c?.status] || '';
}

async function atualizarStatus(s) {
  const c = state.corridaAtual;
  if (!c || !c.id) { showToast('Erro: corrida não identificada'); return; }
  showAguarde();
  state.socket?.emit('corrida:status', { corridaId:c.id, status:s, motoristaCodigo:state.motorista.codigo });
  try {
    await fetch(`${API}/corridas/${c.id}/status`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status:s, motoristaCodigo:state.motorista.codigo })
    });
  } catch {}
  state.corridaAtual.status = s;
  const badge = document.getElementById('corridaStatusBadge');
  if (badge) badge.textContent = s;
  renderAcoes(); hideAguarde();
  if (s === 'Finalizada') {
    showToast('Corrida finalizada! ✅');
    setTimeout(async () => {
      state.corridaAtual = null;
      mostrarHome();
      await carregarCorridasHoje();
    }, 1500);
  }
}

function irOrigem() {
  const c = state.corridaAtual; if (!c) return;
  window.open(`https://waze.com/ul?q=${encodeURIComponent(c.origem)}`, '_blank');
  if (c.status === 'Aceita') setTimeout(() => atualizarStatus('A caminho'), 1000);
}
function irDestino() {
  const c = state.corridaAtual; if (!c) return;
  window.open(`https://waze.com/ul?q=${encodeURIComponent(c.destino)}`, '_blank');
  if (c.status === 'A caminho') setTimeout(() => atualizarStatus('Chegou'), 1000);
}
function abrirWaze(tipo) {
  if (tipo === 'origem') { irOrigem(); return; }
  if (tipo === 'destino') { irDestino(); return; }
  const c = state.corridaAtual; if (!c) return;
  window.open(`https://waze.com/ul?q=${encodeURIComponent(tipo==='origem'?c.origem:c.destino)}`, '_blank');
}

// ─── Google Maps ─────────────────────────────────────
function carregarMapa() {
  const c = state.corridaAtual; if (!c) return;
  const div = document.getElementById('mapaGoogle');
  const ph  = document.getElementById('mapaPlaceholder');

  if (typeof google === 'undefined') {
    // Carregar SDK Google Maps
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initGoogleMaps`;
    s.async = true;
    document.head.appendChild(s);
    window.initGoogleMaps = () => desenharRota();
    return;
  }
  desenharRota();
}

function desenharRota() {
  const c  = state.corridaAtual; if (!c) return;
  const divEl = document.getElementById('mapaGoogle');
  const ph    = document.getElementById('mapaPlaceholder');

  if (!state.mapGoogle) {
    state.mapGoogle = new google.maps.Map(divEl, {
      zoom: 13,
      center: { lat: -24.0122, lng: -46.4097 },
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      styles: [{ elementType:'geometry', stylers:[{color:'#242f3e'}] },
               { elementType:'labels.text.stroke', stylers:[{color:'#242f3e'}] },
               { elementType:'labels.text.fill', stylers:[{color:'#746855'}] },
               { featureType:'road', elementType:'geometry', stylers:[{color:'#38414e'}] },
               { featureType:'road', elementType:'geometry.stroke', stylers:[{color:'#212a37'}] },
               { featureType:'road', elementType:'labels.text.fill', stylers:[{color:'#9ca5b3'}] },
               { featureType:'road.highway', elementType:'geometry', stylers:[{color:'#746855'}] },
               { featureType:'water', elementType:'geometry', stylers:[{color:'#17263c'}] }]
    });
    state.directionsService  = new google.maps.DirectionsService();
    state.directionsRenderer = new google.maps.DirectionsRenderer({
      map: state.mapGoogle,
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#f7c600', strokeWeight: 5 }
    });
  }

  divEl.style.display = 'block';
  ph.style.display    = 'none';

  state.directionsService.route({
    origin:      c.origem + ', Praia Grande, SP',
    destination: c.destino + ', SP',
    travelMode:  google.maps.TravelMode.DRIVING
  }, (result, status) => {
    if (status === 'OK') {
      state.directionsRenderer.setDirections(result);
    } else {
      // Fallback: só centralizar na origem
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          state.mapGoogle.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
      }
    }
  });

  // Adicionar marcador do motorista (atualiza com GPS)
  if (!state.pinMotorista && state.ultimaPosicao) {
    state.pinMotorista = new google.maps.Marker({
      position: { lat: state.ultimaPosicao.lat, lng: state.ultimaPosicao.lng },
      map: state.mapGoogle,
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="#f7c600" stroke="white" stroke-width="2"/>
          <text x="16" y="21" text-anchor="middle" font-size="16">🏍️</text>
        </svg>`), scaledSize: new google.maps.Size(32, 32) }
    });
  }
}

// ─── Modal de oferta ─────────────────────────────────
function mostrarOferta(oferta) {
  state.ofertaAtual = oferta;
  document.getElementById('ofCliente').textContent = oferta.cliente;
  document.getElementById('ofOrigem').textContent  = oferta.origem;
  document.getElementById('ofDestino').textContent = oferta.destino;
  document.getElementById('ofValor').textContent   = `R$ ${(oferta.valor||0).toFixed(2).replace('.',',')}`;
  document.getElementById('modalOferta').classList.remove('hidden');
  // Vibrar
  try { navigator.vibrate?.([200,100,200,100,200]); } catch {}
  iniciarContagem(oferta.timeout || 30000);
}

function fecharOferta() {
  document.getElementById('modalOferta').classList.add('hidden');
  pararContagem();
  state.ofertaAtual = null;
}

function iniciarContagem(ms) {
  pararContagem();
  const circ  = document.getElementById('cdCircle');
  const num   = document.getElementById('cdNum');
  const total = ms; const inicio = Date.now();
  state.countdown = setInterval(() => {
    const rest = Math.max(0, total - (Date.now() - inicio));
    num.textContent = Math.ceil(rest/1000);
    circ.style.strokeDashoffset = 213.6 * (1 - rest/total);
    if (rest <= 0) { pararContagem(); fecharOferta(); }
  }, 100);
}

function pararContagem() {
  if (state.countdown) { clearInterval(state.countdown); state.countdown = null; }
}

async function aceitarOferta() {
  const o = state.ofertaAtual; if (!o) return;
  pararContagem();
  showAguarde();
  state.socket?.emit('oferta:aceitar', { ofertaId:o.ofertaId, motoristaCodigo:state.motorista.codigo });
}

function recusarOferta() {
  const o = state.ofertaAtual; if (!o) return;
  pararContagem();
  state.socket?.emit('oferta:recusar', { ofertaId:o.ofertaId, motoristaCodigo:state.motorista.codigo });
  fecharOferta();
  showToast('Corrida recusada');
}

// ─── Socket.io ────────────────────────────────────────
function conectarSocket() {
  if (state.socket) return;
  const s = document.createElement('script');
  s.src = '/socket.io/socket.io.js';
  s.onload = () => {
    state.socket = io(window.location.origin, { transports:['websocket'] });
    state.socket.on('connect', () => {
      if (state.online) state.socket.emit('motorista:online', { codigo:state.motorista.codigo, token:state.token });
    });
    state.socket.on('auth:bloqueado', ({motivo}) => { showToast(`🔒 ${motivo}`); setTimeout(sair,3000); });
    state.socket.on('oferta:nova',      o => { hideAguarde(); mostrarOferta(o); });
    state.socket.on('oferta:expirada',  () => { hideAguarde(); fecharOferta(); showToast('Corrida já foi aceita'); });
    state.socket.on('oferta:cancelada', () => { fecharOferta(); showToast('Corrida não disponível'); });
    state.socket.on('diaria:liberada',  () => {
      state.bloqueado = false;
      document.getElementById('modalBloqueio').classList.add('hidden');
      document.getElementById('diariaSt').textContent = '✅';
      showToast('Diária confirmada! Você pode continuar ✅');
    });
    state.socket.on('corrida:aceita', async d => {
      if (d.motoristaCodigo !== state.motorista.codigo) return;
      hideAguarde(); fecharOferta();
      try {
        const r = await fetch(`${API}/corridas/${d.corridaId}`);
        state.corridaAtual = await r.json();
        state.corridaAtual.status = 'Aceita';
      } catch { state.corridaAtual = { id:d.corridaId, status:'Aceita', cliente:d.motoristaNome||'', origem:'', destino:'', valorFinal:0 }; }
      showToast('Corrida aceita! ✅');
      setTimeout(mostrarCorrente, 800);
    });
    state.socket.on('corrida:atualizada', ({corridaId,status}) => {
      if (state.corridaAtual?.id == corridaId) {
        state.corridaAtual.status = status;
        document.getElementById('corridaStatusBadge').textContent = status;
      }
    });
    state.socket.on('gps:update', ({codigo,lat,lng}) => {
      if (state.pinMotorista && codigo===state.motorista.codigo) {
        state.pinMotorista.setPosition({lat,lng});
      }
    });
  };
  document.head.appendChild(s);
}

function desconectarSocket() {
  state.socket?.disconnect(); state.socket = null;
}

// ─── GPS ──────────────────────────────────────────────
function iniciarGPS() {
  if (!navigator.geolocation) { showToast('GPS não disponível'); return; }
  pararGPS();
  state.gpsWatch = navigator.geolocation.watchPosition(pos => {
    const { latitude:lat, longitude:lng, speed } = pos.coords;
    state.ultimaPosicao = { lat, lng, velocidade: speed ? Math.round(speed*3.6) : 0 };
    state.socket?.emit('gps:update', { codigo:state.motorista.codigo, ...state.ultimaPosicao });
    // Atualizar pin no mapa se estiver em corrida
    if (state.pinMotorista) state.pinMotorista.setPosition({lat,lng});
  }, err => console.warn('GPS:', err.message), { enableHighAccuracy:true, maximumAge:5000, timeout:15000 });
  state.gpsHeartbeat = setInterval(() => {
    if (state.ultimaPosicao && state.socket?.connected) {
      state.socket.emit('gps:update', { codigo:state.motorista.codigo, ...state.ultimaPosicao });
    }
  }, 10000);
}

function pararGPS() {
  if (state.gpsWatch !== null) { navigator.geolocation.clearWatch(state.gpsWatch); state.gpsWatch = null; }
  if (state.gpsHeartbeat) { clearInterval(state.gpsHeartbeat); state.gpsHeartbeat = null; }
}

// ─── Wake Lock ultra-robusto ───────────────────────
// Usa 3 camadas: API nativa + vídeo invisível + ping DOM
async function ativarWakeLock() {
  // Camada 1: Wake Lock API nativa
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', () => {
        if (state.online) setTimeout(ativarWakeLock, 500);
      });
    }
  } catch {}

  // Camada 2: vídeo mudo em loop (funciona em todos os browsers)
  if (!window._noSleep) {
    try {
      const v = document.createElement('video');
      v.setAttribute('loop',''); v.setAttribute('playsinline','');
      v.setAttribute('muted',''); v.setAttribute('autoplay','');
      v.style.cssText = 'position:fixed;top:-2px;left:-2px;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
      v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr9tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjYwMSBhMGNkN2QzIC0gSC4yNjQvTVBFRy00IEFWQ2NvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDE2IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9NjAgbG9va2FoZWFkX3RocmVhZHM9MTAgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiByZWZzPTMgYmFkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAA9liIQAV/2+GA==';
      document.body.appendChild(v);
      v.play().catch(() => {});
      window._noSleep = v;
    } catch {}
  } else if (window._noSleep.paused) {
    window._noSleep.play().catch(() => {});
  }

  // Camada 3: ping DOM a cada 20s (mantém CPU ativo, evita suspensão)
  if (!window._wakePing) {
    window._wakePing = setInterval(() => {
      if (!state.online) return;
      // Micro-operação DOM imperceptível
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:-1px;width:1px;height:1px;opacity:0';
      document.body.appendChild(d);
      requestAnimationFrame(() => { if (d.parentNode) d.parentNode.removeChild(d); });
      // Re-adquirir wake lock se perdeu
      if (!state.wakeLock || state.wakeLock.released) ativarWakeLock();
    }, 20000);
  }
}

function desativarWakeLock() {
  try { state.wakeLock?.release(); } catch {}
  state.wakeLock = null;
  if (window._noSleep) { window._noSleep.pause(); }
  if (window._wakePing) { clearInterval(window._wakePing); window._wakePing = null; }
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    if (state.online) {
      if (!state.wakeLock) await ativarWakeLock();
      if (state.gpsWatch === null) iniciarGPS();
      if (state.socket && !state.socket.connected) state.socket.connect();
    }
  }
});

// ─── Push ─────────────────────────────────────────────
async function registrarPush() {
  try {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) return;
    const reg  = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const res = await fetch(`${API}/push/vapid-public-key`);
    if (!res.ok) return;
    const { publicKey } = await res.json();
    const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToU8(publicKey) });
    await fetch(`${API}/motorista-auth/push`, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ codigo:state.motorista.codigo, token:state.token, subscription:sub }) });
  } catch {}
}

function urlB64ToU8(b64) {
  const p = '='.repeat((4 - b64.length%4)%4);
  const b = (b64+p).replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from([...atob(b)].map(c=>c.charCodeAt(0)));
}

// ─── Utilitários ───────────────────────────────────
function mostrarPerfil() {
  if (typeof navAtivo === 'function') navAtivo('navPerfil');
  const m = state.motorista;
  if (!m) return;

  // Avatar
  const av = document.getElementById('perfilAvatar');
  if (av) {
    const ini = (m.nome||'M').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
    if (m.foto) { av.style.backgroundImage="url('"+m.foto+"')"; av.style.backgroundSize='cover'; av.style.backgroundPosition='center'; av.textContent=''; }
    else { av.textContent = ini; av.style.backgroundImage=''; }
  }

  // Campos
  const _s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
  _s('perfilNome',     m.nome);
  _s('perfilCodigo',   m.codigo);
  _s('perfilMoto',     m.moto);
  _s('perfilPlaca',    m.placa);
  _s('perfilTelefone', m.telefone);
  _s('perfilStatus',   state.online ? '🟢 Online' : '⚫ Offline');

  // Limpar campos de senha
  ['perfilSenhaAtual','perfilSenhaNova','perfilSenhaConf'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const msg = document.getElementById('perfilSenhaMsg');
  if (msg) msg.textContent = '';

  const modal = document.getElementById('modalPerfilMot');
  if (modal) modal.classList.remove('hidden');
}

function fecharPerfil() {
  const modal = document.getElementById('modalPerfilMot');
  if (modal) modal.classList.add('hidden');
}
function showAguarde()   { document.getElementById('modalAguarde').classList.remove('hidden'); }
function hideAguarde()   { document.getElementById('modalAguarde').classList.add('hidden'); }
function badgeClass(s)   { return {Nova:'nova',Aceita:'aceita','A caminho':'acaminho',Chegou:'acaminho',Finalizada:'finalizada'}[s]||'nova'; }

let _toastT;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden'); el.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.classList.add('hidden'),300); }, 3000);
}

function navAtivo(id) {
  ['navHome','navPerfil','navCorridaBtn'].forEach(function(nid) {
    var el = document.getElementById(nid);
    if (el) el.style.color = nid === id ? '#f7c600' : '#888';
  });
}



function fecharPerfil() {
  const modal = document.getElementById('modalPerfilMot');
  if (modal) modal.classList.add('hidden');
  if (typeof navAtivo === 'function') navAtivo('navHome');
}

async function alterarSenhaPerfil() {
  const senhaAtual = document.getElementById('perfilSenhaAtual')?.value || '';
  const novaSenha  = document.getElementById('perfilSenhaNova')?.value  || '';
  const conf       = document.getElementById('perfilSenhaConf')?.value  || '';
  const msg        = document.getElementById('perfilSenhaMsg');

  const setMsg = (t, ok) => { if(msg){ msg.textContent=t; msg.style.color=ok?'#22c55e':'#ef4444'; } };

  if (!senhaAtual) { setMsg('Informe a senha atual',''); return; }
  if (novaSenha.length < 4) { setMsg('Nova senha mínimo 4 caracteres',''); return; }
  if (novaSenha !== conf)   { setMsg('As senhas não coincidem',''); return; }

  const btn = document.querySelector('#perfilSenhaForm button');
  if (btn) btn.disabled = true;
  setMsg('Alterando...', true);

  try {
    const r = await fetch(`${API}/motorista-auth/alterar-senha`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.token, senhaAtual, novaSenha })
    });
    const d = await r.json();
    if (!r.ok) { setMsg(d.erro || 'Erro ao alterar', false); return; }
    setMsg('✅ Senha alterada com sucesso!', true);
    ['perfilSenhaAtual','perfilSenhaNova','perfilSenhaConf'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } catch(e) {
    setMsg('Erro de conexão', false);
  } finally {
    if (btn) btn.disabled = false;
  }
}