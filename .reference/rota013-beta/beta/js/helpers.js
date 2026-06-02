// ═══════════════════════════════════════════════════════
//  HELPERS.JS — Utilitários gerais
// ═══════════════════════════════════════════════════════

function badge(s){ const map={Ativo:"green",Paga:"green","Em andamento":"green",Pendente:"orange",Divulgada:"orange",Aceita:"blue",Nova:"gray",Finalizada:"gray",Bloqueado:"red",Cancelada:"red"}; return `<span class="badge ${map[s]||"gray"}">${s}</span>`; }

function abrirWhats(num,msg){ window.open(`https://wa.me/${String(num).replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank"); }

function normalizarTelefone(v){ const d=String(v||"").replace(/\D/g,""); return d.startsWith("55") ? d : "55"+d; }

function formatPhone(v){ const d=String(v||"").replace(/\D/g,"").replace(/^55/,""); return d.length>=10 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}` : v; }

function normalizar(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

function parseMoney(v) {
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).replace('R$','').trim();
  // Se tem vírgula e ponto: formato brasileiro 1.234,56
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g,'').replace(',','.');
  } else if (s.includes(',')) {
    // Pode ser 19,45 (decimal BR) ou 1,234 (milhar)
    const parts = s.split(',');
    if (parts[1]?.length <= 2) s = s.replace(',','.');  // decimal
    else s = s.replace(/,/g,'');  // milhar
  }
  return Number(s) || 0;
}

function gerarCodigoCliente(){ const max = state.clientes.length ? Math.max(...state.clientes.map(c=>Number(c.codigo))) : 0; return String(max+1).padStart(4,"0"); }

function gerarCodigoMotorista(){ const nums = state.motoristas.map(m=>Number(m.codigo.replace("M",""))||0); return "M"+String(Math.max(...nums,100)+1).padStart(4,"0"); }

