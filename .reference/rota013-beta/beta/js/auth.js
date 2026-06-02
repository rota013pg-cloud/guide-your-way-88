// ═══════════════════════════════════════════════════════
//  AUTH.JS — Login, sessão e logout
// ═══════════════════════════════════════════════════════

const SESSAO_KEY = 'rota013_sessao';

// ─── Login ────────────────────────────────────────────
async function tentarLogin() {
  const u = document.getElementById('loginUser')?.value.trim();
  const p = document.getElementById('loginPass')?.value.trim();
  if (!u || !p) { showToast('Preencha usuário e senha.'); return; }

  let op = null;

  // Tentar API primeiro
  try {
    op = await apiPost('/auth/login', { usuario: u, senha: p });
  } catch {
    // Fallback: validar local (modo demo)
    op = state.operadores.find(o => o.usuario === u && o.senha === p && o.status === 'Ativo');
    if (op) console.warn('Login em modo demo (backend offline)');
  }

  if (!op) { showToast('Usuário ou senha incorretos.'); return; }

  // Persistir sessão em localStorage (sobrevive reload e fechar aba)
  localStorage.setItem(SESSAO_KEY, JSON.stringify(op));

  await abrirPainel(op);
}

// ─── Abrir painel após autenticação ──────────────────
async function abrirPainel(op) {
  state.currentUser = op;

  // Esconder login, mostrar app
  document.getElementById('loginScreen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');

  // Preencher topbar
  const elName   = document.getElementById('operatorName');
  const elAvatar = document.getElementById('operatorAvatar');
  const elRole   = document.getElementById('operatorRole');
  if (elName)   elName.textContent   = op.nome;
  if (elRole)   elRole.textContent   = op.perfil==='admin' ? 'Administrador' : 'Operador Central';
  if (elAvatar) {
    const iniciais = op.nome.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    if (op.foto) {
      elAvatar.style.backgroundImage = `url('${op.foto}')`;
      elAvatar.textContent = '';
    } else {
      elAvatar.textContent = iniciais;
      elAvatar.style.backgroundImage = '';
    }
  }

  // Mostrar/ocultar menu Admin
  const adminBtn = document.querySelector('[data-page="admin"]');
  if (adminBtn) adminBtn.style.display = op.perfil === 'admin' ? '' : 'none';

  // Carregar dados e abrir dashboard
  const online = await carregarDados();
  if (!online) showToast('⚠️ Servidor offline — dados não salvos');
  showPage('dashboard');
}

// ─── Logout ───────────────────────────────────────────
function fazerLogout() {
  localStorage.removeItem(SESSAO_KEY);
  state.currentUser = null;
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('loginScreen')?.classList.remove('hidden');
  const lp = document.getElementById('loginPass');
  if (lp) lp.value = '';
}

// ─── Restaurar sessão ao recarregar ──────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Enter no campo senha faz login
  document.getElementById('loginPass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') tentarLogin();
  });

  // Verificar sessão salva
  const saved = localStorage.getItem(SESSAO_KEY);
  if (!saved) return; // sem sessão → fica na tela de login

  try {
    const op = JSON.parse(saved);
    if (op?.usuario) {
      await abrirPainel(op);
      return;
    }
  } catch {
    localStorage.removeItem(SESSAO_KEY);
  }
});
