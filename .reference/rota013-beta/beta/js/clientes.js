// ═══════════════════════════════════════════════════════
//  CLIENTES.JS — V8.1 com edição
// ═══════════════════════════════════════════════════════

function renderClientes() {
  const busca = (document.getElementById('buscaCliente')?.value || '').toLowerCase();
  const lista = (state.clientes || []).filter(c =>
    `${c.codigo} ${c.nome} ${c.telefone}`.toLowerCase().includes(busca)
  );
  const tbody = document.getElementById('tabelaClientes');
  if (!tbody) return;
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><b>${c.codigo}</b></td>
      <td data-label="Nome">${c.nome}</td>
      <td data-label="WhatsApp">${mascaraTelefone(c.telefone || '')}</td>
      <td>${c.cidade || '-'}</td>
      <td>${c.corridas || 0}</td>
      <td class="actions-cell">
        <button class="btn primary" onclick="novaCorridaParaCliente('${c.codigo}')" title="Nova corrida">🏍️</button>
        <button class="btn" onclick="editarCliente('${c.codigo}')" title="Editar">✏️</button>
        <button class="btn whatsapp" onclick="abrirWhats('${c.telefone}','Olá ${(c.nome||'').replace(/'/g,'')}!')">📲</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Nenhum cliente</td></tr>';
}

// ─── Novo cliente ─────────────────────────────────────
function novoCliente() {
  _limparModalCliente();
  document.querySelector('#modalCliente h3').textContent = 'Novo Cliente';
  document.getElementById('clienteEditCodigo').value = '';
  document.getElementById('clienteCodigo').value = gerarCodigoCliente();
  openModal('modalCliente');
}

// ─── Editar cliente ───────────────────────────────────
function editarCliente(codigo) {
  const c = (state.clientes || []).find(x => x.codigo === codigo);
  if (!c) { showToast('Cliente não encontrado.'); return; }

  _limparModalCliente();
  document.querySelector('#modalCliente h3').textContent = `Editar Cliente ${c.codigo}`;
  document.getElementById('clienteEditCodigo').value = c.codigo;
  document.getElementById('clienteCodigo').value     = c.codigo;
  document.getElementById('clienteNome').value       = c.nome    || '';
  document.getElementById('clienteWhats').value      = mascaraTelefone(c.telefone || '');
  document.getElementById('clienteCidade').value     = c.cidade  || '';
  document.getElementById('clienteObs').value        = c.obs     || '';
  openModal('modalCliente');
}

function _limparModalCliente() {
  ['clienteNome','clienteWhats','clienteCidade','clienteObs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

// ─── Salvar (novo ou editar) ──────────────────────────
async function salvarCliente() {
  const editCod = (document.getElementById('clienteEditCodigo')?.value || '').trim();
  const nome    = capitalizarNome((document.getElementById('clienteNome')?.value || '').trim());
  const tel     = (document.getElementById('clienteWhats')?.value || '').replace(/\D/g, '');
  const cidade  = (document.getElementById('clienteCidade')?.value || '').trim();
  const obs     = (document.getElementById('clienteObs')?.value || '').trim();

  if (!nome) { showToast('Informe o nome.'); return; }
  if (!tel)  { showToast('Informe o WhatsApp.'); return; }
  showAguarde();

  if (editCod) {
    // EDITAR
    const idx = state.clientes.findIndex(c => c.codigo === editCod);
    if (idx >= 0) {
      state.clientes[idx] = { ...state.clientes[idx], nome, telefone: tel, cidade, obs };
      try {
        await apiPut(`/clientes/${state.clientes[idx].id}`, state.clientes[idx]);
        hideAguarde(); showToast(`Cliente ${editCod} atualizado ✅`);
      } catch {
        hideAguarde(); showToast('Atualizado localmente ⚠️');
      }
    }
  } else {
    // NOVO
    const novo = {
      codigo:   document.getElementById('clienteCodigo')?.value || gerarCodigoCliente(),
      nome, telefone: tel, cidade, obs, corridas: 0
    };
    try {
      await salvarClienteAPI(novo);
      hideAguarde(); showToast(`Cliente ${novo.codigo} cadastrado ✅`);
    } catch {
      state.clientes.push({ ...novo, id: nextId(state.clientes) });
      hideAguarde(); showToast('Salvo localmente ⚠️');
    }
  }

  closeModal('modalCliente');
  addLog(`Cliente ${editCod ? 'editado' : 'cadastrado'}: ${editCod || nome}`);
  renderAll();
}

function gerarCodigoCliente() {
  const nums = (state.clientes || []).map(c => parseInt(c.codigo) || 0);
  return String(Math.max(...nums, 0) + 1).padStart(4, '0');
}
