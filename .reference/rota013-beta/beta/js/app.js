// ═══════════════════════════════════════════════════════
//  APP.JS — API Client + Inicialização
// ═══════════════════════════════════════════════════════

const API_BASE = '/beta/api';

// ─── Cliente HTTP ─────────────────────────────────────
async function api(method, endpoint, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API_BASE + endpoint, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
  return data;
}

const apiGet    = (ep)       => api('GET',    ep);
const apiPost   = (ep, body) => api('POST',   ep, body);
const apiPut    = (ep, body) => api('PUT',    ep, body);
const apiPatch  = (ep, body) => api('PATCH',  ep, body);
const apiDelete = (ep)       => api('DELETE', ep);

// ─── Testar se backend está online ───────────────────
async function backendOnline() {
  try {
    await fetch(API_BASE + '/status');
    return true;
  } catch {
    return false;
  }
}

// ─── Carregar dados do backend ────────────────────────
async function carregarDados() {
  const online = await backendOnline();

  if (!online) {
    console.warn('Backend offline — usando dados do state local');
    const el = document.getElementById('statusBackend');
    if (el) { el.textContent = '🔴 Servidor offline'; el.style.color = 'var(--red)'; }
    renderAll();
    return false;
  }

  try {
    const [corridas, clientes, motoristas, financeiro, tarifas, logs, config] = await Promise.all([
      apiGet('/corridas'),
      apiGet('/clientes'),
      apiGet('/motoristas'),
      apiGet('/financeiro'),
      apiGet('/tarifas'),
      apiGet('/logs'),
      apiGet('/config')
    ]);

    state.corridas   = corridas   || [];
    state.clientes   = clientes   || [];
    state.motoristas = motoristas || [];
    state.financeiro = financeiro || [];
    state.logs       = logs       || [];
    state.config     = config     || {};

    if (tarifas?.tabelasFixas) {
      state_tarifas.tabelasFixas  = tarifas.tabelasFixas;
      state_tarifas.tabelaHibrida = tarifas.tabelaHibrida;
    }

    renderAll();
    // Atualizar indicador de status
    const el = document.getElementById('statusBackend');
    if (el) { el.textContent = '🟢 Servidor online'; el.style.color = 'var(--green)'; }
    return true; // online
  } catch (e) {
    console.error('Erro ao carregar dados:', e.message);
    showToast('Erro ao carregar dados do servidor.');
    renderAll();
    return false;
  }
}

// ─── API helpers para salvar dados ───────────────────
async function salvarCorridaAPI(corrida) {
  const salva = await apiPost('/corridas', corrida);
  state.corridas.unshift(salva);
  return salva;
}

async function salvarClienteAPI(cliente) {
  const salvo = await apiPost('/clientes', cliente);
  state.clientes.push(salvo);
  return salvo;
}

async function salvarMotoristaAPI(motorista) {
  if (motorista.id) {
    const salvo = await apiPut(`/motoristas/${motorista.id}`, motorista);
    const idx = state.motoristas.findIndex(m => m.id === motorista.id);
    if (idx >= 0) state.motoristas[idx] = salvo;
    return salvo;
  }
  const salvo = await apiPost('/motoristas', motorista);
  state.motoristas.push(salvo);
  return salvo;
}

async function registrarDiariaAPI(diaria) {
  const salva = await apiPost('/financeiro', diaria);
  if (!state.financeiro) state.financeiro = [];
  state.financeiro.unshift(salva);
  return salva;
}

async function atualizarStatusCorrida(id, status, motoristaCodigo) {
  const body     = { status, motoristaCodigo, operador: state.currentUser?.nome };
  const atualizada = await apiPatch(`/corridas/${id}/status`, body);
  const idx = state.corridas.findIndex(c => c.id === id);
  if (idx >= 0) state.corridas[idx] = atualizada;
  renderCorridas();
  showToast(`Corrida #${id} → ${status}`);
}

// ─── Inicialização DOM ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.menu-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });
  document.getElementById('btnMenu')?.addEventListener('click', toggleSidebar);
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
  });
  const corridaValor = document.getElementById('corridaValor');
  if (corridaValor) {
    corridaValor.addEventListener('input', () => {
      const vf = document.getElementById('corridaValorFinal');
      if (vf && !vf.value) vf.value = corridaValor.value;
    });
  }
});
