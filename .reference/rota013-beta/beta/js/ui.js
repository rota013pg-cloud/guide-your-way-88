// ═══════════════════════════════════════════════════════
//  UI.JS — Helpers de interface: toast, modal, navegação
// ═══════════════════════════════════════════════════════

function showToast(msg, dur = 3000) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("active");
  setTimeout(() => t.classList.remove("active"), dur);
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("active");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("active");
}

function showPage(id) {
  document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelector(`.menu-item[data-page="${id}"]`)?.classList.add("active");
  document.getElementById(id)?.classList.add("active");
  document.getElementById("pageTitle").textContent =
    document.querySelector(`.menu-item[data-page="${id}"]`)?.textContent || "Painel";
  document.getElementById("sidebar")?.classList.remove("open");
  if (id === "dashboard") setTimeout(drawChart, 100);
  if (id === "tarifas")   initTarifas();
}

function copiarTexto(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.value)
    .then(() => showToast("Copiado!"))
    .catch(() => {
      el.select();
      document.execCommand("copy");
      showToast("Copiado!");
    });
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
}

// Alias de compatibilidade
function goToPage(id) { showPage(id); }

// ─── Fechar modal corrida e limpar campos ────────────
function closeModalCorrida() {
  closeModal('modalCorrida');
  // Limpar todos os campos após fechar para evitar dados na próxima abertura
  setTimeout(() => {
    const campos = [
      'corridaEditId','corridaClienteCodigo','corridaClienteNome','corridaClienteWhats',
      'corridaOrigem','corridaDestino','corridaMetodo','corridaDistancia',
      'corridaDuracao','corridaValor','corridaValorFinal','corridaObs'
    ];
    campos.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    // Limpar lat/lng dos campos de endereço
    ['corridaOrigem','corridaDestino'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { delete el.dataset.lat; delete el.dataset.lng; }
      const btn = el?.closest('.input-clear-wrap')?.querySelector('.btn-clear-field');
      if (btn) btn.style.display = 'none';
    });
    // Limpar listas de autocomplete
    ['sugestoes-origem','sugestoes-destino'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.innerHTML = ''; el.classList.remove('active'); }
    });
  }, 150);
}

// ─── Bottom nav: marcar item ativo ───────────────────
function mobileNavAtivo(btn) {
  document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function showAguarde() {
  document.getElementById('modalAguarde')?.classList.add('active');
}
function hideAguarde() {
  document.getElementById('modalAguarde')?.classList.remove('active');
}
