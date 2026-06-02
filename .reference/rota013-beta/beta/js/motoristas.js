// ═══════════════════════════════════════════════════════
//  MOTORISTAS.JS — V8: documentos PDF + Waze
// ═══════════════════════════════════════════════════════

// Armazenamento temporário de docs durante edição
if (!state.tempDocs) state.tempDocs = { cnh: '', veiculo: '', endereco: '' };

function renderMotoristas() {
  const busca = (document.getElementById('buscaMotorista')?.value || '').toLowerCase();
  const lista = (state.motoristas||[]).filter(m =>
    `${m.codigo} ${m.nome} ${m.telefone} ${m.placa} ${m.moto}`.toLowerCase().includes(busca)
  );
  const grid = document.getElementById('gridMotoristas');
  if (!grid) return;
  grid.innerHTML = lista.map(m => `
    <div class="driver-card">
      ${m.foto
        ? `<div class="driver-photo" style="background-image:url('${m.foto}')"></div>`
        : `<div class="driver-photo">${iniciais(m.nome)}</div>`}
      <h4>${m.codigo} — ${m.nome}</h4>
      <p>${mascaraTelefone(m.telefone||'')} ${badge(m.status)}</p>
      <p style="font-size:12px">${m.moto||'-'} • ${m.placa||'-'}</p>
      <div class="driver-actions">
        <button class="btn" onclick="verMotorista('${m.codigo}')">👁 Ver</button>
        <button class="btn" onclick="editarMotorista('${m.codigo}')">✏️ Editar</button>
        <button class="btn whatsapp" onclick="abrirWhats('${m.telefone}','Olá ${(m.nome||'').replace(/'/g,'')}!')">📲</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted);padding:20px">Nenhum motorista cadastrado.</p>';
}

// ─── Visualizar motorista (somente leitura) ───────────
function verMotorista(cod) {
  const m = (state.motoristas||[]).find(x => x.codigo === cod);
  if (!m) return;

  const corridas = (state.corridas||[]).filter(c => c.motoristaCodigo === m.codigo);
  const diarias  = (state.financeiro||[]).filter(f => (f.motoristaCodigo||f.motorista_codigo) === m.codigo);
  const totalDiarias = diarias.reduce((s,f) => s + Number(f.valor||0), 0);

  document.getElementById('viewMotNome').textContent   = m.nome   || '-';
  document.getElementById('viewMotCodigo').textContent = m.codigo || '-';
  document.getElementById('viewMotStatus').innerHTML   = badge(m.status);
  document.getElementById('viewMotTel').textContent    = mascaraTelefone(m.telefone||'');
  document.getElementById('viewMotTelFam').textContent = mascaraTelefone(m.telefoneFamiliar||'') || '-';
  const nomeFamEl = document.getElementById('viewMotNomeFam');
  if (nomeFamEl) nomeFamEl.textContent = m.nomeFamiliar || '-';

  // Status do cadastro (inclui docs)
  const campos = [
    ['Nome', m.nome], ['Telefone', m.telefone], ['Moto', m.moto],
    ['Placa', m.placa], ['CPF', m.cpf], ['CNH', m.cnh],
    ['Cidade', m.cidade], ['Foto', m.foto],
    ['Tel. Familiar', m.telefoneFamiliar], ['Nome Familiar', m.nomeFamiliar],
    ['Doc. CNH', m.doc_cnh], ['Doc. Moto', m.doc_veiculo], ['Comp. Endereço', m.doc_endereco]
  ];
  const faltando = campos.filter(([,v]) => !v).map(([k]) => k);
  const statusEl = document.getElementById('viewMotStatusCadastro');
  if (statusEl) {
    if (faltando.length === 0) {
      statusEl.style.cssText = 'background:#d1fae5;border:1px solid #34d399;color:#065f46;margin:16px 0;padding:12px 16px;border-radius:10px;font-size:13px;';
      statusEl.innerHTML = '✅ <strong>Cadastro completo</strong> — todos os dados e documentos preenchidos.';
    } else {
      statusEl.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;color:#92400e;margin:16px 0;padding:12px 16px;border-radius:10px;font-size:13px;';
      statusEl.innerHTML = `⚠️ <strong>Cadastro incompleto</strong> — faltando: ${faltando.join(', ')}.`;
    }
  }
  document.getElementById('viewMotMoto').textContent   = `${m.moto||'-'} • ${m.cor||''} • ${m.placa||'-'}`;
  document.getElementById('viewMotCpf').textContent    = mascaraCpf(m.cpf||'') || '-';
  document.getElementById('viewMotCnh').textContent    = m.cnh    || '-';
  document.getElementById('viewMotCidade').textContent = m.cidade || '-';

  // Endereço
  const endEl = document.getElementById('viewMotEndereco');
  if (endEl) endEl.textContent = m.endereco || '-';

  // Foto da moto
  const fotoMotoEl = document.getElementById('viewMotFotoMoto');
  if (fotoMotoEl) {
    if (m.fotoMoto || m.foto_moto) {
      fotoMotoEl.style.backgroundImage = `url('${m.fotoMoto||m.foto_moto}')`;
      fotoMotoEl.style.display = 'block';
      fotoMotoEl.textContent = '';
    } else {
      fotoMotoEl.style.display = 'none';
    }
  }
  document.getElementById('viewMotCorridas').textContent = corridas.length;
  document.getElementById('viewMotDiarias').textContent  = `${diarias.length}x — Total: ${moeda(totalDiarias)}`;

  const fotoEl = document.getElementById('viewMotFoto');
  if (fotoEl) {
    if (m.foto) {
      fotoEl.style.backgroundImage = `url('${m.foto}')`;
      fotoEl.textContent = '';
    } else {
      fotoEl.style.backgroundImage = '';
      fotoEl.textContent = iniciais(m.nome);
    }
  }

  // Últimas corridas
  const tbody = document.getElementById('viewMotCorridasList');
  if (tbody) {
    tbody.innerHTML = corridas.slice(0,5).map(c =>
      `<tr><td>#${c.id}</td><td>${c.origem}</td><td>${c.destino}</td><td>${moeda(c.valorFinal)}</td><td>${badge(c.status)}</td></tr>`
    ).join('') || '<tr><td colspan="5" style="color:var(--muted)">Sem corridas</td></tr>';
  }

  // ─── Seção de documentos ──────────────────────────
  const docsEl = document.getElementById('viewMotDocumentos');
  if (docsEl) {
    const docs = [
      { label: '📋 CNH',                key: 'doc_cnh',      data: m.doc_cnh },
      { label: '🏍️ Doc. Moto',          key: 'doc_veiculo',  data: m.doc_veiculo },
      { label: '🏠 Comp. Endereço',     key: 'doc_endereco', data: m.doc_endereco },
    ];
    docsEl.innerHTML = docs.map(d => {
      if (d.data) {
        return `<button class="btn" style="margin:4px" onclick="abrirDocumento('${d.key}','${m.codigo}')">${d.label} ✅ Ver</button>`;
      }
      return `<button class="btn" style="margin:4px;opacity:0.4;cursor:default" disabled>${d.label} — não enviado</button>`;
    }).join('');
  }

  openModal('modalVerMotorista');
}

// ─── Abrir documento em nova janela ──────────────────
function abrirDocumento(campo, cod) {
  const m = (state.motoristas||[]).find(x => x.codigo === cod);
  if (!m || !m[campo]) { showToast('Documento não disponível.'); return; }
  const data = m[campo];
  const mime = data.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
  // Extrair base64 puro
  const b64 = data.includes(',') ? data.split(',')[1] : data;
  try {
    const bytes = atob(b64);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch {
    // Fallback: data URL direta
    window.open(data, '_blank');
  }
}

// ─── Novo motorista ───────────────────────────────────
function novoMotorista() {
  _limparModalMotorista();
  document.getElementById('tituloModalMotorista').textContent = 'Novo Motorista';
  document.getElementById('motoristaCodigo').value = gerarCodigoMotorista();
  openModal('modalMotorista');
}

// ─── Editar motorista ─────────────────────────────────
function editarMotorista(cod) {
  const m = (state.motoristas||[]).find(x => x.codigo === cod);
  if (!m) { showToast('Motorista não encontrado.'); return; }

  _limparModalMotorista();
  document.getElementById('tituloModalMotorista').textContent = 'Editar Motorista';

  const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val||''; };
  sv('motoristaEditCodigo',    m.codigo);
  sv('motoristaCodigo',        m.codigo);
  sv('motoristaNome',          m.nome||'');
  sv('motoristaWhats',         mascaraTelefone(m.telefone||''));
  sv('motoristaTelFamiliar',   mascaraTelefone(m.telefoneFamiliar||''));
  sv('motoristaNomeFamiliar',  m.nomeFamiliar||'');
  sv('motoristaPlaca',         m.placa||'');
  sv('motoristaMoto',          m.moto||'');
  sv('motoristaCor',           m.cor||'');
  sv('motoristaCidade',        m.cidade||'');
  sv('motoristaCpf',           mascaraCpf(m.cpf||''));
  sv('motoristaCnh',           m.cnh||'');
  sv('motoristaEndereco',      m.endereco||'');

  const sel = document.getElementById('motoristaStatus');
  if (sel) sel.value = m.status||'Pendente';

  // Carregar docs existentes no estado temporário
  state.tempDocs = {
    cnh:      m.doc_cnh     || '',
    veiculo:  m.doc_veiculo || '',
    endereco: m.doc_endereco|| ''
  };
  _atualizarStatusDocs();

  // Histórico de corridas no modal
  const hist = document.getElementById('historicoMotoristaModal');
  if (hist) {
    const corridasDoMot = (state.corridas||[]).filter(c => c.motoristaCodigo === m.codigo);
    hist.innerHTML = corridasDoMot.length
      ? corridasDoMot.slice(0,5).map(c =>
          `<li>#${c.id} — ${c.origem} → ${c.destino} (${moeda(c.valorFinal)})</li>`
        ).join('')
      : '<li style="color:var(--muted)">Nenhuma corrida</li>';
  }

  const prev = document.getElementById('previewMotoristaFoto');
  if (prev) {
    if (m.foto) { prev.style.backgroundImage = `url('${m.foto}')`; prev.textContent = ''; }
    else { prev.style.backgroundImage = ''; prev.textContent = iniciais(m.nome); }
  }

  openModal('modalMotorista');
}

function _limparModalMotorista() {
  ['motoristaEditCodigo','motoristaCodigo','motoristaNome','motoristaWhats',
   'motoristaTelFamiliar','motoristaNomeFamiliar','motoristaPlaca','motoristaMoto',
   'motoristaCor','motoristaCidade','motoristaCpf','motoristaCnh','motoristaEndereco'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const sel = document.getElementById('motoristaStatus');
  if (sel) sel.value = 'Pendente';
  const hist = document.getElementById('historicoMotoristaModal');
  if (hist) hist.innerHTML = '<li style="color:var(--muted)">Nenhuma corrida</li>';
  const prev = document.getElementById('previewMotoristaFoto');
  if (prev) { prev.style.backgroundImage = ''; prev.textContent = 'FT'; }
  state.tempFoto = '';
  state.tempDocs = { cnh: '', veiculo: '', endereco: '', fotoMoto: '' };
  _atualizarStatusDocs();
}

// ─── Preview foto motorista ───────────────────────────
function previewFotoMotorista(ev) {
  const file = ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.tempFoto = e.target.result;
    const prev = document.getElementById('previewMotoristaFoto');
    if (prev) { prev.style.backgroundImage = `url('${state.tempFoto}')`; prev.textContent = ''; }
  };
  reader.readAsDataURL(file);
}

// ─── Upload de documento (CNH, Moto, Endereço) ────────
function uploadDocMotorista(ev, tipo) {
  const file = ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.tempDocs[tipo] = e.target.result;
    _atualizarStatusDocs();
    showToast('Documento carregado ✅');
  };
  reader.readAsDataURL(file);
}

// Atualiza badges de status dos docs no modal de edição
function _atualizarStatusDocs() {
  const mapa = {
    cnh:      'statusDocCnh',
    veiculo:  'statusDocVeiculo',
    endereco: 'statusDocEndereco',
    fotoMoto: 'statusFotoMoto'
  };
  Object.entries(mapa).forEach(([tipo, elId]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (state.tempDocs[tipo]) {
      el.textContent = '✅ Carregado';
      el.style.color = 'var(--green, #22c55e)';
    } else {
      el.textContent = '— não enviado';
      el.style.color = 'var(--muted)';
    }
  });
}

// ─── Salvar motorista ─────────────────────────────────
async function salvarMotorista() {
  const editCod = (document.getElementById('motoristaEditCodigo')?.value||'').trim();
  const dados = {
    codigo:           editCod || gerarCodigoMotorista(),
    nome:             capitalizarNome((document.getElementById('motoristaNome')?.value||'').trim()),
    telefone:         (document.getElementById('motoristaWhats')?.value||'').replace(/\D/g,''),
    telefoneFamiliar: (document.getElementById('motoristaTelFamiliar')?.value||'').replace(/\D/g,''),
    nomeFamiliar:     capitalizarNome((document.getElementById('motoristaNomeFamiliar')?.value||'').trim()),
    placa:            (document.getElementById('motoristaPlaca')?.value||'').toUpperCase().replace(/[^A-Z0-9]/g,''),
    moto:             (document.getElementById('motoristaMoto')?.value||'').trim(),
    cor:              (document.getElementById('motoristaCor')?.value||'').trim(),
    cidade:           (document.getElementById('motoristaCidade')?.value||'').trim(),
    cpf:              (document.getElementById('motoristaCpf')?.value||'').replace(/\D/g,''),
    cnh:              (document.getElementById('motoristaCnh')?.value||'').trim(),
    status:           document.getElementById('motoristaStatus')?.value||'Pendente',
    foto:             state.tempFoto||'',
    docCnh:           state.tempDocs.cnh     || '',
    docVeiculo:       state.tempDocs.veiculo  || '',
    docEndereco:      state.tempDocs.endereco || '',
    endereco:         (document.getElementById('motoristaEndereco')?.value||'').trim(),
    fotoMoto:         state.tempDocs.fotoMoto  || ''
  };

  if (!dados.nome)     { showToast('Informe o nome.');     return; }
  if (!dados.telefone) { showToast('Informe o WhatsApp.'); return; }
  showAguarde();

  if (editCod) {
    const idx = state.motoristas.findIndex(m => m.codigo === editCod);
    if (idx >= 0) {
      const fotoFinal     = state.tempFoto          || state.motoristas[idx].foto        || '';
      const docCnhFinal   = state.tempDocs.cnh      || state.motoristas[idx].doc_cnh     || '';
      const docVeicFinal  = state.tempDocs.veiculo  || state.motoristas[idx].doc_veiculo || '';
      const docEndrFinal  = state.tempDocs.endereco || state.motoristas[idx].doc_endereco|| '';
      const fotoMotoFinal = state.tempDocs.fotoMoto || state.motoristas[idx].fotoMoto    || '';
      const atualizado    = { ...dados, foto: fotoFinal, docCnh: docCnhFinal, docVeiculo: docVeicFinal, docEndereco: docEndrFinal, fotoMoto: fotoMotoFinal };
      state.motoristas[idx] = { ...state.motoristas[idx], ...atualizado,
        doc_cnh: docCnhFinal, doc_veiculo: docVeicFinal, doc_endereco: docEndrFinal };
      try { await apiPut(`/motoristas/${state.motoristas[idx].id}`, atualizado); } catch {}
    }
    showToast('Motorista atualizado ✅');
  } else {
    try { await salvarMotoristaAPI(dados); showToast('Motorista cadastrado ✅'); }
    catch { state.motoristas.push({ ...dados, id: nextId(state.motoristas) }); showToast('Salvo localmente ⚠️'); }
  }

  hideAguarde();
  closeModal('modalMotorista');
  state.tempFoto = '';
  state.tempDocs = { cnh: '', veiculo: '', endereco: '', fotoMoto: '' };
  addLog(`Motorista ${editCod?'editado':'cadastrado'}: ${dados.codigo}`);
  renderAll();
}

function gerarCodigoMotorista() {
  const nums = (state.motoristas||[]).map(m => parseInt((m.codigo||'M0100').replace('M',''))||0);
  return 'M' + String(Math.max(...nums, 100) + 1).padStart(4,'0');
}

function iniciais(n) {
  return String(n||'R0').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
}

// ─── Gerar PDF com todos os motoristas ───────────────
function gerarFichaMotoristasPDF() {
  const empresa = state.config?.empresa || 'Rota 013';
  const agora   = new Date().toLocaleString('pt-BR');
  const lista   = state.motoristas || [];

  const linhas = lista.map(m => `
    <tr>
      <td>${m.codigo}</td>
      <td>${m.nome}</td>
      <td>${mascaraTelefone(m.telefone||'')}</td>
      <td>${mascaraTelefone(m.telefoneFamiliar||'')||'-'} (${m.nomeFamiliar||'-'})</td>
      <td>${m.moto||'-'} — ${m.placa||'-'}</td>
      <td>${mascaraCpf(m.cpf||'')||'-'}</td>
      <td>${m.cnh||'-'}</td>
      <td>${m.cidade||'-'}</td>
      <td>${m.status}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Motoristas — ${empresa}</title>
  <style>
    body { font-family: Arial; font-size: 11px; margin: 20px; }
    h1 { font-size: 16px; } .sub { color: #666; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f7c600; padding: 6px; text-align: left; font-size: 10px; }
    td { padding: 5px 6px; border-bottom: 1px solid #eee; font-size: 11px; }
    @media print { button { display:none; } }
  </style></head><body>
  <h1>🏍️ Cadastro de Motoristas — ${empresa}</h1>
  <div class="sub">Gerado em: ${agora} | Total: ${lista.length} motoristas</div>
  <table><thead><tr>
    <th>Código</th><th>Nome</th><th>WhatsApp</th><th>Familiar</th>
    <th>Moto/Placa</th><th>CPF</th><th>CNH</th><th>Cidade</th><th>Status</th>
  </tr></thead><tbody>${linhas}</tbody></table>
  <br><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─── Gerar PDF com todos os clientes ─────────────────
function gerarFichaClientesPDF() {
  const empresa = state.config?.empresa || 'Rota 013';
  const agora   = new Date().toLocaleString('pt-BR');
  const lista   = state.clientes || [];

  const linhas = lista.map(c => `
    <tr>
      <td>${c.codigo}</td>
      <td>${c.nome}</td>
      <td>${mascaraTelefone(c.telefone||'')}</td>
      <td>${c.cidade||'-'}</td>
      <td>${c.corridas||0}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Clientes — ${empresa}</title>
  <style>
    body { font-family: Arial; font-size: 12px; margin: 20px; }
    h1 { font-size: 16px; } .sub { color: #666; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f7c600; padding: 7px; text-align: left; }
    td { padding: 6px 7px; border-bottom: 1px solid #eee; }
    @media print { button { display:none; } }
  </style></head><body>
  <h1>👤 Cadastro de Clientes — ${empresa}</h1>
  <div class="sub">Gerado em: ${agora} | Total: ${lista.length} clientes</div>
  <table><thead><tr>
    <th>Código</th><th>Nome</th><th>WhatsApp</th><th>Cidade</th><th>Corridas</th>
  </tr></thead><tbody>${linhas}</tbody></table>
  <br><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
