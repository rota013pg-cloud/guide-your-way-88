// ═══════════════════════════════════════════════════════
//  CONFIG.JS — Configurações da empresa (salvas no banco)
// ═══════════════════════════════════════════════════════

// Carregado no state pelo carregarDados()
// state.config = { empresa, whatsappCentral, valorDiaria, cidadeBase }

function renderConfiguracoes() {
  const c = state.config || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  set('cfgEmpresa', c.empresa        || 'Rota 013');
  set('cfgWhats',   c.whatsappCentral|| '(13) 99999-9999');
  set('cfgDiaria',  c.valorDiaria    || 50);
  set('cfgCidade',  c.cidadeBase     || 'Praia Grande - SP');
  set('cfgPix',     c.pixChave       || '');
}

async function salvarConfiguracoes() {
  const config = {
    empresa:          (document.getElementById('cfgEmpresa')?.value || '').trim(),
    whatsappCentral:  (document.getElementById('cfgWhats')?.value || '').replace(/\D/g, ''),
    valorDiaria:      Number(document.getElementById('cfgDiaria')?.value || 50),
    cidadeBase:       (document.getElementById('cfgCidade')?.value || '').trim(),
    pixChave:         (document.getElementById('cfgPix')?.value || '').trim()
  };

  try {
    await apiPut('/config', config);
    state.config = config;
    showToast('Configurações salvas ✅');
  } catch {
    state.config = config;
    showToast('Configurações salvas localmente ⚠️');
  }
  renderFinanceiro(); // Atualizar valor da diária no financeiro
}
