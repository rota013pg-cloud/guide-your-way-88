// ── Helpers locais ──────────────────────────────────
function sv(id, v)  { var el = document.getElementById(id); if (el) el.textContent = v; }
function sv2(id, v) { var el = document.getElementById(id); if (el) el.value = v; }

// ═══════════════════════════════════════════════════════════
//  MODULOS.JS — Rota 013 Beta 2.0
//  Clientes, Motoristas, Financeiro, Mensagens,
//  Tarifas, Admin, Config, Histórico
// ═══════════════════════════════════════════════════════════
'use strict';

// ═══════════════════════════════════════════════════════════
//  CLIENTES
// ═══════════════════════════════════════════════════════════
function renderClientes() {
  const busca = (document.getElementById('buscaCliente')?.value || '').toLowerCase();
  const lista = state.clientes.filter(c =>
    !busca || `${c.codigo} ${c.nome} ${c.telefone}`.toLowerCase().includes(busca)
  );

  const tbody = document.getElementById('tabelaClientes');
  if (!tbody) return;

  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><b>${c.codigo || '—'}</b></td>
      <td><b>${c.nome || '—'}</b></td>
      <td>${c.telefone ? `<a href="https://wa.me/55${c.telefone.replace(/\D/g,'')}" target="_blank" class="link-wa">📱 ${c.telefone}</a>` : '—'}</td>
      <td>${c.cidade || '—'}</td>
      <td><b>${c.corridas || 0}</b></td>
      <td class="td-acoes">
        <button class="btn sm" onclick="editarCliente(${c.id})">✏️</button>
        <button class="btn sm danger" onclick="excluirCliente(${c.id})">🗑</button>
      </td>
    </tr>`).join('') ||
    '<tr><td colspan="6" class="empty-td">Sem clientes</td></tr>';
}

function abrirModalCliente(id) {
  window._editClienteId = null;
  ['mCliCodigo','mCliNome','mCliTelefone','mCliCidade','mCliObs']
    .forEach(x => sv2(x, ''));
  document.getElementById('modalClienteTitulo').textContent = 'Novo Cliente';
  document.getElementById('modalCliente').classList.remove('hidden');
}

function editarCliente(id) {
  const c = state.clientes.find(x => x.id == id); if (!c) return;
  window._editClienteId = id;
  sv2('mCliCodigo',   c.codigo   || '');
  sv2('mCliNome',     c.nome     || '');
  sv2('mCliTelefone', c.telefone || '');
  sv2('mCliCidade',   c.cidade   || '');
  sv2('mCliObs',      c.obs      || '');
  document.getElementById('modalClienteTitulo').textContent = 'Editar Cliente';
  document.getElementById('modalCliente').classList.remove('hidden');
}

async function salvarCliente() {
  const body = {
    codigo:   document.getElementById('mCliCodigo').value.trim().toUpperCase(),
    nome:     document.getElementById('mCliNome').value.trim(),
    telefone: document.getElementById('mCliTelefone').value.trim(),
    cidade:   document.getElementById('mCliCidade').value.trim() || 'Praia Grande',
    obs:      document.getElementById('mCliObs').value.trim(),
  };
  if (!body.nome) { showToast('Informe o nome do cliente'); return; }
  showAguarde();
  try {
    const id  = window._editClienteId;
    const res = await fetch(`${API}/clientes${id ? '/' + id : ''}`, {
      method:  id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.erro || 'Erro'); hideAguarde(); return; }

    if (id) {
      const idx = state.clientes.findIndex(c => c.id == id);
      if (idx >= 0) state.clientes[idx] = { ...state.clientes[idx], ...data };
    } else {
      state.clientes.unshift(data);
    }
    fecharModal('modalCliente');
    renderClientes();
    showToast(`Cliente ${body.nome} salvo ✅`);
  } catch { showToast('Erro ao salvar'); }
  hideAguarde();
}

async function excluirCliente(id) {
  if (!confirm('Excluir este cliente?')) return;
  showAguarde();
  try {
    await fetch(`${API}/clientes/${id}`, { method: 'DELETE' });
    state.clientes = state.clientes.filter(c => c.id != id);
    renderClientes();
    showToast('Cliente excluído');
  } catch { showToast('Erro'); }
  hideAguarde();
}

// ═══════════════════════════════════════════════════════════
//  MOTORISTAS
// ═══════════════════════════════════════════════════════════





// ── Acesso ao app ─────────────────────────────────────────
function abrirAcesso(codigo, nome) {
  window._acessoCodigo = codigo;
  sv('acessoTitulo', `Acesso — ${nome}`);
  sv('acessoInfo',   `Código: ${codigo}`);
  sv2('acessoSenha', '');

  // Mostrar dispositivo se tiver auth
  fetch(`${API}/motorista-auth/info/${codigo}`)
    .then(r => r.json())
    .then(d => {
      const infoEl = document.getElementById('acessoInfo');
      const dispEl = document.getElementById('acessoDispositivo');
      const devEl  = document.getElementById('acessoDevice');
      if (d && d.status) {
        // Botão bloquear/liberar dinâmico
        const btnBlq = document.querySelector('#modalAcesso .btn.danger');
        if (btnBlq) {
          if (d.status === 'bloqueado' || d.status === 'banido') {
            btnBlq.textContent = '🔓 Liberar acesso';
            btnBlq.onclick = liberarMotoApp;
          } else {
            btnBlq.textContent = '🔒 Bloquear';
            btnBlq.onclick = bloquearMotoApp;
          }
        }
        if (infoEl) infoEl.innerHTML =
          `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:8px">
            <div style="background:#f8f8f8;border-radius:8px;padding:8px 10px">
              <div style="color:#888;font-size:10px;text-transform:uppercase;margin-bottom:2px">Status</div>
              <b style="color:${d.status==='ativo'?'#16a34a':'#ef4444'}">${d.status}</b>
            </div>
            <div style="background:#f8f8f8;border-radius:8px;padding:8px 10px">
              <div style="color:#888;font-size:10px;text-transform:uppercase;margin-bottom:2px">Último acesso</div>
              <b>${(d.ultimoAcesso||'—').slice(0,16)}</b>
            </div>
            <div style="background:#fff8e7;border-radius:8px;padding:8px 10px;grid-column:span 2">
              <div style="color:#888;font-size:10px;text-transform:uppercase;margin-bottom:2px">Senha atual</div>
              <b style="font-size:15px;letter-spacing:2px">${d.senhaAtual||'(defina uma senha)'}</b>
            </div>
          </div>`;
        if (d.deviceNome && d.deviceNome !== '—') {
          if (dispEl) dispEl.classList.remove('hidden');
          if (devEl)  devEl.textContent = d.deviceNome;
        } else {
          if (dispEl) dispEl.classList.add('hidden');
        }
      }
    }).catch(() => {});

  openModal('modalAcesso');
}

async function salvarAcesso() {
  const codigo = window._acessoCodigo;
  const senha  = document.getElementById('acessoSenha').value;
  if (!senha || senha.length < 4) { showToast('Senha mínimo 4 caracteres'); return; }
  showAguarde();
  try {
    const r = await fetch(`${API}/motorista-auth/criar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ codigo, senha })
    });
    const d = await r.json();
    if (!r.ok) { showToast(d.erro || 'Erro'); hideAguarde(); return; }
    closeModal('modalAcesso');
    showToast(`✅ Acesso definido para ${codigo}`);
  } catch { showToast('Erro'); }
  hideAguarde();
}

async function bloquearMotoApp() {
  const codigo = window._acessoCodigo;
  const motivo = prompt('Motivo do bloqueio:');
  if (!motivo) return;
  showAguarde();
  try {
    await fetch(`${API}/motorista-auth/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ codigo, status: 'bloqueado', motivo })
    });
    closeModal('modalAcesso');
    showToast(`🔒 ${codigo} bloqueado no app`);
  } catch { showToast('Erro'); }
  hideAguarde();
}

// ═══════════════════════════════════════════════════════════
//  FINANCEIRO
// ═══════════════════════════════════════════════════════════
async function carregarFinanceiro() {
  try {
    const [fR, cfgR] = await Promise.all([
      fetch(`${API}/financeiro`).then(r => r.json()),
      fetch(`${API}/config`).then(r => r.json())
    ]);
    state.financeiro = Array.isArray(fR) ? fR : [];
    state.config     = cfgR || state.config;
    renderFinanceiro();
  } catch {}
}

function renderFinanceiro() {
  const hoje   = new Date().toLocaleDateString('sv');
  const diaria = Number(state.config.valorDiaria || 20);

  const hoje_fin = state.financeiro.filter(f =>
    f.tipo === 'Diária' && (f.data || '').startsWith(hoje)
  );
  const pagas    = hoje_fin.length;
  const total    = hoje_fin.reduce((s, f) => s + Number(f.valor || 0), 0);

  sv('finPagas',      pagas);
  sv('finPendentes',  Math.max(0, state.motoristas.filter(m => m.status !== 'Inativo').length - pagas));
  sv('finTotal',      `R$ ${total.toFixed(2).replace('.', ',')}`);
  sv('finValorDiaria',`R$ ${diaria.toFixed(2).replace('.', ',')}`);

  // Tabela de motoristas ativos com status de diária
  const tbody = document.getElementById('tabelaFinanceiro');
  if (!tbody) return;

  const ativos = state.motoristas.filter(m => m.status !== 'Inativo');

  tbody.innerHTML = ativos.map(m => {
    const pagou  = hoje_fin.some(f => (f.motoristaCodigo || f.motorista_codigo) === m.codigo);
    const corridasHoje = state.corridas.filter(c =>
      c.motoristaCodigo === m.codigo &&
      c.status === 'Finalizada' &&
      (c.criadoEm || '').startsWith(hoje)
    );
    const ganho    = corridasHoje.reduce((s, c) => s + (c.valorFinal || 0), 0);
    const limite   = diaria * 0.5;
    const atingiu  = ganho >= limite && !pagou;

    return `
      <tr class="${atingiu ? 'row-alerta' : ''}">
        <td><b>${m.codigo}</b></td>
        <td>${m.nome}</td>
        <td>${pagou
          ? '<span class="badge green">✅ Paga</span>'
          : atingiu
            ? '<span class="badge orange">⚠️ Pendente</span>'
            : '<span class="badge gray">—</span>'}</td>
        <td>R$ ${ganho.toFixed(2).replace('.', ',')}</td>
        <td>R$ ${limite.toFixed(2).replace('.', ',')}</td>
        <td class="td-acoes">
          ${!pagou ? `<button class="btn sm primary" onclick="registrarDiaria('${m.codigo}','${m.nome}')">💰 Registrar</button>` : ''}
          ${atingiu ? `<button class="btn sm" onclick="liberarPagamento('${m.codigo}','${m.nome}')">📲 Liberar</button>` : ''}
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-td">Sem motoristas ativos</td></tr>';
}

async function registrarDiaria(codigo, nome) {
  const diaria = Number(state.config.valorDiaria || 20);
  if (!confirm(`Registrar diária de R$ ${diaria.toFixed(2)} para ${nome}?`)) return;
  showAguarde();
  try {
    await fetch(`${API}/financeiro`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        motoristaCodigo: codigo, motorista: nome,
        valor: diaria, tipo: 'Diária', operador: 'Painel'
      })
    });
    await carregarFinanceiro();
    showToast(`✅ Diária de ${nome} registrada`);
  } catch { showToast('Erro'); }
  hideAguarde();
}

function atalhoRelatorio(periodo) {
  const hoje = new Date();
  const sv_  = (id, val) => sv2(id, val);
  const fmt  = d => d.toLocaleDateString('sv');

  sv_('relDe',  fmt(hoje));
  sv_('relAte', fmt(hoje));

  if (periodo === '7dias') {
    const d = new Date(hoje); d.setDate(d.getDate() - 6);
    sv_('relDe', fmt(d));
  } else if (periodo === 'mes') {
    sv_('relDe',  fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  } else if (periodo === '30dias') {
    const d = new Date(hoje); d.setDate(d.getDate() - 29);
    sv_('relDe', fmt(d));
  }
  buscarRelatorio();
}

async function buscarRelatorio() {
  const de     = document.getElementById('relDe')?.value || '';
  const ate    = document.getElementById('relAte')?.value || '';
  const tipo   = document.getElementById('relTipo')?.value || '';
  const mot    = (document.getElementById('relMotorista')?.value || '').toLowerCase();

  try {
    const r    = await fetch(`${API}/financeiro`);
    const all  = await r.json();
    const lista = all.filter(f => {
      const data = (f.data || '').slice(0, 10);
      const ok1  = !de   || data >= de;
      const ok2  = !ate  || data <= ate;
      const ok3  = !tipo || f.tipo === tipo;
      const ok4  = !mot  || `${f.motoristaCodigo} ${f.motorista}`.toLowerCase().includes(mot);
      return ok1 && ok2 && ok3 && ok4;
    });

    const total = lista.reduce((s, f) => s + Number(f.valor || 0), 0);
    sv('relTotal', `${lista.length} registros — Total: R$ ${total.toFixed(2).replace('.', ',')}`);

    const tbody = document.getElementById('tabelaRelatorio');
    if (tbody) {
      tbody.innerHTML = lista.map(f => `
        <tr>
          <td>${(f.data || '').slice(0, 16).replace('T', ' ')}</td>
          <td>${f.motoristaCodigo || f.motorista_codigo || '—'}</td>
          <td>${f.motorista || '—'}</td>
          <td>${f.tipo}</td>
          <td><b>R$ ${Number(f.valor || 0).toFixed(2).replace('.', ',')}</b></td>
          <td>${f.operador || '—'}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty-td">Sem registros</td></tr>';
    }
  } catch { showToast('Erro ao buscar relatório'); }
}

// ═══════════════════════════════════════════════════════════
//  MENSAGENS WHATSAPP
// ═══════════════════════════════════════════════════════════
async function gerarMensagensPorCorrida() {
  const cod = document.getElementById('msgCorridaCod')?.value.trim();
  if (!cod) return;

  // Buscar por ID ou por código do cliente
  const corrida = state.corridas.find(c =>
    String(c.id) === cod || c.clienteCodigo === cod
  );
  if (!corrida) { showToast('Corrida não encontrada'); return; }

  // Preencher campo de motorista se tiver
  if (corrida.motoristaCodigo) {
    sv2('msgMotCodigo', corrida.motoristaCodigo);
  }
  gerarMensagens(corrida);
}

function gerarMensagens(corridaParam) {
  const corrida  = corridaParam ||
    state.corridas.find(c => {
      const cod = document.getElementById('msgCorridaCod')?.value.trim();
      return String(c.id) === cod || c.clienteCodigo === cod;
    });

  const motCod  = document.getElementById('msgMotCodigo')?.value.trim().toUpperCase();
  const motorista = motCod ? state.motoristas.find(m => m.codigo === motCod) : null;
  const cfg     = state.config;

  if (!corrida) { showToast('Selecione uma corrida primeiro'); return; }

  const origem  = corrida.origem  || '—';
  const destino = corrida.destino || '—';
  const cliente = corrida.cliente || '—';
  const valor   = `R$ ${(corrida.valorFinal || 0).toFixed(2).replace('.', ',')}`;
  const central = cfg.whatsapp || cfg.whatsappCentral || '(13) 4042-3331';

  // Waze links (só para o motorista)
  const wazeOrigem  = `https://waze.com/ul?q=${encodeURIComponent(origem)}`;
  const wazeDestino = `https://waze.com/ul?q=${encodeURIComponent(destino)}`;

  // Template grupo
  sv2('msgGrupo',
    `🏍️ *CORRIDA DISPONÍVEL*\n\n` +
    `👤 Cliente: ${cliente}\n` +
    `📍 Buscar em: ${origem}\n` +
    `🏁 Destino: ${destino}\n` +
    `💰 Valor: ${valor}\n\n` +
    `📱 Central: ${central}`
  );

  // Template motorista (com Waze, SEM telefone do cliente)
  if (motorista) {
    sv2('msgMotorista',
      `🏍️ *${motorista.nome}*, sua corrida:\n\n` +
      `👤 Cliente: ${cliente}\n\n` +
      `📍 *Buscar em:*\n${origem}\n` +
      `🔗 Waze: ${wazeOrigem}\n\n` +
      `🏁 *Destino:*\n${destino}\n` +
      `🔗 Waze: ${wazeDestino}\n\n` +
      `💰 Valor: ${valor}\n\n` +
      `📱 Dúvidas: ${central}`
    );

    // Template cliente (com dados do moto, SEM link, SEM telefone do motorista)
    sv2('msgCliente',
      `✅ *Seu motorista chegou!*\n\n` +
      `🏍️ Moto: ${motorista.moto || '—'}\n` +
      `🔖 Placa: ${motorista.placa || '—'}\n` +
      `🎨 Cor: ${motorista.cor || '—'}\n` +
      `👤 Nome: ${motorista.nome}\n\n` +
      `📍 Buscando em: ${origem}\n` +
      `🏁 Destino: ${destino}\n` +
      `💰 Valor: ${valor}\n\n` +
      `📱 Central: ${central}`
    );
  } else {
    sv2('msgMotorista', 'Informe o código do motorista para gerar esta mensagem.');
    sv2('msgCliente',   'Informe o código do motorista para gerar esta mensagem.');
  }
}

// ═══════════════════════════════════════════════════════════
//  TARIFAS
// ═══════════════════════════════════════════════════════════
async function carregarTarifas() {
  try {
    const r   = await fetch(`${API}/tarifas`);
    const cfg = await r.json();
    state.tarifas = cfg.config_json ? JSON.parse(cfg.config_json) : cfg;
    renderTarifas();
  } catch {}
}

function renderTarifas() {
  const container = document.getElementById('tabelasFixasEditor');
  if (!container) return;

  const tabelas = state.tarifas?.tabelas || {};
  const nomes   = { pgpg: 'PG → PG', pgsv: 'PG → São Vicente', pgsantos: 'PG → Santos', pgcubatao: 'PG → Cubatão' };

  container.innerHTML = Object.entries(nomes).map(([key, nome]) => {
    const t = tabelas[key] || { minimo: 8, valorKm: 1.5 };
    return `
      <div class="tarifa-card">
        <h4>${nome}</h4>
        <div class="form-grid">
          <label>Mínimo (R$)
            <input type="number" step="0.50" id="tar_${key}_min" value="${t.minimo || 8}"/>
          </label>
          <label>Valor/km (R$)
            <input type="number" step="0.10" id="tar_${key}_km" value="${t.valorKm || 1.5}"/>
          </label>
        </div>
      </div>`;
  }).join('');
}

async function salvarTarifas() {
  const nomes = { pgpg: 'PG → PG', pgsv: 'PG → SV', pgsantos: 'PG → Santos', pgcubatao: 'PG → Cubatão' };
  const tabelas = {};
  Object.keys(nomes).forEach(key => {
    const min = parseFloat(document.getElementById(`tar_${key}_min`)?.value || 8);
    const km  = parseFloat(document.getElementById(`tar_${key}_km`)?.value  || 1.5);
    tabelas[key] = { minimo: min, valorKm: km };
  });
  const cfg = { ...state.tarifas, tabelas };

  showAguarde();
  try {
    await fetch(`${API}/tarifas`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ config_json: JSON.stringify(cfg) })
    });
    state.tarifas = cfg;
    showToast('Tarifas salvas ✅');
  } catch { showToast('Erro ao salvar'); }
  hideAguarde();
}

function simularCorrida() {
  const origem  = (document.getElementById('simOrigem')?.value  || '').toLowerCase().trim();
  const destino = (document.getElementById('simDestino')?.value || '').toLowerCase().trim();
  if (!origem || !destino) { document.getElementById('simResultado')?.classList.add('hidden'); return; }

  // Lógica simplificada: usar distância lookup se disponível
  const tabelas = state.tarifas?.tabelas || {};
  let rota = 'pgpg', t = tabelas.pgpg || { minimo: 8, valorKm: 1.5 };

  if (destino.includes('são vicente') || destino.includes('sao vicente')) { rota='pgsv';      t=tabelas.pgsv    ||t; }
  else if (destino.includes('santos'))                                     { rota='pgsantos';  t=tabelas.pgsantos||t; }
  else if (destino.includes('cubatão') || destino.includes('cubatao'))    { rota='pgcubatao'; t=tabelas.pgcubatao||t; }

  // Sem distância real: mostrar valor mínimo
  const valor = t.minimo || 8;
  sv('simMetodo',   rota.toUpperCase());
  sv('simDistancia', 'Usar botão "Calcular" na corrida');
  sv('simValor',    `R$ ${valor.toFixed(2).replace('.', ',')}+`);
  document.getElementById('simResultado')?.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════
//  HISTÓRICO
// ═══════════════════════════════════════════════════════════
async function carregarHistorico() {
  try {
    const [cR, mR, clR] = await Promise.all([
      fetch(`${API}/corridas`).then(r => r.json()),
      fetch(`${API}/motoristas`).then(r => r.json()),
      fetch(`${API}/clientes`).then(r => r.json()),
    ]);
    const corridas   = Array.isArray(cR)  ? cR  : [];
    const motoristas = Array.isArray(mR)  ? mR  : [];
    const clientes   = Array.isArray(clR) ? clR : [];

    const mes     = new Date().toLocaleDateString('sv').slice(0, 7);
    const hMes    = corridas.filter(c => (c.criadoEm || '').startsWith(mes) && c.status === 'Finalizada');
    const total   = corridas.filter(c => c.status === 'Finalizada').length;
    const fat     = hMes.reduce((s, c) => s + (c.valorFinal || 0), 0);
    const ticket  = hMes.length ? fat / hMes.length : 0;
    const taxa    = corridas.length
      ? Math.round(corridas.filter(c => c.status === 'Finalizada').length / corridas.length * 100)
      : 0;

    sv('hTotalCorridas', total);
    sv('hTotalFaturado', `R$ ${fat.toFixed(2).replace('.', ',')}`);
    sv('hTicketMedio',   `R$ ${ticket.toFixed(2).replace('.', ',')}`);
    sv('hTaxaConclusao', `${taxa}%`);

    // Ranking motoristas por corridas
    const rankM = [...motoristas].sort((a, b) => (b.corridas || 0) - (a.corridas || 0)).slice(0, 10);
    const listM = document.getElementById('rankingMotoristas');
    if (listM) listM.innerHTML = rankM.map((m, i) => `
      <li class="ranking-item">
        <span class="rank-pos">${i + 1}</span>
        <span class="rank-nome">${m.nome}</span>
        <span class="rank-val">${m.corridas || 0} corridas</span>
      </li>`).join('');

    // Ranking clientes
    const rankC = [...clientes].sort((a, b) => (b.corridas || 0) - (a.corridas || 0)).slice(0, 10);
    const listC = document.getElementById('rankingClientes');
    if (listC) listC.innerHTML = rankC.map((c, i) => `
      <li class="ranking-item">
        <span class="rank-pos">${i + 1}</span>
        <span class="rank-nome">${c.nome}</span>
        <span class="rank-val">${c.corridas || 0} corridas</span>
      </li>`).join('');

    carregarLog();
  } catch (e) { console.error(e); }
}

async function carregarLog() {
  try {
    const r    = await fetch(`${API}/logs`);
    const logs = await r.json();
    const tbody = document.getElementById('logOperacao');
    if (tbody) {
      tbody.innerHTML = (Array.isArray(logs) ? logs : []).slice(0, 50).map(l => `
        <tr>
          <td>${(l.data || l.criado_em || '—').toString().slice(0, 16).replace('T', ' ')}</td>
          <td>${l.operador || '—'}</td>
          <td>${l.acao || '—'}</td>
        </tr>`).join('') || '<tr><td colspan="3" class="empty-td">Sem logs</td></tr>';
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════
async function carregarAdmin() {
  try {
    const [opR, cR, mR] = await Promise.all([
      fetch(`${API}/operadores`).then(r => r.json()).catch(() => []),
      fetch(`${API}/corridas`).then(r => r.json()),
      fetch(`${API}/motoristas`).then(r => r.json()),
    ]);
    state.operadores  = Array.isArray(opR) ? opR : [];
    state.corridas    = Array.isArray(cR)  ? cR  : state.corridas;
    state.motoristas  = Array.isArray(mR)  ? mR  : state.motoristas;

    renderOperadores();
    renderAdminCorridas();
    renderAdminRanking();
  } catch (e) { console.error(e); }
}

function renderOperadores() {
  const tbody = document.getElementById('tabelaOperadores');
  if (!tbody) return;
  tbody.innerHTML = state.operadores.map(o => `
    <tr>
      <td>${o.nome}</td>
      <td>${o.usuario}</td>
      <td>${badgeStatus(o.perfil === 'admin' ? 'Ativo' : 'Ativo')}<small>${o.perfil}</small></td>
      <td>${badgeStatus(o.status === 'ativo' ? 'Ativo' : 'Inativo')}</td>
      <td class="td-acoes">
        <button class="btn sm" onclick="editarOperador(${o.id})">✏️</button>
        <button class="btn sm danger" onclick="excluirOperador(${o.id},'${o.nome}')">🗑</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty-td">Sem operadores</td></tr>';
}

function abrirModalOperador(id) {
  window._editOpId = null;
  ['mOpNome','mOpUsuario','mOpSenha'].forEach(x => sv2(x, ''));
  sv2('mOpPerfil', 'operador');
  sv('modalOpTitulo', 'Novo Operador');
  document.getElementById('modalOperador').classList.remove('hidden');
}

function editarOperador(id) {
  const o = state.operadores.find(x => x.id == id); if (!o) return;
  window._editOpId = id;
  sv2('mOpNome',    o.nome    || '');
  sv2('mOpUsuario', o.usuario || '');
  sv2('mOpSenha',   '');
  sv2('mOpPerfil',  o.perfil  || 'operador');
  sv('modalOpTitulo', `Editar — ${o.nome}`);
  document.getElementById('modalOperador').classList.remove('hidden');
}

async function salvarOperador() {
  const id   = window._editOpId;
  const body = {
    nome:    document.getElementById('mOpNome').value.trim(),
    usuario: document.getElementById('mOpUsuario').value.trim().toLowerCase(),
    senha:   document.getElementById('mOpSenha').value,
    perfil:  document.getElementById('mOpPerfil').value,
  };
  if (!body.nome || !body.usuario) { showToast('Preencha nome e usuário'); return; }
  showAguarde();
  try {
    const res = await fetch(`${API}/operadores${id ? '/' + id : ''}`, {
      method:  id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    const d = await res.json();
    if (!res.ok) { showToast(d.erro || 'Erro'); hideAguarde(); return; }
    fecharModal('modalOperador');
    await carregarAdmin();
    showToast(`Operador ${body.nome} salvo ✅`);
  } catch { showToast('Erro'); }
  hideAguarde();
}

async function excluirOperador(id, nome) {
  if (!confirm(`Excluir operador ${nome}?`)) return;
  showAguarde();
  try {
    await fetch(`${API}/operadores/${id}`, { method: 'DELETE' });
    await carregarAdmin();
    showToast('Operador excluído');
  } catch { showToast('Erro'); }
  hideAguarde();
}

function renderAdminCorridas() {
  const busca = (document.getElementById('adminBuscaCorrida')?.value || '').toLowerCase();
  const lista = state.corridas.filter(c =>
    !busca || `${c.id} ${c.cliente} ${c.motorista} ${c.status}`.toLowerCase().includes(busca)
  ).slice(0, 100);

  const tbody = document.getElementById('adminTabelaCorridas');
  if (!tbody) return;
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><b>#${c.id}</b></td>
      <td>${c.cliente || '—'}</td>
      <td>R$ ${(c.valorFinal || 0).toFixed(2).replace('.', ',')}</td>
      <td>${c.motorista || '—'}</td>
      <td>${badgeStatus(c.status)}</td>
      <td class="td-acoes">
        <button class="btn sm" onclick="editarCorrida(${c.id});showPage('corridas',null)">✏️</button>
        <button class="btn sm danger" onclick="deletarCorrida(${c.id})">🗑</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty-td">Sem corridas</td></tr>';
}

async function deletarCorrida(id) {
  if (!confirm(`Excluir corrida #${id} permanentemente?`)) return;
  showAguarde();
  try {
    await fetch(`${API}/corridas/${id}`, { method: 'DELETE' });
    state.corridas = state.corridas.filter(c => c.id != id);
    renderAdminCorridas();
    showToast(`Corrida #${id} excluída`);
  } catch { showToast('Erro'); }
  hideAguarde();
}

function renderAdminRanking() {
  const tbody = document.getElementById('adminRanking');
  if (!tbody) return;
  tbody.innerHTML = state.motoristas
    .filter(m => m.status !== 'Inativo')
    .sort((a, b) => (b.corridas || 0) - (a.corridas || 0))
    .map(m => `
      <tr>
        <td><b>${m.codigo}</b> — ${m.nome}</td>
        <td><input type="number" class="input-rank" value="${m.corridas || 0}" id="rank_${m.codigo}"/></td>
        <td><button class="btn sm primary" onclick="salvarRank('${m.codigo}',${m.id})">💾</button></td>
      </tr>`).join('');
}

async function salvarRank(codigo, motoId) {
  const val = parseInt(document.getElementById(`rank_${codigo}`)?.value || 0);
  showAguarde();
  try {
    await fetch(`${API}/motoristas/${motoId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ corridas: val })
    });
    const m = state.motoristas.find(x => x.id == motoId);
    if (m) m.corridas = val;
    showToast(`Ranking de ${codigo} atualizado`);
  } catch { showToast('Erro'); }
  hideAguarde();
}

// ═══════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════
async function carregarConfig() {
  try {
    const r   = await fetch(`${API}/config`);
    const cfg = await r.json();
    state.config = cfg;
    sv2('cfgEmpresa', cfg.empresa        || '');
    sv2('cfgWhats',   cfg.whatsapp || cfg.whatsappCentral || '');
    sv2('cfgDiaria',  cfg.valorDiaria    || '');
    sv2('cfgCidade',  cfg.cidade         || '');
    sv2('cfgPix',     cfg.pixChave       || '');
  } catch {}
}

async function salvarConfig() {
  const body = {
    empresa:     document.getElementById('cfgEmpresa').value.trim(),
    whatsapp:    document.getElementById('cfgWhats').value.trim(),
    valorDiaria: parseFloat(document.getElementById('cfgDiaria').value) || 20,
    cidade:      document.getElementById('cfgCidade').value.trim(),
    pixChave:    document.getElementById('cfgPix').value.trim(),
  };
  showAguarde();
  try {
    await fetch(`${API}/config`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    state.config = { ...state.config, ...body };
    showToast('Configurações salvas ✅');
  } catch { showToast('Erro ao salvar'); }
  hideAguarde();
}

async function resetarDispositivoMotorista() {
  const codigo = window._acessoCodigo;
  if (!confirm('Resetar dispositivo de ' + codigo + '? O motorista poderá logar em qualquer aparelho.')) return;
  showAguarde();
  try {
    const r = await fetch(API + '/motorista-auth/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, resetDevice: true })
    });
    const d = await r.json();
    if (r.ok) {
      showToast('✅ Dispositivo de ' + codigo + ' resetado');
      abrirAcesso(codigo, codigo);
    } else {
      showToast(d.erro || 'Erro');
    }
  } catch { showToast('Erro'); }
  hideAguarde();
}

async function liberarMotoApp() {
  const codigo = window._acessoCodigo;
  if (!confirm('Liberar acesso de ' + codigo + '?')) return;
  showAguarde();
  try {
    const r = await fetch(API + '/motorista-auth/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, status: 'ativo', motivo: '' })
    });
    const d = await r.json();
    if (r.ok) { showToast('✅ ' + codigo + ' liberado'); abrirAcesso(codigo, codigo); }
    else showToast(d.erro || 'Erro');
  } catch { showToast('Erro'); }
  hideAguarde();
}
