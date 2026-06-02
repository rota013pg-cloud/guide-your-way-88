;(function () {
'use strict';
// ═══════════════════════════════════════════════════════════
//  DIARIA-PAINEL.JS — Rota 013 Beta 2.0
//  Corrige TODO o fluxo de diária no painel do operador:
//  - liberarPagamento: sem duplo registro, sem duplo clique
//  - Socket diaria:confirmada: remove alerta + atualiza UI
//  - alertas com chave única por motorista
// ═══════════════════════════════════════════════════════════

// Set de códigos em processo de liberação (evita duplo clique)
var _liberando = new Set();

// Map de alertas de pagamento: codigo → elemento DOM do alerta
var _alertasPagamento = {};

// ── Sobrescrever liberarPagamento (versão corrigida) ──────
window.liberarPagamento = async function (codigo, nome) {
  // Proteção contra duplo clique
  if (_liberando.has(codigo)) {
    showToast('Liberação já em andamento para ' + nome + '...');
    return;
  }
  _liberando.add(codigo);

  showAguarde();
  try {
    var res  = await fetch(API + '/push/liberar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ codigo })
    });
    var data = await res.json();

    if (!res.ok) {
      showToast('Erro ao liberar: ' + (data.erro || 'Tente novamente'));
      _liberando.delete(codigo);
      hideAguarde();
      return;
    }

    // REMOVER alerta de pagamento pendente deste motorista
    removerAlertaPagamento(codigo);

    var msg = '✅ ' + nome + ' liberado!';
    if (data.registrou)   msg += ' Diária registrada.';
    if (data.jaExistia)   msg += ' (diária já estava registrada)';
    if (!data.socketEnviado) msg += ' ⚠️ App offline — motorista verá ao reconectar.';
    showToast(msg, 6000);

    // Atualizar tabela financeiro
    await carregarFinanceiro();

  } catch (e) {
    showToast('Erro de conexão: ' + e.message);
  }

  _liberando.delete(codigo);
  hideAguarde();
};

// ── Sobrescrever adicionarAlerta (com chave única) ────────
var _origAdicionarAlerta = window.adicionarAlerta;
window.adicionarAlerta = function (html, tipo, corridaId) {
  _origAdicionarAlerta?.(html, tipo, corridaId);
};

// Interceptar alerta de pagamento pendente para rastrear
var _origSocketSetup = window.conectarSocket;

// Hook no socket quando conectado
function hookDiariaSockets() {
  if (!state.socket) { setTimeout(hookDiariaSockets, 800); return; }

  // Sobrescrever o listener alerta:pagamento_pendente
  state.socket.off('alerta:pagamento_pendente');
  state.socket.on('alerta:pagamento_pendente', function (payload) {
    var codigo = payload.codigo;
    var nome   = payload.nome;

    // Se já tem alerta para este motorista, remover o anterior
    removerAlertaPagamento(codigo);

    // Criar novo alerta
    var el    = document.createElement('div');
    el.className     = 'alerta-item warning';
    el.dataset.codigo = codigo;
    el.innerHTML =
      '<span>💰 <b>' + nome + '</b> (' + codigo + ') avisou pagamento da diária. ' +
      '<button class="btn sm primary" id="btnLib-' + codigo + '" ' +
        'onclick="liberarPagamento(\'' + codigo + '\',\'' + nome.replace(/'/g, "\\'") + '\')">' +
        'Confirmar e Liberar' +
      '</button></span>' +
      '<button class="btn-fechar-alerta" onclick="fecharAlertaEl(this)">✕</button>';

    // Adicionar na lista de alertas
    var lista = document.getElementById('alertasLista');
    if (lista) lista.prepend(el);
    _alertasPagamento[codigo] = el;

    // Atualizar badge
    state.alertaCount = (state.alertaCount || 0) + 1;
    atualizarBadgeAlerta();

    // Som + toast
    if (window.tocarSomOp) tocarSomOp('alerta');
    showToast('💰 ' + nome + ' aguarda confirmação de pagamento', 6000);
  });

  // Listener para confirmação de liberação (emitido pelo backend)
  state.socket.off('diaria:confirmada');
  state.socket.on('diaria:confirmada', function (payload) {
    var codigo = payload.codigo;
    removerAlertaPagamento(codigo);
    // Atualizar tabela financeiro se estiver na tela
    if (window.carregarFinanceiro) carregarFinanceiro();
  });
}

function removerAlertaPagamento(codigo) {
  var el = _alertasPagamento[codigo];
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
    state.alertaCount = Math.max(0, (state.alertaCount || 1) - 1);
    atualizarBadgeAlerta();
    delete _alertasPagamento[codigo];
  }
}

window.fecharAlertaEl = function (btn) {
  var item  = btn.closest('.alerta-item');
  var codigo = item?.dataset?.codigo;
  if (codigo) {
    delete _alertasPagamento[codigo];
  }
  item?.remove();
  state.alertaCount = Math.max(0, (state.alertaCount || 1) - 1);
  atualizarBadgeAlerta();
};

// Iniciar hook quando app estiver pronto
document.addEventListener('DOMContentLoaded', function () {
  // Aguardar socket conectar
  hookDiariaSockets();
});

// ── Registrar diária manualmente (painel → financeiro diretamente) ──
window.registrarDiaria = async function (codigo, nome) {
  if (_liberando.has(codigo)) {
    showToast('Operação já em andamento...');
    return;
  }

  var diaria = Number((state.config || {}).valorDiaria || 19.90);
  var ok     = await (window.confirmar
    ? confirmar('Registrar diária de R$ ' + diaria.toFixed(2).replace('.', ',') + ' para ' + nome + '?')
    : Promise.resolve(confirm('Registrar diária de R$ ' + diaria.toFixed(2).replace('.', ',') + ' para ' + nome + '?')));
  if (!ok) return;

  _liberando.add(codigo);
  showAguarde();
  try {
    // Verificar se já registrou hoje
    var agora = new Date();
    if (agora.getHours() < 6) agora.setDate(agora.getDate() - 1);
    var diaOp = agora.toLocaleDateString('sv');

    var jaReg = state.financeiro.some(function (f) {
      return (f.motoristaCodigo || f.motorista_codigo) === codigo
        && f.tipo === 'Diária'
        && (f.data || '').startsWith(diaOp);
    });

    if (jaReg) {
      var sobrescrever = await (window.confirmar
        ? confirmar(nome + ' já tem diária registrada hoje. Registrar novamente mesmo assim?')
        : Promise.resolve(confirm(nome + ' já tem diária registrada hoje. Registrar mesmo assim?')));
      if (!sobrescrever) { _liberando.delete(codigo); hideAguarde(); return; }
    }

    await fetch(API + '/financeiro', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        motoristaCodigo: codigo, motorista: nome,
        valor: diaria, tipo: 'Diária', operador: 'Painel'
      })
    });

    await carregarFinanceiro();
    showToast('✅ Diária de ' + nome + ' registrada — R$ ' + diaria.toFixed(2).replace('.', ','));
  } catch (e) {
    showToast('Erro ao registrar: ' + e.message);
  }
  _liberando.delete(codigo);
  hideAguarde();
};

})(); // fim IIFE
