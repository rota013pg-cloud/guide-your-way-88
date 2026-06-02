// ═══════════════════════════════════════════════════════
//  DASHBOARD.JS — Beta 2.0 — Fix cirúrgico
//  Fixes: filtro de data corridas, guard undefined id,
//         refresh correto após finalizar
// ═══════════════════════════════════════════════════════

// Dia operacional: 6h de hoje até 5h59 de amanhã
// Usado APENAS para financeiro (diárias)
function _diaOp() {
  const d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('sv'); // YYYY-MM-DD
}

// Data calendário simples (para corridas — não usa regra das 6h)
function _dataHoje() {
  return new Date().toLocaleDateString('sv'); // YYYY-MM-DD
}

function renderDashboard() {
  const diaOp    = _diaOp();    // para financeiro
  const dataHoje = _dataHoje(); // para corridas

  const corridas  = state.corridas   || [];
  const motoristas= state.motoristas || [];
  const financeiro= state.financeiro || [];

  // Corridas do dia calendário (não usa regra das 6h)
  const hCorridas = corridas.filter(c =>
    (c.criadoEm || c.dataHora || '').startsWith(dataHoje)
  );
  const andamento = corridas.filter(c =>
    ['Aceita','A caminho','Em curso','Chegou','Divulgada'].includes(c.status)
  );
  const online = motoristas.filter(m =>
    ['Online','Disponivel','Ocupado'].includes(m.status)
  );

  // Diárias: usar intervalo de 24h do dia operacional
  // (não confiar em comparação de string de data — timezone pode divergir)
  const diaria  = Number(state.config?.valorDiaria ||
    document.getElementById('cfgDiaria')?.value || 0);
  // Calcular intervalo do dia operacional em UTC-3
  const _brtNow  = new Date(Date.now() - 3*60*60*1000);
  if (_brtNow.getUTCHours() < 6) _brtNow.setUTCDate(_brtNow.getUTCDate() - 1);
  _brtNow.setUTCHours(6, 0, 0, 0);
  const _opStart = _brtNow.getTime();
  const _opEnd   = _opStart + 24*60*60*1000;
  const pagos = financeiro.filter(f => {
    if (f.tipo !== 'Diária') return false;
    // Tentar parsear como data — aceitar UTC e BRT
    const ds = (f.data || '').replace(' ', 'T');
    if (!ds) return false;
    // Se não tem timezone, assumir UTC (formato do banco)
    const dt = new Date(ds.includes('+') || ds.includes('Z') ? ds : ds + 'Z').getTime();
    return dt >= _opStart && dt < _opEnd;
  }).length;

  _sv('dashCorridas',   hCorridas.length);
  _sv('dashAndamento',  andamento.length);
  _sv('dashMotoristas', online.length);
  _sv('dashDiarias',    moeda(pagos * diaria));
  _sv('dashOnlineCount', online.length + ' online');
  _sv('dashAtivasCount', andamento.length);

  _renderMotoristasList(online);
  _renderCorridasAtivas(andamento);
  _renderHistorico(corridas);
  setTimeout(drawChart, 50);
}

function _sv(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

// ── Motoristas online ─────────────────────────────────
function _renderMotoristasList(online) {
  const el = document.getElementById('dashMotoristasList');
  if (!el) return;
  if (!online.length) {
    el.innerHTML = '<div class="dash-empty">Nenhum motorista online</div>';
    return;
  }
  el.innerHTML = online.map(m => {
    const ini = (m.nome||'M').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
    const emCorrida = ['Ocupado','A caminho','Em curso','Chegou'].includes(m.status);
    return `<div class="dash-mot-item">
      <div class="dash-mot-foto" style="${m.foto?`background-image:url('${m.foto}');background-size:cover`:''}">${m.foto?'':ini}</div>
      <div class="dash-mot-info">
        <div class="dash-mot-nome">${m.nome}</div>
        <div class="dash-mot-sub">${m.codigo} · ${m.moto||''}</div>
      </div>
      <span class="dash-mot-badge">${emCorrida?'🚗':'✅'}</span>
    </div>`;
  }).join('');
}

// ── Corridas ativas ───────────────────────────────────
function _renderCorridasAtivas(ativas) {
  const el = document.getElementById('dashCorridasAtivas');
  if (!el) return;
  if (!ativas.length) {
    el.innerHTML = '<div class="dash-empty">Nenhuma corrida ativa</div>';
    return;
  }
  const cor = {
    'Nova':'#6b7280','Divulgada':'#7c3aed','Aceita':'#16a34a',
    'A caminho':'#f97316','Em curso':'#f97316','Chegou':'#2563eb'
  };
  el.innerHTML = ativas.map(c => {
    if (!c.id) return ''; // guard: ignorar corridas sem ID
    return `<div class="dash-ativa-item">
      <div class="dash-ativa-header">
        <span class="dash-ativa-id">#${c.id}</span>
        <span class="dash-ativa-status" style="color:${cor[c.status]||'#888'}">● ${c.status}</span>
      </div>
      <div class="dash-ativa-cliente">${c.cliente||'—'}</div>
      <div class="dash-ativa-rota">
        <span>📍 ${_c(c.origem)}</span>
        <span>🏁 ${_c(c.destino)}</span>
      </div>
      <div class="dash-ativa-footer">
        <span class="dash-ativa-mot">${c.motoristaCodigo||'<span style="color:#888">Aguardando</span>'}</span>
        <span class="dash-ativa-valor">${moeda(c.valorFinal)}</span>
      </div>
    </div>`;
  }).join('');
}

function _c(s, n=22) {
  if (!s) return '—';
  return s.length > n ? s.slice(0,n)+'…' : s;
}

// ── Histórico de corridas ─────────────────────────────
function _renderHistorico(corridas) {
  const tbody = document.getElementById('dashboardCorridas');
  if (!tbody) return;
  const opts  = ['Nova','Divulgada','Aceita','A caminho','Em curso','Finalizada','Cancelada'];
  const lista = corridas.filter(c => c.id).slice(0, 10); // guard: só corridas com ID

  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><b>${c.clienteCodigo||'—'}</b><br><small>${c.cliente||'—'}</small></td>
      <td style="font-size:12px;max-width:200px">
        <span title="${c.origem||''}">${_c(c.origem,18)}</span><br>
        <span title="${c.destino||''}" style="color:var(--muted)">${_c(c.destino,18)}</span>
      </td>
      <td><b>${moeda(c.valorFinal)}</b></td>
      <td>${c.motoristaCodigo
        ?`<b>${c.motoristaCodigo}</b><br><small>${c.motorista||''}</small>`
        :'<small style="color:var(--muted)">Aguardando</small>'}</td>
      <td>
        <select class="status-select status-${(c.status||'Nova').toLowerCase().replace(/ /g,'-')}"
          onchange="mudarStatusCorrida(${c.id},this.value,this)"
          ${['Finalizada','Cancelada'].includes(c.status)?'disabled':''}>
          ${opts.map(s=>`<option value="${s}"${c.status===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="actions-cell">
        <button class="btn" onclick="editarCorrida(${c.id})" title="Editar">✏️</button>
        <button class="btn" onclick="abrirModalMensagens(${c.id})" title="Mensagens">💬</button>
      </td>
    </tr>`).join('') ||
    '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">Nenhuma corrida</td></tr>';
}

// ── Ranking motoristas ────────────────────────────────
function drawChart() {
  const wrap = document.getElementById('rankingMotoristasDash');
  if (!wrap) return;
  const data = [...(state.motoristas||[])].sort((a,b)=>(b.corridas||0)-(a.corridas||0));
  if (!data.length) { wrap.innerHTML='<p style="color:var(--muted);padding:12px">Sem dados</p>'; return; }
  const max = Math.max(...data.map(d=>d.corridas||0),1);
  wrap.innerHTML = data.map((m,i) => {
    const pct   = Math.round(((m.corridas||0)/max)*100);
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}º`;
    return `<div class="rank-row">
      <span class="rank-medal">${medal}</span>
      <div class="rank-info">
        <div class="rank-name">${m.codigo} — ${m.nome}</div>
        <div class="rank-bar-wrap">
          <div class="rank-bar" style="width:${Math.max(pct,2)}%"></div>
          <span class="rank-val">${m.corridas||0}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── renderAll ─────────────────────────────────────────
function renderAll() {
  renderOptions();
  renderDashboard();
  if (typeof renderCorridas    === 'function') renderCorridas();
  if (typeof renderClientes    === 'function') renderClientes();
  if (typeof renderMotoristas  === 'function') renderMotoristas();
  if (typeof renderFinanceiro  === 'function') renderFinanceiro();
  if (typeof renderMensagens   === 'function') renderMensagens();
  if (typeof renderHistorico   === 'function') renderHistorico();
  if (typeof renderAdmin       === 'function') renderAdmin();
  if (typeof renderAdminCorridas==='function') renderAdminCorridas();
  if (typeof renderConfiguracoes==='function') renderConfiguracoes();
  if (typeof initTarifas       === 'function') initTarifas();
}

function renderOptions() {
  if (typeof state_tarifas !== 'undefined') {
    const opts = state_tarifas.tabelasFixas.map(t=>`<option value="${t.id}">${t.titulo}</option>`).join('');
    const el = document.getElementById('corridaTarifa');
    if (el) el.innerHTML = opts;
  }
  const optsMot = '<option value="">Enviar para grupo</option>' +
    (state.motoristas||[]).map(m=>`<option value="${m.codigo}">${m.codigo} - ${m.nome} (${m.status})</option>`).join('');
  const elMot = document.getElementById('corridaMotorista');
  if (elMot) elMot.innerHTML = optsMot;
}
