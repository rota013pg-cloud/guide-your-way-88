// ═══════════════════════════════════════════════════════
//  CORRIDAS.JS — V7.1
// ═══════════════════════════════════════════════════════

// ─── Nova corrida (limpa) ─────────────────────────────
function openModalCorrida() {
  // Abre o modal PRIMEIRO, depois preenche — garante que o DOM está visível
  document.getElementById('corridaEditId').value = '';
  document.querySelector('#modalCorrida h3').textContent = 'Nova Corrida';
  openModal('modalCorrida');
  // Delay garante DOM visível + tarifas carregadas da API
  setTimeout(() => {
    renderOptions(); // re-popular select com dados da API
    _preencherModalCorrida(null);
  }, 50);
}

// ─── Nova corrida com cliente pré-preenchido ──────────
function novaCorridaParaCliente(codigo) {
  const c = state.clientes.find(x => x.codigo === codigo);
  if (!c) return;
  _preencherModalCorrida(null);
  document.querySelector('#modalCorrida h3').textContent = 'Nova Corrida';
  document.getElementById('corridaEditId').value = '';
  document.getElementById('corridaClienteCodigo').value = c.codigo;
  document.getElementById('corridaClienteNome').value   = c.nome;
  document.getElementById('corridaClienteWhats').value  = mascaraTelefone(c.telefone||'');
  showPage('corridas');
  openModal('modalCorrida');
}

// ─── Editar corrida ───────────────────────────────────
function editarCorrida(id) {
  const c = state.corridas.find(x => x.id === id || x.id === Number(id));
  if (!c) { showToast('Corrida não encontrada.'); return; }
  _preencherModalCorrida(c);
  document.querySelector('#modalCorrida h3').textContent = `Editar Corrida #${c.id}`;
  document.getElementById('corridaEditId').value = c.id;
  openModal('modalCorrida');
}

// ─── Preencher/limpar modal ───────────────────────────
function _preencherModalCorrida(c) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('corridaClienteCodigo', c?.clienteCodigo || '');
  set('corridaClienteNome',   c?.cliente       || '');
  set('corridaClienteWhats',  c?.telefone ? mascaraTelefone(c.telefone) : '');
  set('corridaObs',           c?.obs       || '');
  set('corridaMetodo',        c?.metodo    || '');
  set('corridaDistancia',     c?.distancia || '');
  set('corridaDuracao',       '');

  // VALORES: sempre usar Number().toFixed(2) para evitar o bug de multiplicação
  const vSug   = c?.valor      != null ? Number(c.valor).toFixed(2)      : '';
  const vFinal = c?.valorFinal != null ? Number(c.valorFinal).toFixed(2) : '';
  set('corridaValor',      vSug);
  set('corridaValorFinal', vFinal);

  // Origem/Destino — limpar completamente incluindo listas de autocomplete
  const pairs = [['corridaOrigem','sugestoes-origem'],['corridaDestino','sugestoes-destino']];
  pairs.forEach(([inpId, listId]) => {
    const el   = document.getElementById(inpId);
    const list = document.getElementById(listId);
    if (el) {
      el.value = c ? (inpId==='corridaOrigem' ? c.origem : c.destino) : '';
      delete el.dataset.lat; delete el.dataset.lng;
    }
    if (list) { list.innerHTML = ''; list.classList.remove('active'); }
  });

  // Data/hora
  const elDt = document.getElementById('corridaDataHora');
  if (elDt) {
    if (c?.dataHora) { elDt.value = c.dataHora.slice(0,16); }
    else { preencherDataHoraAgora(); }
  }

  // Tipo
  const elTipo = document.getElementById('corridaTipo');
  if (elTipo) elTipo.value = c?.tipo || 'Agora';

  // Pagamento
  const elPag = document.getElementById('corridaPagamento');
  if (elPag) elPag.value = c?.pagamento || 'Pix';

  // Motorista
  const elMot = document.getElementById('corridaMotorista');
  if (elMot) elMot.value = c ? (c.motoristaCodigo || '') : '';

  // Status — só visível na edição
  const elSt  = document.getElementById('corridaStatus');
  const lbSt  = document.getElementById('labelCorridaStatus');
  if (elSt) { elSt.value = c ? (c.status || 'Nova') : 'Nova'; }
  if (lbSt) lbSt.style.display = c ? '' : 'none';
}

// ─── Mudar status — com modal de motorista para "Aceita" ─
async function mudarStatusCorrida(id, status) {
  if (status === 'Aceita') {
    _abrirModalAceitarCorrida(id);
    return;
  }

  // Se finalizar: registrar corrida para o motorista
  if (status === 'Finalizada') {
    await _registrarCorridaMotorista(id);
  }

  await _salvarStatusCorrida(id, status);
}

async function _salvarStatusCorrida(id, status, motoristaCodigo) {
  showAguarde();
  // Buscar nome do motorista para incluir no PATCH
  const motNome = motoristaCodigo
    ? state.motoristas.find(m => m.codigo === motoristaCodigo)?.nome || ''
    : '';
  try {
    const att = await apiPatch(`/corridas/${id}/status`,
      { status, motoristaCodigo, motorista: motNome || undefined, operador: state.currentUser?.nome });
    const idx = state.corridas.findIndex(c => c.id === Number(id));
    if (idx >= 0) state.corridas[idx] = att;
    hideAguarde();
    showToast(`#${id} → ${status} ✅`);
  } catch {
    const idx = state.corridas.findIndex(c => c.id === Number(id));
    if (idx >= 0) {
      state.corridas[idx].status = status;
      if (motoristaCodigo) {
        state.corridas[idx].motoristaCodigo = motoristaCodigo;
        state.corridas[idx].motorista = motNome || state.corridas[idx].motorista;
      }
    }
    hideAguarde();
    showToast(`#${id} → ${status}`);
  }
  renderCorridas();
  renderDashboard();
}

// ─── Modal aceitar corrida: informar motorista ────────
function _abrirModalAceitarCorrida(corridaId) {
  document.getElementById('aceitarCorridaId').value = corridaId;
  // Limpar campo motorista (nunca abrir com o da última corrida)
  const elMotAceitar = document.getElementById('aceitarMotoristaCod');
  if (elMotAceitar) elMotAceitar.value = '';
  const divInfo = document.getElementById('aceitarMotoristaInfo');
  if (divInfo) { divInfo.innerHTML = ''; divInfo.style.display = 'none'; }
  const c = state.corridas.find(x => x.id === Number(corridaId));
  const info = document.getElementById('aceitarCorridaInfo');
  if (info && c) {
    info.innerHTML = `<b>#${c.id}</b> — ${c.cliente}<br>${c.origem} → ${c.destino}<br><b>${moeda(c.valorFinal)}</b>`;
  }
  // Preencher com motorista já vinculado se houver
  const elMot = document.getElementById('aceitarMotoristaCod');
  if (elMot) elMot.value = c?.motoristaCodigo || '';
  openModal('modalAceitarCorrida');
}

async function confirmarAceitarCorrida() {
  showAguarde();
  const corridaId = Number(document.getElementById('aceitarCorridaId')?.value);
  const motCod   = (document.getElementById('aceitarMotoristaCod')?.value || '').trim().toUpperCase();
  if (!motCod) { showToast('Informe o código do motorista.'); return; }

  const m = state.motoristas.find(x => x.codigo === motCod);
  if (!m) { showToast('Motorista não encontrado.'); return; }

  // Atualizar corrida com motorista e status Aceita
  const idx = state.corridas.findIndex(c => c.id === corridaId);
  if (idx >= 0) {
    state.corridas[idx].motoristaCodigo = m.codigo;
    state.corridas[idx].motorista       = m.nome;
  }
  await _salvarStatusCorrida(corridaId, 'Aceita', m.codigo);
  hideAguarde();
  closeModal('modalAceitarCorrida');
  showToast(`Corrida aceita por ${m.nome} ✅`);
}

// ─── Registrar corrida para o motorista ao finalizar ─
async function _registrarCorridaMotorista(corridaId) {
  const c = state.corridas.find(x => x.id === Number(corridaId));
  if (!c) return;

  // Incrementar corridas do MOTORISTA
  if (c.motoristaCodigo) {
    const idxM = state.motoristas.findIndex(m => m.codigo === c.motoristaCodigo);
    if (idxM >= 0) {
      state.motoristas[idxM].corridas = (state.motoristas[idxM].corridas || 0) + 1;
      try { await apiPut(`/motoristas/${state.motoristas[idxM].id}`, state.motoristas[idxM]); } catch {}
    }
  }

  // Incrementar corridas do CLIENTE
  if (c.clienteCodigo) {
    const idxC = state.clientes.findIndex(cl => cl.codigo === c.clienteCodigo);
    if (idxC >= 0) {
      state.clientes[idxC].corridas = (state.clientes[idxC].corridas || 0) + 1;
      try { await apiPut(`/clientes/${state.clientes[idxC].id}`, state.clientes[idxC]); } catch {}
    }
  }

  addLog(`Corrida #${corridaId} finalizada — mot:${c.motoristaCodigo || '-'} cli:${c.clienteCodigo || '-'}`);

  // Atualizar ranking e dashboard
  renderHistorico();
  renderMotoristas();
  drawChart();
}

// ─── Preencher valor final com arredondamento ─────────
function preencherValorFinal(valor) {
  const n = Number(valor) || 0;
  const elSug   = document.getElementById('corridaValor');
  const elFinal = document.getElementById('corridaValorFinal');
  if (elSug)   elSug.value   = n.toFixed(2);
  // Só preenche final se ainda estiver vazio
  if (elFinal && !elFinal.value) {
    const arr = arredondarValor(n);
    elFinal.value = arr.toFixed(2);
  }
}

function arredondarValor(v) {
  const n    = Number(v) || 0;
  const frac = n - Math.floor(n);
  return frac > 0.50 ? Math.ceil(n) : Math.floor(n);
}

// ─── Busca automática ao digitar código ───────────────
let _buscaTimer = null;
function buscarClienteAoDigitar() {
  clearTimeout(_buscaTimer);
  _buscaTimer = setTimeout(() => {
    const cod = (document.getElementById('corridaClienteCodigo')?.value||'').trim();
    if (!cod) return;
    const c = state.clientes.find(x => x.codigo===cod ||
      x.nome.toLowerCase().startsWith(cod.toLowerCase()));
    if (!c) return;
    document.getElementById('corridaClienteNome').value  = c.nome;
    document.getElementById('corridaClienteWhats').value = mascaraTelefone(c.telefone||'');
    showToast(`${c.nome} ✅`, 1500);
  }, 400);
}

function buscarClientePorCodigo() {
  const cod = (document.getElementById('corridaClienteCodigo')?.value||'').trim();
  if (!cod) { showToast('Informe o código.'); return; }
  const c = state.clientes.find(x => x.codigo===cod);
  if (!c) { showToast('Código não encontrado.'); return; }
  document.getElementById('corridaClienteNome').value  = c.nome;
  document.getElementById('corridaClienteWhats').value = mascaraTelefone(c.telefone||'');
  showToast(`${c.nome} ✅`);
}

function ajustarTipoCorrida() {
  const tipo = document.getElementById('corridaTipo')?.value;
  const el   = document.getElementById('corridaDataHora');
  if (!el) return;
  if (tipo === 'Agora') preencherDataHoraAgora();
  else el.value = '';
}

function calcularValorCorrida() {
  const orig = document.getElementById('corridaOrigem');
  const dest = document.getElementById('corridaDestino');
  if (orig?.dataset.lat && dest?.dataset.lat) calcularValorPorCoordenadas();
}

// ─── Montar objeto corrida ────────────────────────────
function montarCorridaForm() {
  const motCod = document.getElementById('corridaMotorista')?.value || '';
  const m      = state.motoristas.find(x => x.codigo===motCod) || null;
  const tabId  = document.getElementById('corridaTarifa')?.value;
  const tarifa = state_tarifas?.tabelasFixas?.find(t=>t.id===tabId) || state_tarifas?.tabelasFixas?.[0];

  // Leitura segura dos valores — sem máscara destrutiva
  const valorSugRaw  = document.getElementById('corridaValor')?.value  || '0';
  const valorFinRaw  = document.getElementById('corridaValorFinal')?.value || '0';
  const valorSug     = parseMoney(valorSugRaw);
  const valorFinal   = parseMoney(valorFinRaw) || valorSug;

  return {
    clienteCodigo:  (document.getElementById('corridaClienteCodigo')?.value||'').trim(),
    cliente:        (document.getElementById('corridaClienteNome')?.value||'Cliente sem cadastro').trim(),
    telefone:       (document.getElementById('corridaClienteWhats')?.value||'').replace(/\D/g,''),
    origem:         (document.getElementById('corridaOrigem')?.value||'').trim(),
    destino:        (document.getElementById('corridaDestino')?.value||'').trim(),
    tipo:            document.getElementById('corridaTipo')?.value     || 'Agora',
    dataHora:        document.getElementById('corridaDataHora')?.value || '',
    metodo:          document.getElementById('corridaMetodo')?.value   || 'Manual',
    distancia:       document.getElementById('corridaDistancia')?.value || '-',
    tarifa:          tarifa?.titulo || '',
    valor:           valorSug,
    valorFinal,
    pagamento:       document.getElementById('corridaPagamento')?.value || 'Dinheiro',
    motoristaCodigo: m?.codigo || '',
    motorista:       m?.nome   || 'Aguardando',
    status:          document.getElementById('corridaStatus')?.value   || (m ? 'Aceita' : 'Nova'),
    obs:             document.getElementById('corridaObs')?.value      || '',
    operador:        state.currentUser?.nome || ''
  };
}

// ─── Salvar (novo ou editar) ──────────────────────────
async function salvarCorrida() {
  const dados  = montarCorridaForm();
  const editId = document.getElementById('corridaEditId')?.value;

  if (!dados.origem)  { showToast('Informe a origem.');  return; }
  showAguarde();
  if (!dados.destino) { showToast('Informe o destino.'); return; }
  if (!dados.cliente || dados.cliente==='Cliente sem cadastro') {
    showToast('Informe o nome do cliente.'); return;
  }

  if (editId) {
    try {
      const att = await apiPut(`/corridas/${editId}`, dados);
      const idx = state.corridas.findIndex(c=>c.id===Number(editId));
      if (idx>=0) state.corridas[idx]=att; else state.corridas.unshift(att);
    } catch {
      const idx = state.corridas.findIndex(c=>c.id===Number(editId));
      if (idx>=0) state.corridas[idx]={...state.corridas[idx],...dados};
    }
    hideAguarde();
    closeModalCorrida();
    addLog(`Corrida #${editId} editada`);
    renderAll();
    showToast('Corrida atualizada ✅');
    return;
  }

  const clienteExiste = state.clientes.some(c=>c.codigo===dados.clienteCodigo);
  if (!clienteExiste && dados.cliente!=='Cliente sem cadastro' && dados.telefone) {
    state.pendingRide = dados;
    const el = document.getElementById('clienteDepoisResumo');
    if (el) el.innerHTML = `<b>${dados.cliente}</b><br>${mascaraTelefone(dados.telefone)}<br>${dados.origem} → ${dados.destino}`;
    openModal('modalClienteDepois');
    return;
  }
  await _persistirCorrida(dados);
}

async function cadastrarClienteDepois() {
  const p = state.pendingRide; if (!p) return;
  const novo = { codigo:gerarCodigoCliente(), nome:p.cliente, telefone:p.telefone, cidade:'', corridas:1 };
  try { await salvarClienteAPI(novo); } catch { state.clientes.push({...novo,id:nextId(state.clientes)}); }
  p.clienteCodigo = novo.codigo;
  await _persistirCorrida(p);
  closeModal('modalClienteDepois');
}

async function salvarCorridaSemCliente() {
  const p = state.pendingRide; if (!p) return;
  await _persistirCorrida(p);
  closeModal('modalClienteDepois');
}

async function _persistirCorrida(corrida) {
  showAguarde();
  try {
    await salvarCorridaAPI(corrida);
    showToast('Corrida salva! ✅');
  } catch {
    state.corridas.unshift({...corrida,id:nextId(state.corridas)});
    showToast('Salvo localmente ⚠️');
  }
  hideAguarde();
  state.pendingRide = null;
  closeModalCorrida();
  addLog('Corrida: '+corrida.cliente);
  renderAll();
}

// ─── Render tabela corridas ───────────────────────────
function renderCorridas() {
  const busca = (document.getElementById('buscaCorrida')?.value||'').toLowerCase();
  const st    = document.getElementById('filtroStatus')?.value||'';
  const tbody = document.getElementById('tabelaCorridas');
  if (!tbody) return;

  const lista = (state.corridas||[]).filter(c => {
    const txt = `${c.id} ${c.clienteCodigo} ${c.cliente} ${c.origem} ${c.destino}`.toLowerCase();
    return txt.includes(busca) && (!st||c.status===st);
  });

  const opts = ['Nova','Aceita','A caminho','Em curso','Finalizada','Cancelada'];
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><b>#${c.id}</b></td>
      <td>
        <b>${c.clienteCodigo||'-'}</b><br>
        ${c.cliente}<br>
        <small>${mascaraTelefone(c.telefone||'')}</small>
      </td>
      <td style="font-size:12px">${c.origem}</td>
      <td style="font-size:12px">${c.destino}</td>
      <td style="font-size:12px">${c.metodo||'Manual'}<br><small style="color:var(--muted)">${c.tarifa||''}</small></td>
      <td><b>${moeda(c.valorFinal)}</b></td>
      <td>
        ${c.motoristaCodigo
          ? `<b>${c.motoristaCodigo}</b><br><small>${c.motorista}</small>`
          : '<small style="color:var(--muted)">Aguardando</small>'}
      </td>
      <td>
        <select class="status-select status-${(c.status||'Nova').toLowerCase().replace(/ /g,'-')}"
          onchange="mudarStatusCorrida(${c.id},this.value);this.value='${c.status||'Nova'}'">
          ${opts.map(s=>`<option value="${s}"${c.status===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="actions-cell">
        <button class="btn" onclick="editarCorrida(${c.id})" title="Editar">✏️</button>
        <button class="btn" onclick="abrirModalMensagens(${c.id})" title="Mensagens">💬</button>
        <button class="btn whatsapp" onclick="abrirWhats('${c.telefone}','Olá ${(c.cliente||'').replace(/'/g,'')}!')" title="WhatsApp">📲</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--muted)">Nenhuma corrida</td></tr>';
}

// ─── Helpers ─────────────────────────────────────────
function preencherDataHoraAgora() {
  const el = document.getElementById('corridaDataHora');
  if (!el) return;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  el.value = now.toISOString().slice(0,16);
}

function limparFormCorrida() {
  _preencherModalCorrida(null);
  document.getElementById('corridaEditId').value = '';
  document.querySelector('#modalCorrida h3').textContent = 'Nova Corrida';
  showToast('Formulário limpo');
}

function abrirModalMensagens(id) {
  const c = state.corridas.find(x=>x.id===id||x.id===Number(id));
  if (!c) { showToast('Corrida não encontrada.'); return; }
  const el = id2 => document.getElementById(id2);
  if (el('dashMsgCorridaId'))   el('dashMsgCorridaId').value  = c.id;
  if (el('dashMsgCorridaInfo')) el('dashMsgCorridaInfo').innerHTML =
    `<b>#${c.id}</b> — ${c.cliente} | ${c.origem} → ${c.destino} | ${moeda(c.valorFinal)}`;
  if (el('dashMsgMotCodigo')) el('dashMsgMotCodigo').value = c.motoristaCodigo||'';
  _gerarMsgNoModal(c, null);
  openModal('modalMensagens');
}

function abrirModalMensagensCorrida(id) { abrirModalMensagens(id); }

function copiarMsgModal(inputId) { copiar(document.getElementById(inputId)?.value||''); }

function abrirWhatsModal(inputId) {
  const txt = document.getElementById(inputId)?.value||'';
  const id  = Number(document.getElementById('dashMsgCorridaId')?.value);
  const c   = state.corridas.find(x=>x.id===id);
  const cod = document.getElementById('dashMsgMotCodigo')?.value?.trim();
  const mot = cod ? state.motoristas.find(m=>m.codigo===cod) : null;
  const fone = inputId==='dashMsgMotorista' ? mot?.telefone : c?.telefone;
  const num = (fone||'').replace(/\D/g,'');
  if (!num) { showToast('Telefone não encontrado.'); return; }
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(txt)}`, '_blank');
}

function atualizarMsgComMotorista() {
  const id  = Number(document.getElementById('dashMsgCorridaId')?.value);
  const c   = state.corridas.find(x=>x.id===id);
  const cod = document.getElementById('dashMsgMotCodigo')?.value?.trim()||'';
  _gerarMsgNoModal(c, cod);
}

// ─── Botão ver foto motorista ─────────────────────────
function verFotoMotoristaMsg() {
  const cod = document.getElementById('dashMsgMotCodigo')?.value?.trim();
  const m   = cod ? state.motoristas.find(x=>x.codigo===cod) : null;
  if (!m?.foto) { showToast('Motorista sem foto cadastrada.'); return; }
  const win = window.open('','_blank','width=400,height=500');
  win.document.write(`<!DOCTYPE html><html><head><title>${m.nome}</title>
  <style>body{margin:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}
  img{max-width:380px;max-height:440px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.5)}
  p{color:#fff;font-family:Arial;margin-top:12px;font-size:14px}</style></head>
  <body><img src="${m.foto}" alt="${m.nome}"><p>${m.codigo} — ${m.nome}</p></body></html>`);
  win.document.close();
}

function usarRotaTabela(tabId, origemKey, destinoKey) {
  openModalCorrida();
  setTimeout(() => {
    const orig = document.getElementById('corridaOrigem');
    const dest = document.getElementById('corridaDestino');
    if (orig) orig.value = (NOMES_BAIRROS[origemKey]||origemKey)+', Praia Grande - SP';
    if (dest) dest.value = NOMES_BAIRROS[destinoKey]||destinoKey;
  }, 100);
}

function criarCorridasDemo() { state.corridas=[]; }

// ─── Preview motorista no modal aceitar ──────────────
function previewMotoristaAceitar() {
  const cod  = (document.getElementById('aceitarMotoristaCod')?.value||'').trim();
  const div  = document.getElementById('aceitarMotoristaInfo');
  if (!div) return;
  const m = state.motoristas.find(x => x.codigo===cod);
  if (!m) { div.style.display='none'; return; }
  div.innerHTML = `
    ${m.foto ? `<img src="${m.foto}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;margin-right:12px;float:left">` : ''}
    <b>${m.codigo} — ${m.nome}</b><br>
    ${mascaraTelefone(m.telefone||'')} | ${badge(m.status)}<br>
    ${m.moto||'-'} • ${m.placa||'-'}
    <div style="clear:both"></div>
  `;
  div.style.display='block';
}

// ─── Limpar campo de endereço ─────────────────────────
function limparCampoEndereco(inputId, listId) {
  const el   = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (el) { el.value = ''; delete el.dataset.lat; delete el.dataset.lng; el.focus(); }
  if (list) { list.innerHTML = ''; list.classList.remove('active'); }
  toggleClearBtn(inputId);
}

function toggleClearBtn(inputId) {
  const el  = document.getElementById(inputId);
  const btn = el?.closest('.input-clear-wrap')?.querySelector('.btn-clear-field');
  if (btn) btn.style.display = (el?.value) ? 'block' : 'none';
}
