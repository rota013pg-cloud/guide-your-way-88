;(function () {
'use strict';
// ═══════════════════════════════════════════════════════════
//  STATUS-CORRIDA.JS — Rota 013 Beta 2.0
//  Modal dedicado de alteração de status da corrida
//  Aparece ao clicar no badge de status ou no botão 🔄
// ═══════════════════════════════════════════════════════════

// ── Injetar modal no DOM ──────────────────────────────────
document.body.insertAdjacentHTML('beforeend', `
<div id="modalStatusCorrida" class="modal hidden" role="dialog">
  <div class="modal-content modal-sm">
    <div class="modal-header">
      <div>
        <h3>Alterar Status da Corrida</h3>
        <small id="mscCorridaInfo" style="color:var(--muted)"></small>
      </div>
      <button class="btn-close" onclick="fecharModal('modalStatusCorrida')">✕</button>
    </div>
    <div class="modal-body" style="padding:16px">
      <div id="mscBotoes" style="display:flex;flex-direction:column;gap:8px"></div>
    </div>
  </div>
</div>
`);

// Estilos dos botões de status
var s = document.createElement('style');
s.textContent = `
  .btn-status-op {
    width: 100%; padding: 14px 18px;
    border: 1.5px solid; border-radius: 14px;
    font-size: 14px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; gap: 10px;
    transition: opacity .15s, transform .1s;
    text-align: left; background: transparent;
  }
  .btn-status-op:active { opacity:.8; transform:scale(.98); }
  .btn-status-op.ativo { color: #fff; border-color: transparent; }
  .btn-status-op:disabled { opacity:.35; cursor:default; }
  .btn-status-op .bso-label { flex:1; }
  .btn-status-op .bso-atual { font-size:10px; color:inherit; opacity:.7; margin-left:auto; }
`;
document.head.appendChild(s);

// Config de cada status
var STATUSES = [
  { valor: 'Nova',       emoji: '🆕', cor: '#1e40af', bg: '#dbeafe', label: 'Nova'        },
  { valor: 'Oferecendo', emoji: '📡', cor: '#9a3412', bg: '#ffedd5', label: 'Oferecendo'  },
  { valor: 'Aceita',     emoji: '✅', cor: '#166534', bg: '#dcfce7', label: 'Aceita'       },
  { valor: 'A caminho',  emoji: '🏍️', cor: '#9a3412', bg: '#ffedd5', label: 'A caminho'   },
  { valor: 'Chegou',     emoji: '📍', cor: '#1e40af', bg: '#dbeafe', label: 'Chegou'      },
  { valor: 'Finalizada', emoji: '🏁', cor: '#374151', bg: '#f3f4f6', label: 'Finalizada'  },
  { valor: 'Cancelada',  emoji: '✕',  cor: '#991b1b', bg: '#fee2e2', label: 'Cancelada'   },
];

var _mscCorridaId = null;

// ── Abrir modal ───────────────────────────────────────────
window.abrirModalStatus = function (corridaId) {
  var c = state.corridas.find(function (x) { return x.id == corridaId; });
  if (!c) return;

  _mscCorridaId = corridaId;
  document.getElementById('mscCorridaInfo').textContent =
    '#' + c.id + ' — ' + (c.cliente || '—') + ' | Atual: ' + (c.status || '—');

  var container = document.getElementById('mscBotoes');
  container.innerHTML = STATUSES.map(function (st) {
    var isAtual = c.status === st.valor;
    return '<button class="btn-status-op' + (isAtual ? ' ativo' : '') + '"' +
      (isAtual ? ' disabled' : ' onclick="aplicarStatusCorrida(\'' + st.valor + '\')"') +
      ' style="' +
        (isAtual
          ? 'background:' + st.bg + ';border-color:' + st.cor + ';color:' + st.cor
          : 'border-color:' + st.cor + ';color:' + st.cor) +
      '">' +
      '<span style="font-size:18px">' + st.emoji + '</span>' +
      '<span class="bso-label">' + st.label + '</span>' +
      (isAtual ? '<span class="bso-atual">← atual</span>' : '') +
    '</button>';
  }).join('');

  document.getElementById('modalStatusCorrida').classList.remove('hidden');
};

// ── Aplicar status ────────────────────────────────────────
window.aplicarStatusCorrida = async function (novoStatus) {
  if (!_mscCorridaId) return;
  fecharModal('modalStatusCorrida');
  showAguarde();

  try {
    var res = await fetch(API + '/corridas/' + _mscCorridaId + '/status', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: novoStatus })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    // Atualizar estado local
    var c = state.corridas.find(function (x) { return x.id == _mscCorridaId; });
    if (c) c.status = novoStatus;

    // Notificar via socket
    if (window.state?.socket?.connected) {
      state.socket.emit('corrida:status_operador', {
        corridaId: _mscCorridaId, status: novoStatus
      });
    }

    renderDashboard();
    renderCorridas();
    showToast('Corrida #' + _mscCorridaId + ' → ' + novoStatus + ' ✅');
  } catch (e) {
    showToast('Erro ao alterar status: ' + e.message);
  }

  hideAguarde();
};

// ── Reescrever renderCorridas com botão 🔄 dedicado ───────
// Aguardar correcoes.js carregar (que também sobrescreve renderCorridas)
// Este arquivo é o ÚLTIMO, então sua versão vence definitivamente
window.addEventListener('load', function () {
  // Override final de renderCorridas — DEFINITIVO
  window.renderCorridas = function () {
    var busca  = (document.getElementById('buscaCorrida')?.value || '').toLowerCase();
    var filtro = document.getElementById('filtroCorrida')?.value || '';
    var lista  = state.corridas.filter(function (c) {
      return (!filtro || c.status === filtro) &&
             (!busca  || (c.id + ' ' + c.cliente + ' ' + c.origem + ' ' + c.destino + ' ' + c.motorista).toLowerCase().includes(busca));
    });

    var tbody = document.getElementById('tabelaCorridas');
    if (!tbody) return;

    var COR = {
      'Nova':'blue','Oferecendo':'orange','Aceita':'green',
      'A caminho':'orange','Chegou':'blue','Finalizada':'gray','Cancelada':'red'
    };

    tbody.innerHTML = lista.map(function (c) {
      var tel    = (c.telefone || '').replace(/\D/g, '');
      var waLink = tel ? 'https://wa.me/55' + tel : null;
      var hora   = (c.criadoEm || '').slice(11, 16);
      var bloq   = ['Finalizada','Cancelada'].includes(c.status);
      var cor    = COR[c.status] || 'gray';

      return '<tr>' +
        '<td><b>#' + c.id + '</b>' + (hora ? '<br><small class="text-muted">' + hora + '</small>' : '') + '</td>' +
        '<td><b>' + (c.cliente || '—') + '</b>' +
          (waLink ? '<br><a href="' + waLink + '" target="_blank" class="link-wa">📱 ' + c.telefone + '</a>'
                  : (c.telefone ? '<br><small class="text-muted">' + c.telefone + '</small>' : '')) +
        '</td>' +
        '<td class="td-end" title="' + (c.origem||'') + '">' + (c.origem||'—') + '</td>' +
        '<td class="td-end" title="' + (c.destino||'') + '">' + (c.destino||'—') + '</td>' +
        '<td><b>R$ ' + (c.valorFinal||0).toFixed(2).replace('.',',') + '</b></td>' +
        '<td>' + (c.motorista || '<span class="text-muted">—</span>') + '</td>' +
        // Status badge clicável + botão de alterar
        '<td style="white-space:nowrap">' +
          '<span class="badge ' + cor + '" style="cursor:pointer" onclick="abrirModalStatus(' + c.id + ')" title="Clique para alterar">' + (c.status||'—') + '</span> ' +
          '<button class="btn sm" style="padding:3px 8px;font-size:11px" onclick="abrirModalStatus(' + c.id + ')" title="Alterar status">🔄</button>' +
        '</td>' +
        '<td class="td-acoes">' +
          (['Nova','Oferecendo'].includes(c.status) ? '<button class="btn sm" title="Reofertarr" onclick="reofertarCorrida(' + c.id + ')">📡</button>' : '') +
          '<button class="btn sm" title="Mensagens" onclick="abrirMensagensCorrida(' + c.id + ')">💬</button>' +
          '<button class="btn sm" title="Editar" onclick="editarCorrida(' + c.id + ')">✏️</button>' +
          (!bloq ? '<button class="btn sm danger" title="Cancelar" onclick="cancelarCorrida(' + c.id + ')">✕</button>' : '') +
        '</td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="8" class="empty-td">Sem corridas</td></tr>';
  };
});

})(); // fim IIFE
