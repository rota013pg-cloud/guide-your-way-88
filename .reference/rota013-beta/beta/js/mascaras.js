;(function () {
'use strict';
// ═══════════════════════════════════════════════════════════
//  MASCARAS.JS — Rota 013 Beta 2.0  (dentro de IIFE)
// ═══════════════════════════════════════════════════════════

function maskTel(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10)
    return v.replace(/^(\d{0,2})(\d{0,4})(\d{0,4})$/, (_, a, b, c) =>
      (a ? '(' + a : '') + (b ? ') ' + b : '') + (c ? '-' + c : ''));
  return v.replace(/^(\d{2})(\d{5})(\d{0,4})$/, '($1) $2-$3');
}

function maskCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPlaca(v) {
  v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  return v.length > 3 ? v.slice(0, 3) + '-' + v.slice(3) : v;
}

// Formatar valor monetário (aceita "19,00" ou "19.00")
function maskMoeda(v) {
  const s = v.replace(/[^\d,\.]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? '' : n.toFixed(2).replace('.', ',');
}

// Aplicar máscara genérica em input TEXT
function bindMask(el, fn) {
  if (!el || el._mk) return;
  el._mk = true;
  el.type = 'text'; // garante type=text — evita o erro "cannot be parsed"
  el.addEventListener('input', function () {
    const sel  = this.selectionStart;
    const prev = this.value.length;
    const novo = fn(this.value);
    this.value = novo;
    try { this.setSelectionRange(sel + (novo.length - prev), sel + (novo.length - prev)); } catch {}
  });
  el.addEventListener('blur', function () { this.value = fn(this.value); });
}

// Aplicar máscara de moeda (só no blur, para não atrapalhar digitação)
function bindMoeda(el) {
  if (!el || el._mk) return;
  el._mk = true;
  el.type = 'text';
  el.inputMode = 'decimal';
  el.addEventListener('blur', function () {
    if (!this.value) return;
    this.value = maskMoeda(this.value);
  });
}

// Bind em todos os campos relevantes que existirem no DOM
function aplicarTodas() {
  // Telefones
  ['mCorridaTelefone', 'mCliTelefone', 'mMotTelefone',
   'mMotTelFamiliar', 'cfgWhats'].forEach(id => bindMask(document.getElementById(id), maskTel));

  // CPF
  bindMask(document.getElementById('mMotCpf'), maskCPF);

  // Placa (tratamento especial — não aplica máscara de tel)
  var plEl = document.getElementById('mMotPlaca');
  if (plEl && !plEl._mk) {
    plEl._mk = true;
    plEl.addEventListener('input',  function () { this.value = maskPlaca(this.value); });
    plEl.addEventListener('blur',   function () { this.value = maskPlaca(this.value); });
  }

  // Valor corrida — força type=text para evitar o erro de vírgula
  ['mCorridaValor', 'mCorridaValorFinal'].forEach(id => bindMoeda(document.getElementById(id)));
}

// Rodar imediatamente + após DOMContentLoaded
aplicarTodas();
document.addEventListener('DOMContentLoaded', aplicarTodas);

// Reaplica sempre que um modal for aberto (usando MutationObserver — mais confiável que interceptar funções)
var _obs = new MutationObserver(function (muts) {
  muts.forEach(function (m) {
    m.addedNodes.forEach(function (n) {
      if (n.nodeType === 1) aplicarTodas();
    });
  });
});
_obs.observe(document.body || document.documentElement, { childList: true, subtree: false });

// Expor globalmente
window.maskTel     = maskTel;
window.maskCPF     = maskCPF;
window.maskPlaca   = maskPlaca;
window.maskMoeda   = maskMoeda;
window.aplicarMascarasModal = aplicarTodas;

})();
