// ═══════════════════════════════════════════════════════
//  STATE.JS — Dados em memória (substituído pelo backend)
// ═══════════════════════════════════════════════════════

const state = {
  currentUser: null,
  tempFoto: "",
  pendingRide: null,

  operadores: [
    { id: 1, nome: "Glauco Santos",    usuario: "admin",    senha: "123456", perfil: "admin",    status: "Ativo" },
    { id: 2, nome: "Operador Central", usuario: "operador", senha: "123456", perfil: "operador", status: "Ativo" }
  ],

  clientes: [
    { id: 12, codigo: "0012", nome: "Mariana Souza",  telefone: "5513999991111", cidade: "Ocian - Praia Grande",      corridas: 12 },
    { id: 13, codigo: "0013", nome: "Carlos Lima",    telefone: "5513999992222", cidade: "Boqueirão - Praia Grande",  corridas: 7  },
    { id: 14, codigo: "0014", nome: "Renata Alves",   telefone: "5513999993333", cidade: "Canto do Forte - PG",       corridas: 3  }
  ],

  motoristas: [
    { id: 101, codigo: "M0101", nome: "João Silva",    telefone: "5513999887711", moto: "Honda CG 160",   placa: "ABC1D23", status: "Online",  foto: "" },
    { id: 102, codigo: "M0102", nome: "Pedro Santos",  telefone: "5513999887722", moto: "Yamaha Fazer",   placa: "DEF4G56", status: "Offline", foto: "" },
    { id: 103, codigo: "M0103", nome: "Lucas Rocha",   telefone: "5513999887733", moto: "Honda Biz 125",  placa: "GHI7J89", status: "Online",  foto: "" }
  ],

  corridas: [],
  logs: []
};

// ─── Helpers globais ──────────────────────────────────
function nextId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

function moeda(v) {
  return "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
}

function parseMoney(v) {
  return parseFloat(String(v || "0").replace(",", ".")) || 0;
}

function normalizarTelefone(v) {
  return String(v || "").replace(/\D/g, "");
}

function formatPhone(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return v;
}

function normalizar(s) {
  return String(s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

function addLog(acao) {
  const now = new Date().toLocaleString("pt-BR");
  const op  = state.currentUser?.nome || "Sistema";
  state.logs.unshift({ data: now, operador: op, acao });
}
