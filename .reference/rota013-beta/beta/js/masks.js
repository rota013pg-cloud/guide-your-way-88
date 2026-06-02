// ═══════════════════════════════════════════════════════
//  MASKS.JS — Máscaras de input e formatação automática
// ═══════════════════════════════════════════════════════

function aplicarMascaras() {
  // Telefone: (99) 99999-9999
  document.querySelectorAll('[data-mask="fone"]').forEach(el => {
    el.addEventListener('input', () => { el.value = mascaraTelefone(el.value); });
  });
  // CPF: 999.999.999-99
  document.querySelectorAll('[data-mask="cpf"]').forEach(el => {
    el.addEventListener('input', () => { el.value = mascaraCpf(el.value); });
  });
  // CEP: 99999-999
  document.querySelectorAll('[data-mask="cep"]').forEach(el => {
    el.addEventListener('input', () => { el.value = mascaraCep(el.value); });
  });
  // Placa: AAA9A99 ou AAA-9999
  document.querySelectorAll('[data-mask="placa"]').forEach(el => {
    el.addEventListener('input', () => { el.value = mascaraPlaca(el.value); });
  });
  // MAIÚSCULAS
  document.querySelectorAll('[data-upper]').forEach(el => {
    el.addEventListener('input', () => {
      const pos = el.selectionStart;
      el.value = el.value.toUpperCase();
      el.setSelectionRange(pos, pos);
    });
  });
  // Capitalizar nomes (primeira letra maiúscula)
  document.querySelectorAll('[data-capitalize]').forEach(el => {
    el.addEventListener('blur', () => {
      el.value = capitalizarNome(el.value);
    });
  });
  // Moeda: R$ 0,00
  document.querySelectorAll('[data-mask="moeda"]').forEach(el => {
    el.addEventListener('input', () => { el.value = mascaraMoeda(el.value); });
  });
}

function mascaraTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

function mascaraCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/-$/, '').replace(/\.$/, '');
}

function mascaraCep(v) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '');
}

function mascaraPlaca(v) {
  // Mercosul: AAA9A99 ou clássica: AAA-9999
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (s.length > 3) return s.slice(0, 3) + '-' + s.slice(3);
  return s;
}

function mascaraMoeda(v) {
  const d = v.replace(/\D/g, '');
  if (!d) return '';
  const n = (parseInt(d, 10) / 100).toFixed(2);
  return n.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function capitalizarNome(s) {
  const min = ['da','de','do','das','dos','e','em','na','no','nas','nos','a','o'];
  return String(s || '').toLowerCase()
    .replace(/(?:^|\s)\S/g, (c, i) => {
      // Sempre capitalizar primeira palavra
      if (i === 0) return c.toUpperCase();
      const palavra = s.slice(i + 1 - 1).split(' ')[0].toLowerCase();
      return min.includes(palavra) ? c : c.toUpperCase();
    });
}

// Validação simples de decimal para campos de valor
// NÃO converte de centavos — aceita 19.45 como 19.45
function aplicarMascaraValor(el) {
  el.addEventListener('keypress', function(e) {
    // Permitir apenas dígitos, ponto e vírgula
    if (!/[0-9.,]/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  });
  el.addEventListener('blur', function() {
    const v = parseMoney(this.value);
    if (v > 0) this.value = v.toFixed(2);
    else if (this.value) this.value = '';
  });
}

// Aplicar após DOM pronto
document.addEventListener('DOMContentLoaded', () => {
  aplicarMascaras();
  // Máscara de valor nos campos de corrida
  ['corridaValorFinal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) aplicarMascaraValor(el);
  });
});
