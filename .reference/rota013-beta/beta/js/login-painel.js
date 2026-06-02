// ═══════════════════════════════════════════════════════════
//  LOGIN-PAINEL.JS — Rota 013 Beta 2.0
//  Autenticação do operador + proteção do painel
// ═══════════════════════════════════════════════════════════
'use strict';

const SESSAO_KEY = 'rota013_op_sessao';
const SESSAO_TTL = 8 * 60 * 60 * 1000; // 8h

// ── Inicialização ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (verificarSessao()) {
    mostrarPainel();
  } else {
    mostrarLoginOp();
    setTimeout(() => document.getElementById('opUsuario')?.focus(), 200);
  }
});

// ── Verificar sessão salva ────────────────────────────────
function verificarSessao() {
  try {
    const raw = localStorage.getItem(SESSAO_KEY);
    if (!raw) return false;
    const { operador, ts } = JSON.parse(raw);
    if (!operador || Date.now() - ts > SESSAO_TTL) {
      localStorage.removeItem(SESSAO_KEY);
      return false;
    }
    // Preencher nome do operador no header
    aplicarOperador(operador);
    return true;
  } catch {
    return false;
  }
}

// ── Login ─────────────────────────────────────────────────
async function loginOperador() {
  const usuario = document.getElementById('opUsuario')?.value.trim();
  const senha   = document.getElementById('opSenha')?.value;
  const erroEl  = document.getElementById('loginOpErro');
  const btnEl   = document.getElementById('btnLoginOp');

  if (erroEl) erroEl.textContent = '';
  if (!usuario || !senha) {
    if (erroEl) erroEl.textContent = 'Preencha usuário e senha.';
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Entrando...'; }

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ usuario, senha })
    });
    const data = await res.json();

    if (!res.ok) {
      if (erroEl) erroEl.textContent = data.erro || 'Usuário ou senha incorretos.';
      return;
    }

    // Salvar sessão
    localStorage.setItem(SESSAO_KEY, JSON.stringify({
      operador: data,
      ts:       Date.now()
    }));

    aplicarOperador(data);
    mostrarPainel();

    // Registrar log
    fetch(`${API}/logs`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        operador: data.nome || usuario,
        acao:     'Login no painel Beta 2.0'
      })
    }).catch(() => {});

  } catch {
    if (erroEl) erroEl.textContent = 'Erro de conexão. Tente novamente.';
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
  }
}

// ── Aplicar dados do operador na UI ──────────────────────
function aplicarOperador(op) {
  const nome = op?.nome || op?.usuario || 'Operador';
  const top  = document.getElementById('opNomeTop');
  const side = document.getElementById('opNomeSide');
  if (top)  top.textContent  = nome;
  if (side) side.textContent = nome;

  // Mostrar/ocultar itens admin
  if (op?.perfil === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
}

// ── Logout ────────────────────────────────────────────────
const _origLogout = window.logout;
window.logout = function() {
  // Registrar log antes de sair
  try {
    const raw = localStorage.getItem(SESSAO_KEY);
    if (raw) {
      const { operador } = JSON.parse(raw);
      fetch(`${API}/logs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          operador: operador?.nome || 'Operador',
          acao:     'Logout do painel'
        })
      }).catch(() => {});
    }
  } catch {}

  localStorage.removeItem(SESSAO_KEY);
  mostrarLoginOp();

  // Desconectar socket
  state.socket?.disconnect();
  state.socket = null;
};

// ── Mostrar tela de login ─────────────────────────────────
function mostrarLoginOp() {
  document.getElementById('telaLoginOp')?.classList.remove('hidden');
  document.getElementById('sidebar')?.classList.add('login-hidden');
  document.getElementById('main')?.classList.add('login-hidden');

  // Limpar campos
  const u = document.getElementById('opUsuario');
  const s = document.getElementById('opSenha');
  const e = document.getElementById('loginOpErro');
  if (u) u.value = '';
  if (s) s.value = '';
  if (e) e.textContent = '';
}

// ── Mostrar painel ────────────────────────────────────────
function mostrarPainel() {
  document.getElementById('telaLoginOp')?.classList.add('hidden');
  document.getElementById('sidebar')?.classList.remove('login-hidden');
  document.getElementById('main')?.classList.remove('login-hidden');

  // Inicializar app se ainda não foi
  if (!state.socket) {
    carregarDados();
    conectarSocket();
  }
}

// ── Toggle senha ──────────────────────────────────────────
function toggleSenhaOp() {
  const el = document.getElementById('opSenha');
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

// ── Esconder painel enquanto não logado ───────────────────
const loginStyle = document.createElement('style');
loginStyle.textContent = `
  .login-hidden { display: none !important; }
`;
document.head.appendChild(loginStyle);

// Ocultar sidebar e main até verificar sessão
document.getElementById('sidebar')?.classList.add('login-hidden');
document.getElementById('main')?.classList.add('login-hidden');

// Expor globalmente
window.loginOperador  = loginOperador;
window.toggleSenhaOp  = toggleSenhaOp;
window.mostrarLoginOp = mostrarLoginOp;
window.mostrarPainel  = mostrarPainel;
