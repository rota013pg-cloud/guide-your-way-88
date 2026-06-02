;(function () {
'use strict';
// ═══════════════════════════════════════════════════════
//  FINANCEIRO-BETA.JS — Rota 013 Beta 2.0
//  Override do financeiro.js para integrar com app motorista:
//  - hideAguarde() sempre chamado (estava faltando)
//  - Notifica motorista via push/liberar ao marcar pago
//  - Idempotência: nunca duplica diária no mesmo dia
//  - Carrega dados do servidor após qualquer alteração
// ═══════════════════════════════════════════════════════

// ── Início do dia operacional (6h Brasília = UTC-3) ──
function _opDayStart() {
  // Retorna o timestamp do início do dia operacional atual
  const now  = new Date();
  const utc  = now.getTime() + now.getTimezoneOffset() * 60000;
  const brt  = new Date(utc - 3 * 60 * 60 * 1000);
  // Início do dia operacional = hoje 6h BRT (ou ontem 6h se agora < 6h)
  const base = new Date(brt);
  if (brt.getHours() < 6) base.setDate(base.getDate() - 1);
  base.setHours(6, 0, 0, 0);
  return base; // Date object em BRT
}

function _diaOpFin() {
  const base = _opDayStart();
  return base.toLocaleDateString('sv'); // YYYY-MM-DD do início do dia op
}

// ── Verificar se motorista já tem diária no dia operacional ──
function _jaTemDiaria(codigo) {
  const start = _opDayStart().getTime();
  const end   = start + 24 * 60 * 60 * 1000;
  return (state.financeiro || []).some(f => {
    if ((f.motoristaCodigo || f.motorista_codigo) !== codigo) return false;
    if (f.tipo !== 'Diária') return false;
    // Converter data do registro para timestamp
    const ds   = (f.data || '').replace(' ', 'T');
    const dt   = ds ? new Date(ds + (ds.includes('+') || ds.includes('Z') ? '' : '-03:00')).getTime() : 0;
    return dt >= start && dt < end;
  });
}

// ── marcarDiaria — versão beta com notificação ao motorista ──
window.marcarDiaria = async function(codigo) {
  const m = (state.motoristas || []).find(x => x.codigo === codigo);
  if (!m) { showToast('Motorista não encontrado'); return; }

  // Verificar idempotência ANTES de mostrar aguarde
  if (_jaTemDiaria(codigo)) {
    showToast(`${m.nome} já tem diária registrada hoje ✅`);
    return;
  }

  showAguarde();
  try {
    // 1. Registrar diária no financeiro
    const diaria = Number(
      state.config?.valorDiaria ||
      document.getElementById('cfgDiaria')?.value || 20
    );
    const body = {
      motoristaCodigo: m.codigo,
      motorista:       m.nome,
      valor:           diaria,
      tipo:            'Diária',
      operador:        state.currentUser?.nome || 'Beta'
    };

    const r    = await apiPost('/financeiro', body);
    if (!state.financeiro) state.financeiro = [];
    state.financeiro.unshift(r);

    // 2. Notificar motorista via socket (liberar app)
    try {
      const resp = await fetch(`${API_BASE}/push/liberar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo: m.codigo })
      });
      const data = await resp.json();
      if (!data.socketEnviado) {
        showToast(`✅ Diária de ${m.nome} registrada — app offline, será liberado ao reconectar`);
      } else {
        showToast(`✅ ${m.nome} liberado — diária de ${moeda(diaria)} registrada`);
      }
    } catch {
      showToast(`✅ Diária de ${m.nome} registrada (sem conexão com app)`);
    }

    if (typeof addLog === 'function') {
      addLog(`Diária: ${m.codigo} - ${m.nome} (${moeda(diaria)})`);
    }

    renderFinanceiro();
    renderDashboard();

  } catch (e) {
    // Fallback local se API falhar
    const diaria = Number(state.config?.valorDiaria || 20);
    if (!state.financeiro) state.financeiro = [];
    state.financeiro.unshift({
      motoristaCodigo: m.codigo,
      motorista:       m.nome,
      valor:           diaria,
      tipo:            'Diária',
      operador:        state.currentUser?.nome || 'Beta',
      data:            new Date().toISOString().replace('T', ' ').slice(0, 19),
      id:              Date.now()
    });
    showToast(`Diária registrada localmente ⚠️ (${e.message})`);
    renderFinanceiro();
    renderDashboard();
  } finally {
    // SEMPRE chamar hideAguarde — era esse o bug do modal travado
    hideAguarde();
  }
};

// ── liberarPagamento — chamado pelos alertas de socket ─
// (quando motorista clica "Já enviei" no app)
window.liberarPagamento = async function(codigo, nome) {
  const m = (state.motoristas || []).find(x => x.codigo === codigo);
  const nomeReal = nome || m?.nome || codigo;

  showAguarde();
  try {
    const resp = await fetch(`${API_BASE}/push/liberar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ codigo })
    });
    const data = await resp.json();

    if (!resp.ok) {
      showToast('Erro ao liberar: ' + (data.erro || 'Tente novamente'));
      return;
    }

    const msg = data.jaExistia
      ? `✅ ${nomeReal} liberado! (diária já estava registrada)`
      : `✅ ${nomeReal} liberado! Diária registrada.`;
    showToast(msg + (data.socketEnviado ? '' : ' ⚠️ App offline.'), 5000);

    // Remover alerta do painel
    document.querySelectorAll(`[data-codigo="${codigo}"]`).forEach(el => el.remove());

    // Recarregar financeiro
    try {
      const fin = await apiGet('/financeiro');
      state.financeiro = fin;
    } catch {}
    renderFinanceiro();
    renderDashboard();

  } catch (e) {
    showToast('Erro: ' + e.message);
  } finally {
    hideAguarde();
  }
};

// ── renderFinanceiro — versão beta com dia operacional correto ──
window.renderFinanceiro = function() {
  const hoje   = _diaOpFin();
  const diaria = Number(state.config?.valorDiaria || 20);
  const fin    = state.financeiro || [];

  // Filtrar pelo intervalo do dia operacional (6h a 6h), não só pela data
  const _start = _opDayStart().getTime();
  const _end   = _start + 24 * 60 * 60 * 1000;
  const pagamentos = fin.filter(f => {
    if (f.tipo !== 'Diária') return false;
    const ds = (f.data || '').replace(' ', 'T');
    const dt = ds ? new Date(ds + (ds.includes('+') || ds.includes('Z') ? '' : '-03:00')).getTime() : 0;
    return dt >= _start && dt < _end;
  });
  const pagosHoje  = new Set(pagamentos.map(f => f.motoristaCodigo || f.motorista_codigo));
  const totalHoje  = pagamentos.reduce((s, f) => s + Number(f.valor || 0), 0);

  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  sv('finPagas',       pagosHoje.size);
  sv('finPendentes',   Math.max(0, (state.motoristas || []).length - pagosHoje.size));
  sv('finTotal',       moeda(totalHoje));
  sv('finValorDiaria', moeda(diaria));

  const tbody = document.getElementById('tabelaFinanceiro');
  if (!tbody) return;

  tbody.innerHTML = (state.motoristas || []).map(m => {
    const pago = pagosHoje.has(m.codigo);
    const pgmt = pagamentos.find(f =>
      (f.motoristaCodigo || f.motorista_codigo) === m.codigo
    );
    const on   = ['Disponivel','Online','Ocupado'].includes(m.status);

    return `<tr>
      <td>${m.codigo}</td>
      <td>
        <b>${m.nome}</b><br>
        <small style="color:var(--muted)">${typeof mascaraTelefone === 'function' ? mascaraTelefone(m.telefone||'') : (m.telefone||'')}</small>
      </td>
      <td><span class="dot ${on?'green':'gray'}"></span> ${m.status}</td>
      <td>${pago
        ? '<span class="badge green">✅ Paga</span>'
        : '<span class="badge gray">Pendente</span>'}</td>
      <td>
        ${pago
          ? `<span style="color:var(--muted);font-size:12px">
               ${moeda(pgmt?.valor || diaria)} — ${pgmt?.operador || ''}
             </span>`
          : `<button class="btn primary" onclick="marcarDiaria('${m.codigo}')">
               💰 Marcar Pago
             </button>`}
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Sem motoristas</td></tr>';

  // Atualizar campos de data do relatório com hoje se vazio
  const elDe  = document.getElementById('relDe');
  const elAte = document.getElementById('relAte');
  if (elDe  && !elDe.value)  elDe.value  = hoje;
  if (elAte && !elAte.value) elAte.value = hoje;
};

})(); // fim IIFE
