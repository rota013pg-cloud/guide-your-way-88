// ═══════════════════════════════════════════════════════
//  HISTORICO.JS — V8: Admin completo com CRUD
// ═══════════════════════════════════════════════════════

function renderHistorico() {
  const rankCli = document.getElementById("rankingClientes");
  if (rankCli) {
    rankCli.innerHTML = [...(state.clientes||[])].sort((a,b)=>(b.corridas||0)-(a.corridas||0))
      .map(c=>`<li><b>${c.codigo}</b> — ${c.nome}: <b>${c.corridas||0}</b></li>`).join("") || "<li style='color:var(--muted)'>Sem dados</li>";
  }
  const rankMot = document.getElementById("rankingMotoristas");
  if (rankMot) {
    rankMot.innerHTML = [...(state.motoristas||[])].sort((a,b)=>(b.corridas||0)-(a.corridas||0))
      .map(m=>`<li><b>${m.codigo}</b> — ${m.nome}: <b>${m.corridas||0}</b></li>`).join("") || "<li style='color:var(--muted)'>Sem dados</li>";
  }
  const logEl = document.getElementById("logOperacao");
  if (logEl) {
    logEl.innerHTML = (state.logs||[]).map(l=>`<tr><td>${l.data||l.Data||''}</td><td>${l.operador||l.Operador||''}</td><td>${l.acao||l.Acao||''}</td></tr>`).join("");
  }
}

// ═══════════════════════════════════════════════════════
//  ADMIN — Operadores
// ═══════════════════════════════════════════════════════

function renderAdmin() {
  const tbody = document.getElementById("tabelaOperadores");
  if (!tbody) return;
  tbody.innerHTML = (state.operadores||[]).map(o => `
    <tr>
      <td><b>${o.nome}</b></td>
      <td>${o.usuario}</td>
      <td>${o.perfil}</td>
      <td>${badge(o.status)}</td>
      <td class="actions-cell">
        <button class="btn" onclick="editarOperador(${o.id})">✏️</button>
        ${o.id !== state.currentUser?.id
          ? `<button class="btn" onclick="toggleStatusOperador(${o.id})">${o.status==='Ativo'?'🔒':'🔓'}</button>`
          : '<span style="color:var(--muted);font-size:12px">você</span>'}
      </td>
    </tr>`).join("");

  // Renderizar as abas de gestão do banco
  renderAdminCorridas();
  renderAdminClientes();
  renderAdminMotoristas();
  renderAdminRanking();
}

function abrirModalOperador() {
  document.getElementById('opEditId').value  = '';
  document.getElementById('opNome').value    = '';
  document.getElementById('opUsuario').value = '';
  document.getElementById('opSenha').value   = '';
  document.getElementById('opPerfil').value  = 'operador';
  document.querySelector('#modalOperador h3').textContent = 'Novo Operador';
  openModal('modalOperador');
}

function editarOperador(id) {
  const op = (state.operadores||[]).find(o => o.id === id);
  if (!op) return;
  document.getElementById('opEditId').value  = op.id;
  document.getElementById('opNome').value    = op.nome;
  document.getElementById('opUsuario').value = op.usuario;
  document.getElementById('opSenha').value   = '';
  document.getElementById('opPerfil').value  = op.perfil;
  document.querySelector('#modalOperador h3').textContent = `Editar: ${op.nome}`;
  openModal('modalOperador');
}

async function salvarOperador() {
  showAguarde();
  if (state.currentUser?.perfil !== "admin") { showToast("Apenas admin."); return; }
  const editId = parseInt(document.getElementById('opEditId')?.value || '0');
  const nome   = (document.getElementById('opNome')?.value||'').trim();
  const usuario= (document.getElementById('opUsuario')?.value||'').trim();
  const senha  = (document.getElementById('opSenha')?.value||'').trim();
  const perfil = document.getElementById('opPerfil')?.value || 'operador';
  if (!nome)    { showToast('Informe o nome.');    return; }
  if (!usuario) { showToast('Informe o usuário.'); return; }
  if (editId) {
    const idx = state.operadores.findIndex(o => o.id === editId);
    if (idx >= 0) {
      state.operadores[idx] = { ...state.operadores[idx], nome, usuario, perfil, ...(senha?{senha}:{}) };
      try { await apiPut(`/operadores/${editId}`, state.operadores[idx]); } catch {}
      showToast('Operador atualizado ✅');
    }
  } else {
    if (!senha) { showToast('Informe uma senha.'); return; }
    const novo = { id: nextId(state.operadores), nome, usuario, senha, perfil, status: 'Ativo' };
    state.operadores.push(novo);
    try { await apiPost('/operadores', novo); } catch {}
    showToast(`Operador ${usuario} criado ✅`);
  }
  hideAguarde(); closeModal('modalOperador');
  renderAdmin();
  addLog(`Operador ${editId?'editado':'cadastrado'}: ${usuario}`);
}

async function toggleStatusOperador(id) {
  const op = state.operadores.find(o => o.id === id);
  if (!op) return;
  op.status = op.status === 'Ativo' ? 'Bloqueado' : 'Ativo';
  try { await apiPatch(`/operadores/${id}/status`, { status: op.status }); } catch {}
  showToast(`${op.nome}: ${op.status}`);
  renderAdmin();
}

// ═══════════════════════════════════════════════════════
//  ADMIN — Gestão Corridas
// ═══════════════════════════════════════════════════════

function renderAdminCorridas() {
  const tbody = document.getElementById('adminTabelaCorridas');
  if (!tbody) return;
  const busca = (document.getElementById('adminBuscaCorrida')?.value||'').toLowerCase();
  const lista = (state.corridas||[]).filter(c =>
    `${c.id} ${c.cliente} ${c.motoristaCodigo} ${c.status}`.toLowerCase().includes(busca)
  );
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><b>#${c.id}</b></td>
      <td>${c.clienteCodigo||'-'} — ${c.cliente}</td>
      <td>${moeda(c.valorFinal)}</td>
      <td>${c.motoristaCodigo||'-'}</td>
      <td>${badge(c.status)}</td>
      <td class="actions-cell">
        <button class="btn" onclick="adminEditarCorrida(${c.id})">✏️</button>
        <button class="btn" style="color:var(--red)" onclick="adminExcluir('corridas',${c.id},'Corrida #${c.id}')">🗑</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Sem corridas</td></tr>';
}

function adminEditarCorrida(id) {
  editarCorrida(id);
  showPage('corridas');
}

// ═══════════════════════════════════════════════════════
//  ADMIN — Gestão Clientes
// ═══════════════════════════════════════════════════════

function renderAdminClientes() {
  const tbody = document.getElementById('adminTabelaClientes');
  if (!tbody) return;
  const busca = (document.getElementById('adminBuscaCliente')?.value||'').toLowerCase();
  const lista = (state.clientes||[]).filter(c =>
    `${c.codigo} ${c.nome} ${c.telefone}`.toLowerCase().includes(busca)
  );
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><b>${c.codigo}</b></td>
      <td>${c.nome}</td>
      <td>${mascaraTelefone(c.telefone||'')}</td>
      <td>${c.corridas||0}</td>
      <td class="actions-cell">
        <button class="btn" onclick="adminEditarCliente('${c.codigo}')">✏️</button>
        <button class="btn" style="color:var(--red)" onclick="adminExcluir('clientes',${c.id},'Cliente ${c.nome}')">🗑</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Sem clientes</td></tr>';
}

function adminEditarCliente(codigo) {
  showPage('clientes');
  setTimeout(() => editarCliente(codigo), 100);
}

// ═══════════════════════════════════════════════════════
//  ADMIN — Gestão Motoristas / Ranking
// ═══════════════════════════════════════════════════════

function renderAdminMotoristas() {
  const tbody = document.getElementById('adminTabelaMotoristas');
  if (!tbody) return;
  tbody.innerHTML = (state.motoristas||[]).map(m => `
    <tr>
      <td><b>${m.codigo}</b></td>
      <td>${m.nome}</td>
      <td>${mascaraTelefone(m.telefone||'')}</td>
      <td>${m.status}</td>
      <td class="actions-cell">
        <button class="btn" onclick="editarMotorista('${m.codigo}');showPage('motoristas')">✏️</button>
        <button class="btn" title="Acesso app" onclick="abrirAcesso('${m.codigo}','${m.nome}')">🔑</button>
        <button class="btn" style="color:var(--red)" onclick="adminExcluir('motoristas',${m.id},'Motorista ${m.nome}')">🗑</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Sem motoristas</td></tr>';
}

// ─── Ranking editável ─────────────────────────────────
function renderAdminRanking() {
  const tbody = document.getElementById('adminRankingMotoristas');
  if (!tbody) return;
  const sorted = [...(state.motoristas||[])].sort((a,b)=>(b.corridas||0)-(a.corridas||0));
  tbody.innerHTML = sorted.map(m => `
    <tr>
      <td><b>${m.codigo}</b> — ${m.nome}</td>
      <td>
        <div class="input-button" style="max-width:160px">
          <input type="number" min="0" value="${m.corridas||0}" id="rankEdit_${m.codigo}"
            style="width:80px;padding:4px 8px">
          <button class="btn primary" onclick="salvarRankingMotorista('${m.codigo}')">✓</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="2" style="color:var(--muted)">Sem motoristas</td></tr>';
}

async function salvarRankingMotorista(codigo) {
  showAguarde();
  const m   = state.motoristas.find(x => x.codigo === codigo);
  const el  = document.getElementById(`rankEdit_${codigo}`);
  if (!m || !el) return;
  const novas = parseInt(el.value) || 0;
  m.corridas = novas;
  try { await apiPut(`/motoristas/${m.id}`, m); } catch {}
  showToast(`${m.codigo}: ${novas} corridas ✅`);
  renderAdminRanking();
  drawChart();
}

// ─── Excluir registro ─────────────────────────────────
async function adminExcluir(entidade, id, label) {
  showAguarde();
  if (!confirm(`Excluir permanentemente: ${label}?\n\nEsta ação não pode ser desfeita.`)) return;
  try {
    await apiDelete(`/${entidade}/${id}`);
    // Remover do state
    if (entidade === 'corridas')   state.corridas   = state.corridas.filter(x => x.id !== id);
    if (entidade === 'clientes')   state.clientes   = state.clientes.filter(x => x.id !== id);
    if (entidade === 'motoristas') state.motoristas = state.motoristas.filter(x => x.id !== id);
    hideAguarde(); showToast(`${label} excluído ✅`);
    addLog(`Excluído: ${label}`);
  } catch {
    // fallback local
    if (entidade === 'corridas')   state.corridas   = state.corridas.filter(x => x.id !== id);
    if (entidade === 'clientes')   state.clientes   = state.clientes.filter(x => x.id !== id);
    if (entidade === 'motoristas') state.motoristas = state.motoristas.filter(x => x.id !== id);
    showToast(`${label} excluído localmente ⚠️`);
  }
  renderAll();
}
