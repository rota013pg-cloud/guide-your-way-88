// ═══════════════════════════════════════════════════════
//  FINANCEIRO.JS — V7: relatório com período e PDF
// ═══════════════════════════════════════════════════════

function renderFinanceiro() {
  const diaria     = Number(state.config?.valorDiaria || document.getElementById('cfgDiaria')?.value || 20);
  // Dia operacional: começa às 6h de Brasília (UTC-3)
  // Se for antes das 6h, ainda é o "dia anterior" operacional
  const _agora     = new Date();
  const _brasiliaOffset = -3 * 60; // UTC-3 em minutos
  const _localOffset   = _agora.getTimezoneOffset(); // offset do browser em minutos
  const _diff = _brasiliaOffset - (-_localOffset); // ajuste extra se browser não for Brasília
  const _brasilia = new Date(_agora.getTime() + _diff * 60000);
  if (_brasilia.getHours() < 6) _brasilia.setDate(_brasilia.getDate() - 1);
  const hoje = _brasilia.toLocaleDateString('sv');
  const fin        = state.financeiro || [];
  const pagamentos = fin.filter(f => f.data?.startsWith(hoje) && f.tipo==='Diária');
  const pagosHoje  = new Set(pagamentos.map(f => f.motoristaCodigo||f.motorista_codigo));
  const totalArrecadado = pagamentos.reduce((s,f) => s+Number(f.valor||0), 0);

  const el = id => document.getElementById(id);
  if (el('finPagas'))       el('finPagas').textContent       = pagosHoje.size;
  if (el('finPendentes'))   el('finPendentes').textContent   = (state.motoristas||[]).length - pagosHoje.size;
  if (el('finTotal'))       el('finTotal').textContent       = moeda(totalArrecadado);
  if (el('finValorDiaria')) el('finValorDiaria').textContent = moeda(diaria);

  const tbody = document.getElementById('tabelaFinanceiro');
  if (!tbody) return;
  tbody.innerHTML = (state.motoristas||[]).map(m => {
    const pago  = pagosHoje.has(m.codigo);
    const pgmt  = pagamentos.find(f => (f.motoristaCodigo||f.motorista_codigo)===m.codigo);
    return `<tr>
      <td>${m.codigo}</td>
      <td>${m.nome}<br><small>${mascaraTelefone(m.telefone||'')}</small></td>
      <td>${badge(m.status)}</td>
      <td>${pago ? badge('Paga') : badge('Pendente')}</td>
      <td>${pago
        ? `<span style="color:var(--muted);font-size:12px">✅ ${moeda(pgmt?.valor||diaria)} — ${pgmt?.operador||''}</span>`
        : `<button class="btn primary" onclick="marcarDiaria('${m.codigo}')">Marcar Pago</button>`}
      </td>
    </tr>`;
  }).join('');

  // Atualizar campos da busca com data de hoje se vazia
  const elDe = document.getElementById('relDe');
  const elAte = document.getElementById('relAte');
  if (elDe && !elDe.value) elDe.value = hoje;
  if (elAte && !elAte.value) elAte.value = hoje;
}

async function marcarDiaria(codigo) {
  showAguarde();
  const m = (state.motoristas||[]).find(x => x.codigo===codigo);
  if (!m) return;
  const diaria = Number(state.config?.valorDiaria || document.getElementById('cfgDiaria')?.value || 20);
  // Dia operacional começa às 6h de Brasília
  const _agora2 = new Date();
  const _br2 = new Date(_agora2.getTime() + ((-3 * 60) - (-_agora2.getTimezoneOffset())) * 60000);
  if (_br2.getHours() < 6) _br2.setDate(_br2.getDate() - 1);
  const hoje = _br2.toLocaleDateString('sv');

  if ((state.financeiro||[]).some(f =>
    (f.motoristaCodigo||f.motorista_codigo)===codigo &&
    f.data?.startsWith(hoje) && f.tipo==='Diária'
  )) { showToast(`${m.nome} já pagou hoje.`); return; }

  const reg = { motoristaCodigo:m.codigo, motorista:m.nome, valor:diaria, tipo:'Diária', operador:state.currentUser?.nome||'' };
  try {
    const salvo = await apiPost('/financeiro', reg);
    if (!state.financeiro) state.financeiro=[];
    state.financeiro.unshift(salvo);
    showToast(`Diária de ${m.nome}: ${moeda(diaria)} ✅`);
  } catch {
    if (!state.financeiro) state.financeiro=[];
    state.financeiro.unshift({...reg, id:Date.now(), data:new Date().toLocaleDateString('sv') + ' ' + new Date().toLocaleTimeString('pt-BR')});
    showToast('Diária registrada localmente ⚠️');
  }
  addLog(`Diária: ${m.codigo} - ${m.nome} (${moeda(diaria)})`);
  renderFinanceiro();
  renderDashboard();
}

// ─── Relatório por período ────────────────────────────
function buscarRelatorio() {
  const de   = document.getElementById('relDe')?.value;
  const ate  = document.getElementById('relAte')?.value;
  const tipo = document.getElementById('relTipo')?.value || '';
  const mot  = (document.getElementById('relMotorista')?.value||'').trim().toLowerCase();
  const fin  = state.financeiro || [];

  let lista = fin.filter(f => {
    const data = (f.data||'').slice(0,10);
    const okDe  = !de  || data >= de;
    const okAte = !ate || data <= ate;
    const okTipo = !tipo || f.tipo === tipo;
    const okMot  = !mot  || (f.motorista||'').toLowerCase().includes(mot) ||
                             (f.motoristaCodigo||f.motorista_codigo||'').toLowerCase().includes(mot);
    return okDe && okAte && okTipo && okMot;
  }).sort((a,b) => (b.data||'') > (a.data||'') ? 1 : -1);

  const total = lista.reduce((s,f) => s+Number(f.valor||0), 0);

  const tbody = document.getElementById('tabelaRelatorio');
  if (tbody) {
    tbody.innerHTML = lista.map(f => `
      <tr>
        <td>${(f.data||'').slice(0,16).replace('T',' ')}</td>
        <td>${f.motoristaCodigo||f.motorista_codigo||'-'}</td>
        <td>${f.motorista||'-'}</td>
        <td>${f.tipo||'Diária'}</td>
        <td><b>${moeda(f.valor)}</b></td>
        <td>${f.operador||'-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Nenhum registro</td></tr>';
  }

  const totalEl = document.getElementById('relTotal');
  if (totalEl) totalEl.textContent = `${lista.length} registros — Total: ${moeda(total)}`;

  // Guardar para PDF
  window._relatorioAtual = { lista, de, ate, total };
}

function atalhoRelatorio(periodo) {
  const _agoraR = new Date();
  const _brR = new Date(_agoraR.getTime() + ((-3*60)-(-_agoraR.getTimezoneOffset()))*60000);
  if (_brR.getHours() < 6) _brR.setDate(_brR.getDate()-1);
  const hoje = _brR;
  const elDe   = document.getElementById('relDe');
  const elAte  = document.getElementById('relAte');
  if (!elDe || !elAte) return;

  const fmt = d => d.toLocaleDateString('sv');
  if (periodo === 'hoje') {
    elDe.value = fmt(hoje); elAte.value = fmt(hoje);
  } else if (periodo === 'semana') {
    const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - hoje.getDay());
    elDe.value = fmt(inicio); elAte.value = fmt(hoje);
  } else if (periodo === 'mes') {
    elDe.value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
    elAte.value = fmt(hoje);
  } else if (periodo === '7dias') {
    const inicio = new Date(hoje); inicio.setDate(hoje.getDate()-6);
    elDe.value = fmt(inicio); elAte.value = fmt(hoje);
  } else if (periodo === '30dias') {
    const inicio = new Date(hoje); inicio.setDate(hoje.getDate()-29);
    elDe.value = fmt(inicio); elAte.value = fmt(hoje);
  }
  buscarRelatorio();
}

// ─── Exportar PDF do relatório ────────────────────────
function exportarRelatorioPDF() {
  const rel = window._relatorioAtual;
  if (!rel?.lista?.length) { showToast('Nenhum dado para exportar.'); return; }

  const empresa = state.config?.empresa || 'Rota 013';
  const agora   = new Date().toLocaleString('pt-BR');

  const linhas  = rel.lista.map(f => `
    <tr>
      <td>${(f.data||'').slice(0,16).replace('T',' ')}</td>
      <td>${f.motoristaCodigo||f.motorista_codigo||'-'}</td>
      <td>${f.motorista||'-'}</td>
      <td>${f.tipo||'Diária'}</td>
      <td><b>${moeda(f.valor)}</b></td>
      <td>${f.operador||'-'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Relatório Financeiro — ${empresa}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 30px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f7c600; padding: 8px; text-align: left; font-size: 12px; }
    td { padding: 7px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) td { background: #fafafa; }
    .total { margin-top: 16px; font-weight: bold; font-size: 14px; text-align: right; }
    @media print { button { display: none; } }
  </style></head><body>
  <h1>📊 Relatório Financeiro — ${empresa}</h1>
  <div class="sub">Período: ${rel.de||'-'} a ${rel.ate||'-'} | Gerado em: ${agora} | Operador: ${state.currentUser?.nome||'-'}</div>
  <table>
    <thead><tr><th>Data/Hora</th><th>Código</th><th>Motorista</th><th>Tipo</th><th>Valor</th><th>Operador</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>
  <div class="total">Total: ${moeda(rel.total)} (${rel.lista.length} registros)</div>
  <br><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
