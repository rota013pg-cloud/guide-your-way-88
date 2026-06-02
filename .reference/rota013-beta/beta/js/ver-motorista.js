;(function () {
'use strict';
// ═══════════════════════════════════════════════════════════
//  VER-MOTORISTA.JS — Rota 013 Beta 2.0  (dentro de IIFE)
// ═══════════════════════════════════════════════════════════

// ── Injetar HTML do modal ─────────────────────────────────
document.body.insertAdjacentHTML('beforeend', [
'<div id="modalVerMotorista" class="modal hidden" role="dialog">',
'  <div class="modal-content modal-lg">',
'    <div class="modal-header">',
'      <h3 id="verMotTitulo">Ficha do Motorista</h3>',
'      <button class="btn-close" onclick="fecharModal(\'modalVerMotorista\')">✕</button>',
'    </div>',
'    <div class="modal-body" style="padding:0">',

'      <div class="ver-mot-header">',
'        <div id="verMotFoto" class="ver-mot-foto"></div>',
'        <div class="ver-mot-info">',
'          <h2 id="verMotNome">—</h2>',
'          <div id="verMotCodigo" class="ver-mot-codigo">—</div>',
'          <div class="ver-mot-badges">',
'            <span id="verMotStatusBadge" class="badge gray">—</span>',
'            <span id="verMotAppBadge"    class="badge gray">—</span>',
'          </div>',
'        </div>',
'        <div class="ver-mot-acoes-top">',
'          <button class="btn sm" onclick="editarMotoristaDaFicha()">✏️ Editar</button>',
'          <button class="btn sm" onclick="abrirAcessoDaFicha()">🔑 Acesso app</button>',
'        </div>',
'      </div>',

'      <div class="ver-mot-tabs">',
'        <button class="ver-tab active" onclick="verTab(\'dados\',this)">📋 Dados</button>',
'        <button class="ver-tab" onclick="verTab(\'veiculo\',this)">🏍️ Veículo</button>',
'        <button class="ver-tab" onclick="verTab(\'docs\',this)">📄 Documentos</button>',
'        <button class="ver-tab" onclick="verTab(\'corridas\',this)">📊 Histórico</button>',
'      </div>',

'      <div id="verTab-dados" class="ver-tab-content active">',
'        <div class="ver-grid">',
'          <div class="ver-field"><span class="ver-label">Telefone</span><a id="verMotTelefone" href="#" class="link-wa" target="_blank">—</a></div>',
'          <div class="ver-field"><span class="ver-label">Tel. Familiar</span><span id="verMotTelFam">—</span></div>',
'          <div class="ver-field"><span class="ver-label">Nome familiar</span><span id="verMotNomeFam">—</span></div>',
'          <div class="ver-field"><span class="ver-label">Cidade</span><span id="verMotCidade">—</span></div>',
'          <div class="ver-field"><span class="ver-label">CPF</span><span id="verMotCpf">—</span></div>',
'          <div class="ver-field"><span class="ver-label">CNH</span><span id="verMotCnh">—</span></div>',
'          <div class="ver-field" style="grid-column:1/-1"><span class="ver-label">Endereço</span><span id="verMotEndereco">—</span></div>',
'          <div class="ver-field" style="grid-column:1/-1"><span class="ver-label">Corridas realizadas</span><span id="verMotCorridas" style="font-size:22px;font-weight:800">—</span></div>',
'        </div>',
'      </div>',

'      <div id="verTab-veiculo" class="ver-tab-content">',
'        <div class="ver-grid">',
'          <div class="ver-field"><span class="ver-label">Moto</span><span id="verMotMoto" style="font-weight:700">—</span></div>',
'          <div class="ver-field"><span class="ver-label">Placa</span><span id="verMotPlaca" style="font-weight:800;font-size:18px;letter-spacing:2px">—</span></div>',
'          <div class="ver-field"><span class="ver-label">Cor</span><span id="verMotCor">—</span></div>',
'        </div>',
'        <div id="verMotFotoMotoWrap" class="ver-foto-moto-wrap hidden">',
'          <span class="ver-label">Foto da moto</span>',
'          <img id="verMotFotoMoto" class="ver-foto-moto" alt="Foto moto" onclick="abrirImagem(this.src)"/>',
'        </div>',
'      </div>',

'      <div id="verTab-docs" class="ver-tab-content">',
'        <div class="ver-docs-grid">',
'          <div class="ver-doc-item">',
'            <span class="ver-label">CNH</span>',
'            <div id="verDocCnh" class="ver-doc-preview"></div>',
'            <label class="btn sm" style="cursor:pointer;margin-top:6px">📎 Upload CNH<input type="file" accept="image/*,.pdf" onchange="uploadDoc(this,\'docCnh\')" style="display:none"/></label>',
'          </div>',
'          <div class="ver-doc-item">',
'            <span class="ver-label">Doc. Veículo</span>',
'            <div id="verDocVeiculo" class="ver-doc-preview"></div>',
'            <label class="btn sm" style="cursor:pointer;margin-top:6px">📎 Doc. Veículo<input type="file" accept="image/*,.pdf" onchange="uploadDoc(this,\'docVeiculo\')" style="display:none"/></label>',
'          </div>',
'          <div class="ver-doc-item">',
'            <span class="ver-label">Comp. Endereço</span>',
'            <div id="verDocEndereco" class="ver-doc-preview"></div>',
'            <label class="btn sm" style="cursor:pointer;margin-top:6px">📎 Comp. End.<input type="file" accept="image/*,.pdf" onchange="uploadDoc(this,\'docEndereco\')" style="display:none"/></label>',
'          </div>',
'        </div>',
'        <p class="ver-doc-hint">Clique na imagem para ampliar. Máximo 5MB por documento.</p>',
'      </div>',

'      <div id="verTab-corridas" class="ver-tab-content">',
'        <div class="empty-state">Clique na aba para carregar</div>',
'      </div>',

'    </div>',
'    <div class="modal-footer">',
'      <button class="btn danger sm" onclick="confirmarExcluirMotorista()">🗑 Excluir</button>',
'      <button class="btn" onclick="fecharModal(\'modalVerMotorista\')">Fechar</button>',
'    </div>',
'  </div>',
'</div>',

'<div id="modalLightbox" class="modal hidden" onclick="fecharModal(\'modalLightbox\')" style="background:rgba(0,0,0,.92)">',
'  <div style="max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center">',
'    <img id="lightboxImg" style="max-width:100%;max-height:85vh;border-radius:8px" alt=""/>',
'  </div>',
'</div>'
].join('\n'));

// ── Estilos ───────────────────────────────────────────────
var vmStyle = document.createElement('style');
vmStyle.textContent = [
'.ver-mot-header{display:flex;align-items:flex-start;gap:20px;padding:20px;background:#f9fafb;border-bottom:1px solid var(--line)}',
'.ver-mot-foto{width:80px;height:80px;border-radius:50%;background:var(--gold);color:#111;font-weight:800;font-size:26px;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center;flex-shrink:0;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.15)}',
'.ver-mot-info{flex:1}.ver-mot-info h2{margin:0 0 4px;font-size:20px}',
'.ver-mot-codigo{font-size:13px;color:var(--muted);margin-bottom:8px}',
'.ver-mot-badges{display:flex;gap:6px;flex-wrap:wrap}',
'.ver-mot-acoes-top{display:flex;flex-direction:column;gap:8px;flex-shrink:0}',
'.ver-mot-tabs{display:flex;border-bottom:2px solid var(--line);background:#fff}',
'.ver-tab{background:none;border:none;padding:12px 20px;font-weight:600;font-size:13px;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s}',
'.ver-tab:hover{color:var(--text)}.ver-tab.active{color:var(--text);border-bottom-color:var(--gold)}',
'.ver-tab-content{display:none;padding:20px}.ver-tab-content.active{display:block}',
'.ver-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
'.ver-field{display:flex;flex-direction:column;gap:4px}',
'.ver-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}',
'.ver-foto-moto-wrap{margin-top:16px}',
'.ver-foto-moto{max-width:100%;max-height:280px;border-radius:12px;cursor:zoom-in;margin-top:8px;display:block}',
'.ver-docs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}',
'.ver-doc-item{display:flex;flex-direction:column}',
'.ver-doc-preview{min-height:120px;border:2px dashed var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-top:6px;overflow:hidden;background:#f9fafb;cursor:pointer}',
'.ver-doc-preview img{width:100%;height:120px;object-fit:cover;border-radius:10px}',
'.doc-vazio{color:var(--muted);font-size:12px}',
'.ver-doc-hint{font-size:11px;color:var(--muted);margin-top:12px}',
'.ver-corrida-item{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}',
'.ver-corrida-item:last-child{border-bottom:none}',
'.ver-corrida-rota{color:var(--muted);font-size:12px;margin-top:2px}',
'@media(max-width:600px){.ver-docs-grid{grid-template-columns:1fr}.ver-grid{grid-template-columns:1fr}.ver-mot-header{flex-wrap:wrap}}'
].join('');
document.head.appendChild(vmStyle);

// ── Estado ────────────────────────────────────────────────
var _verMotoId = null;

// ── Abrir ficha ───────────────────────────────────────────
window.verMotorista = function (id) {
  var m = state.motoristas.find(function (x) { return x.id == id; });
  if (!m) return;
  _verMotoId = id;

  var fotoEl = document.getElementById('verMotFoto');
  if (fotoEl) {
    if (m.foto) { fotoEl.style.backgroundImage = "url('" + m.foto + "')"; fotoEl.textContent = ''; }
    else { fotoEl.style.backgroundImage = ''; fotoEl.textContent = (m.nome || 'M').split(' ').map(function(p){return p[0];}).slice(0,2).join('').toUpperCase(); }
  }

  function sv(elId, v) { var el = document.getElementById(elId); if (el) el.textContent = v; }

  document.getElementById('verMotTitulo').textContent = 'Ficha — ' + m.nome;
  sv('verMotNome',     m.nome    || '—');
  sv('verMotCodigo',   m.codigo  || '—');

  var stBadge = document.getElementById('verMotStatusBadge');
  var apBadge = document.getElementById('verMotAppBadge');
  var online  = ['Disponivel','Ocupado'].includes(m.status);
  if (stBadge) { stBadge.className = 'badge ' + (online ? 'green' : 'gray'); stBadge.textContent = m.status || '—'; }
  if (apBadge) { apBadge.className = 'badge ' + (online ? 'green' : 'gray'); apBadge.textContent = online ? '🟢 Online' : '⚫ Offline'; }

  var telEl = document.getElementById('verMotTelefone');
  if (telEl) {
    if (m.telefone) { telEl.href = 'https://wa.me/55' + m.telefone.replace(/\D/g,''); telEl.textContent = m.telefone; }
    else { telEl.href = '#'; telEl.textContent = '—'; }
  }
  sv('verMotTelFam',   m.telefoneFamiliar || '—');
  sv('verMotNomeFam',  m.nomeFamiliar     || '—');
  sv('verMotCidade',   m.cidade           || '—');
  sv('verMotCpf',      m.cpf              || '—');
  sv('verMotCnh',      m.cnh              || '—');
  sv('verMotEndereco', m.endereco         || '—');
  sv('verMotCorridas', m.corridas         || '0');
  sv('verMotMoto',     m.moto             || '—');
  sv('verMotPlaca',    m.placa            || '—');
  sv('verMotCor',      m.cor              || '—');

  var fotoMotoWrap = document.getElementById('verMotFotoMotoWrap');
  var fotoMotoImg  = document.getElementById('verMotFotoMoto');
  if (m.fotoMoto && fotoMotoWrap && fotoMotoImg) {
    fotoMotoWrap.classList.remove('hidden');
    fotoMotoImg.src = m.fotoMoto;
  } else if (fotoMotoWrap) {
    fotoMotoWrap.classList.add('hidden');
  }

  renderDocPreview('verDocCnh',     m.docCnh);
  renderDocPreview('verDocVeiculo', m.docVeiculo);
  renderDocPreview('verDocEndereco',m.docEndereco);

  // Resetar tabs
  verTab('dados', null);
  document.getElementById('verTab-corridas').innerHTML = '<div class="empty-state">Clique na aba para carregar</div>';

  document.getElementById('modalVerMotorista').classList.remove('hidden');
};

function renderDocPreview(elId, base64) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (base64 && base64.length > 50) {
    if (base64.startsWith('data:image')) {
      el.innerHTML = '<img src="' + base64 + '" onclick="abrirImagem(this.src)" alt="doc"/>';
    } else {
      el.innerHTML = '<div style="padding:16px;text-align:center"><div style="font-size:32px">📄</div><div style="font-size:12px;margin-top:8px">PDF disponível</div></div>';
    }
  } else {
    el.innerHTML = '<div class="doc-vazio">📎 Sem documento</div>';
  }
}

// ── Tabs ──────────────────────────────────────────────────
window.verTab = function (tab, btn) {
  document.querySelectorAll('.ver-tab-content').forEach(function (el) { el.classList.remove('active'); });
  document.querySelectorAll('.ver-tab').forEach(function (b) { b.classList.remove('active'); });

  var tabEl = document.getElementById('verTab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (btn) btn.classList.add('active');
  else {
    var idx = ['dados','veiculo','docs','corridas'].indexOf(tab);
    var tabs = document.querySelectorAll('.ver-tab');
    if (tabs[idx]) tabs[idx].classList.add('active');
  }

  if (tab === 'corridas' && _verMotoId) {
    carregarCorridasMotorista(_verMotoId);
  }
};

// ── Histórico de corridas — CORRIGIDO (sem depender de verCorridasLista) ─
window.carregarCorridasMotorista = function (id) {
  var m       = state.motoristas.find(function (x) { return x.id == id; });
  var tabEl   = document.getElementById('verTab-corridas'); // usa o tab diretamente
  if (!m || !tabEl) return;

  var corridasM = state.corridas
    .filter(function (c) { return c.motoristaCodigo === m.codigo && c.status === 'Finalizada'; })
    .slice(0, 50);

  if (!corridasM.length) {
    tabEl.innerHTML = '<div class="empty-state">Sem corridas finalizadas</div>';
    return;
  }

  tabEl.innerHTML = corridasM.map(function (c) {
    return '<div class="ver-corrida-item">' +
      '<div>' +
        '<div><b>#' + c.id + '</b> — ' + (c.cliente || '—') + '</div>' +
        '<div class="ver-corrida-rota">📍 ' + (c.origem || '—') + ' → 🏁 ' + (c.destino || '—') + '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
        '<div style="font-weight:700;color:var(--green)">R$ ' + (c.valorFinal||0).toFixed(2).replace('.',',') + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + (c.criadoEm||'').slice(0,10) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
};

// ── Upload documento ──────────────────────────────────────
window.uploadDoc = async function (input, campo) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('Arquivo muito grande (max 5MB)'); return; }
  showAguarde();
  var reader = new FileReader();
  reader.onload = async function (e) {
    var base64 = e.target.result;
    try {
      var m = state.motoristas.find(function (x) { return x.id == _verMotoId; });
      if (!m) return;
      var payload = {
        nome: m.nome, telefone: m.telefone, moto: m.moto,
        placa: m.placa, cor: m.cor, cidade: m.cidade,
        cpf: m.cpf, cnh: m.cnh, status: m.status,
        foto: m.foto, corridas: m.corridas,
        telefoneFamiliar: m.telefoneFamiliar, nomeFamiliar: m.nomeFamiliar,
        docCnh:      campo === 'docCnh'      ? base64 : (m.docCnh      || ''),
        docVeiculo:  campo === 'docVeiculo'  ? base64 : (m.docVeiculo  || ''),
        docEndereco: campo === 'docEndereco' ? base64 : (m.docEndereco || ''),
        endereco: m.endereco, fotoMoto: m.fotoMoto || ''
      };
      var res = await fetch(API + '/motoristas/' + _verMotoId, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      var updated = await res.json();
      var idx = state.motoristas.findIndex(function (x) { return x.id == _verMotoId; });
      if (idx >= 0) state.motoristas[idx] = Object.assign({}, state.motoristas[idx], updated);
      var previewMap = { docCnh:'verDocCnh', docVeiculo:'verDocVeiculo', docEndereco:'verDocEndereco' };
      renderDocPreview(previewMap[campo], base64);
      showToast('Documento salvo ✅');
    } catch { showToast('Erro ao salvar documento'); }
    hideAguarde();
  };
  reader.readAsDataURL(file);
};

// ── Ações da ficha ────────────────────────────────────────
window.editarMotoristaDaFicha = function () {
  fecharModal('modalVerMotorista');
  setTimeout(function () { if (window.editarMotorista) editarMotorista(_verMotoId); }, 100);
};

window.abrirAcessoDaFicha = function () {
  var m = state.motoristas.find(function (x) { return x.id == _verMotoId; });
  if (!m) return;
  fecharModal('modalVerMotorista');
  setTimeout(function () { if (window.abrirAcesso) abrirAcesso(m.codigo, m.nome); }, 100);
};

window.confirmarExcluirMotorista = async function () {
  var m  = state.motoristas.find(function (x) { return x.id == _verMotoId; });
  if (!m) return;
  var ok = await (window.confirmar
    ? confirmar('Excluir ' + m.nome + '? Esta ação não pode ser desfeita.')
    : Promise.resolve(confirm('Excluir ' + m.nome + '?')));
  if (!ok) return;
  showAguarde();
  try {
    await fetch(API + '/motoristas/' + _verMotoId, { method: 'DELETE' });
    state.motoristas = state.motoristas.filter(function (x) { return x.id != _verMotoId; });
    fecharModal('modalVerMotorista');
    if (window.renderMotoristas) renderMotoristas();
    showToast('Motorista excluído');
  } catch { showToast('Erro'); }
  hideAguarde();
};

// ── Lightbox ──────────────────────────────────────────────
window.abrirImagem = function (src) {
  var img = document.getElementById('lightboxImg');
  if (img) img.src = src;
  document.getElementById('modalLightbox').classList.remove('hidden');
};

// ── renderMotoristas com botão Ver ────────────────────────
window.renderMotoristas = function () {
  var busca = (document.getElementById('buscaMotorista')?.value || '').toLowerCase();
  var lista = state.motoristas.filter(function (m) {
    return !busca || (m.codigo + ' ' + m.nome + ' ' + (m.placa||'') + ' ' + (m.moto||'')).toLowerCase().includes(busca);
  });

  var tbody = document.getElementById('tabelaMotoristas');
  if (!tbody) return;

  tbody.innerHTML = lista.map(function (m) {
    var online = ['Disponivel','Ocupado'].includes(m.status);
    return '<tr>' +
      '<td><b>' + m.codigo + '</b></td>' +
      '<td>' + (m.foto ? '<img src="' + m.foto + '" class="avatar-mini" alt=""/>' : '<span class="avatar-letra">' + (m.nome||'M')[0] + '</span>') + '<b>' + m.nome + '</b></td>' +
      '<td>' + (m.moto||'—') + ' / <b>' + (m.placa||'—') + '</b></td>' +
      '<td>' + badgeStatus(m.status) + '</td>' +
      '<td><span class="dot-status ' + (online?'green':'gray') + '"></span>' + (online?'Online':'Offline') + '</td>' +
      '<td class="td-acoes">' +
        '<button class="btn sm primary" onclick="verMotorista(' + m.id + ')">👁 Ver</button>' +
        '<button class="btn sm" onclick="editarMotorista(' + m.id + ')">✏️</button>' +
        '<button class="btn sm" onclick="abrirAcesso(\'' + m.codigo + '\',\'' + m.nome + '\')">🔑</button>' +
        '<button class="btn sm primary" onclick="liberarPagamento(\'' + m.codigo + '\',\'' + m.nome + '\')">💰</button>' +
      '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="6" class="empty-td">Sem motoristas</td></tr>';
};

})(); // fim IIFE
