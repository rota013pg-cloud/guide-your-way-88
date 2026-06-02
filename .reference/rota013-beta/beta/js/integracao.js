;(function () {
'use strict';
// ═══════════════════════════════════════════════════════════
//  INTEGRACAO.JS — Rota 013 Beta 2.0  (dentro de IIFE)
//  Responsável por:
//  - diaOperacional()
//  - renderFinanceiro (dia operacional 6h)
//  - renderDashboard (contador pelo dia operacional)
//  - atalhoRelatorio (período com dia operacional)
//  - upload de foto de perfil do motorista
//  - relógio no topbar
//  NÃO duplica: renderCorridas, renderClientes, calcularDistanciaModal,
//               mudarStatusCorrida, salvarCorrida → isso fica em correcoes.js
// ═══════════════════════════════════════════════════════════

// ── Dia operacional: 6h de hoje até 5h59 de amanhã ───────
function diaOperacional() {
  var d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('sv'); // YYYY-MM-DD — REGRA CRÍTICA
}
window.diaOperacional = diaOperacional;

// ── renderFinanceiro com dia operacional ─────────────────
window.renderFinanceiro = function () {
  var hoje   = diaOperacional();
  var diaria = Number((state.config || {}).valorDiaria || 19.90);

  var hoje_fin = state.financeiro.filter(function (f) {
    return f.tipo === 'Diária' && (f.data || '').startsWith(hoje);
  });
  var pagas = hoje_fin.length;
  var total = hoje_fin.reduce(function (s, f) { return s + Number(f.valor || 0); }, 0);

  function sv(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  sv('finPagas',       pagas);
  sv('finPendentes',   Math.max(0, state.motoristas.filter(function (m) { return m.status !== 'Inativo'; }).length - pagas));
  sv('finTotal',       'R$ ' + total.toFixed(2).replace('.', ','));
  sv('finValorDiaria', 'R$ ' + diaria.toFixed(2).replace('.', ','));

  var tbody = document.getElementById('tabelaFinanceiro');
  if (!tbody) return;

  var ativos = state.motoristas.filter(function (m) { return m.status !== 'Inativo'; });
  tbody.innerHTML = ativos.map(function (m) {
    var pagou = hoje_fin.some(function (f) {
      return (f.motoristaCodigo || f.motorista_codigo) === m.codigo;
    });
    var corridasHoje = state.corridas.filter(function (c) {
      return c.motoristaCodigo === m.codigo &&
             c.status === 'Finalizada' &&
             (c.criadoEm || '').startsWith(hoje);
    });
    var ganho   = corridasHoje.reduce(function (s, c) { return s + (c.valorFinal || 0); }, 0);
    var limite  = diaria * 0.5;
    var atingiu = ganho >= limite && !pagou;
    var online  = ['Disponivel', 'Ocupado'].includes(m.status);

    return '<tr class="' + (atingiu ? 'row-alerta' : '') + '">' +
      '<td><span class="dot-status ' + (online ? 'green' : 'gray') + '"></span><b>' + m.codigo + '</b></td>' +
      '<td>' + m.nome + '</td>' +
      '<td>' + (pagou
        ? '<span class="badge green">✅ Paga</span>'
        : atingiu
          ? '<span class="badge orange">⚠️ Pendente</span>'
          : '<span class="badge gray">—</span>') + '</td>' +
      '<td>R$ ' + ganho.toFixed(2).replace('.', ',') + '</td>' +
      '<td>R$ ' + limite.toFixed(2).replace('.', ',') + '</td>' +
      '<td class="td-acoes">' +
        (!pagou ? '<button class="btn sm primary" onclick="registrarDiaria(\'' + m.codigo + '\',\'' + m.nome + '\')">💰 Registrar</button>' : '') +
        (atingiu ? '<button class="btn sm" onclick="liberarPagamento(\'' + m.codigo + '\',\'' + m.nome + '\')">📲 Liberar app</button>' : '') +
      '</td></tr>';
  }).join('') || '<tr><td colspan="6" class="empty-td">Sem motoristas ativos</td></tr>';
};

// ── renderDashboard — corrigir contagem pelo dia operacional ─
var _dashOrig = window.renderDashboard;
window.renderDashboard = function () {
  if (_dashOrig) _dashOrig();
  var hoje = diaOperacional();
  var hCorridas = state.corridas.filter(function (c) { return (c.criadoEm || '').startsWith(hoje); });
  var el = document.getElementById('dCorridas');
  if (el) el.textContent = hCorridas.length;
};

// ── atalhoRelatorio com dia operacional ──────────────────
window.atalhoRelatorio = function (periodo) {
  var hoje = diaOperacional();
  function sv2(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
  sv2('relDe', hoje);
  sv2('relAte', hoje);
  if (periodo === '7dias') {
    var d7 = new Date(hoje); d7.setDate(d7.getDate() - 6);
    sv2('relDe', d7.toLocaleDateString('sv'));
  } else if (periodo === 'mes') {
    var dm = new Date(hoje);
    sv2('relDe', new Date(dm.getFullYear(), dm.getMonth(), 1).toLocaleDateString('sv'));
  } else if (periodo === '30dias') {
    var d30 = new Date(hoje); d30.setDate(d30.getDate() - 29);
    sv2('relDe', d30.toLocaleDateString('sv'));
  }
  if (window.buscarRelatorio) buscarRelatorio();
};

// ── Upload foto de perfil do motorista ───────────────────
window.previewFotoMotorista = function (input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 2 * 1024 * 1024) { showToast('Foto muito grande (max 2MB)'); return; }
  var reader = new FileReader();
  reader.onload = function (e) {
    var b64  = e.target.result;
    var hidFoto = document.getElementById('mMotFoto');
    if (hidFoto) hidFoto.value = b64;
    var prev = document.getElementById('previewFotoMot');
    if (prev) {
      prev.style.backgroundImage    = "url('" + b64 + "')";
      prev.style.backgroundSize     = 'cover';
      prev.style.backgroundPosition = 'center';
      prev.textContent = '';
    }
  };
  reader.readAsDataURL(file);
};

// ── Upload foto da moto ───────────────────────────────────
window.previewFotoMotoInline = function (input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 3 * 1024 * 1024) { showToast('Foto muito grande (max 3MB)'); return; }
  var reader = new FileReader();
  reader.onload = function (e) {
    var b64 = e.target.result;
    var hid = document.getElementById('mMotFotoMoto');
    if (hid) hid.value = b64;
    // Sincronizar com state.tempDocs para salvarMotorista() pegar
    if (window.state && window.state.tempDocs) state.tempDocs.fotoMoto = b64;
    var prev = document.getElementById('previewFotoMotoMot');
    if (prev) {
      prev.style.backgroundImage    = "url('" + b64 + "')";
      prev.style.backgroundSize     = 'cover';
      prev.style.backgroundPosition = 'center';
      prev.textContent = '';
    }
  };
  reader.readAsDataURL(file);
};

// ── Preencher preview ao editar motorista ────────────────
var _editMotoOrig = window.editarMotorista;
window.editarMotorista = function (id) {
  if (_editMotoOrig) _editMotoOrig(id);
  setTimeout(function () {
    var m    = state.motoristas.find(function (x) { return x.id == id; });
    var prev = document.getElementById('previewFotoMot');
    if (m && prev) {
      if (m.foto) {
        prev.style.backgroundImage = "url('" + m.foto + "')";
        prev.style.backgroundSize  = 'cover';
        prev.textContent = '';
      } else {
        prev.style.backgroundImage = '';
        prev.textContent = (m.nome || 'M')[0];
      }
    }
    var prevMoto = document.getElementById('previewFotoMotoMot');
    var hidMoto  = document.getElementById('mMotFotoMoto');
    if (m && prevMoto) {
      if (m.fotoMoto) {
        prevMoto.style.backgroundImage = "url('" + m.fotoMoto + "')";
        prevMoto.style.backgroundSize  = 'cover';
        prevMoto.textContent = '';
        if (hidMoto) hidMoto.value = m.fotoMoto;
        // Sincronizar com state.tempDocs
        if (window.state && window.state.tempDocs) state.tempDocs.fotoMoto = m.fotoMoto;
      } else {
        prevMoto.style.backgroundImage = '';
        prevMoto.textContent = '🏍️';
      }
    }
  }, 80);
};

// ── Relógio no topbar ─────────────────────────────────────
(function iniciarRelogio() {
  function atualizar() {
    var n  = new Date();
    var hh = String(n.getHours()).padStart(2, '0');
    var mm = String(n.getMinutes()).padStart(2, '0');
    var op = document.getElementById('opNomeTop');
    if (op && !op._rel) {
      op._rel = true;
      var span   = document.createElement('span');
      span.id    = 'relogioTop';
      span.style.cssText = 'font-size:11px;color:var(--muted);margin-left:8px';
      op.after(span);
    }
    var r = document.getElementById('relogioTop');
    if (r) {
      r.textContent = hh + ':' + mm + (n.getHours() < 6 ? ' 🌙' : '');
      r.title       = 'Dia operacional: ' + diaOperacional();
    }
  }
  atualizar();
  setInterval(atualizar, 30000);
})();

})(); // fim IIFE
