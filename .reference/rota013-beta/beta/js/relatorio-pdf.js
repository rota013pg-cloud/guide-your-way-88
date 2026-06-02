// ═══════════════════════════════════════════════════════════
//  RELATORIO-PDF.JS — Rota 013 Beta 2.0
//  Geração de PDF do relatório financeiro no browser
//  Usa a API de impressão nativa (window.print) com CSS @print
//  — zero dependências externas
// ═══════════════════════════════════════════════════════════
'use strict';

// ── CSS de impressão (injetado uma vez) ───────────────────
(function injetarCssImpressao() {
  const style = document.createElement('style');
  style.textContent = `
    @media print {
      body > *:not(#printArea) { display: none !important; }
      #printArea {
        display: block !important;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11pt;
        color: #000;
        margin: 0;
        padding: 0;
      }

      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 2px solid #000;
      }
      .print-logo {
        font-size: 22pt;
        font-weight: 900;
        font-style: italic;
        letter-spacing: -2px;
      }
      .print-logo span { color: #b8960c; }
      .print-titulo { font-size: 13pt; font-weight: 700; margin: 4px 0 2px; }
      .print-periodo { font-size: 9pt; color: #555; }
      .print-gerado { font-size: 8pt; color: #888; text-align: right; }

      .print-resumo {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      .print-card {
        border: 1pt solid #ccc;
        border-radius: 4pt;
        padding: 8pt 10pt;
        text-align: center;
      }
      .print-card-num { font-size: 16pt; font-weight: 900; }
      .print-card-label { font-size: 8pt; color: #555; margin-top: 3pt; }

      .print-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      .print-table th {
        background: #f0f0f0;
        border: 1pt solid #ccc;
        padding: 6pt 8pt;
        text-align: left;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.5pt;
      }
      .print-table td {
        border: 1pt solid #ddd;
        padding: 5pt 8pt;
        font-size: 10pt;
        vertical-align: top;
      }
      .print-table tr:nth-child(even) td { background: #fafafa; }

      .print-total {
        text-align: right;
        font-size: 12pt;
        font-weight: 700;
        margin-top: 8pt;
        padding-top: 8pt;
        border-top: 2pt solid #000;
      }
      .print-footer {
        margin-top: 20pt;
        font-size: 8pt;
        color: #888;
        text-align: center;
        border-top: 1pt solid #ddd;
        padding-top: 8pt;
      }

      @page {
        margin: 15mm 12mm;
        size: A4 portrait;
      }
    }

    /* Área de impressão — oculta na tela normal */
    #printArea { display: none; }
  `;
  document.head.appendChild(style);

  // Criar container de impressão
  const div  = document.createElement('div');
  div.id     = 'printArea';
  document.body.appendChild(div);
})();

// ── Gerar e imprimir relatório ────────────────────────────
async function gerarRelPDF() {
  const de      = document.getElementById('relDe')?.value  || '';
  const ate     = document.getElementById('relAte')?.value || '';
  const tipo    = document.getElementById('relTipo')?.value    || '';
  const motFiltro = (document.getElementById('relMotorista')?.value || '').toLowerCase();

  // Buscar dados
  let lista = [];
  try {
    const r   = await fetch(`${API}/financeiro`);
    const all = await r.json();
    lista = all.filter(f => {
      const data = (f.data || '').slice(0, 10);
      const ok1  = !de        || data >= de;
      const ok2  = !ate       || data <= ate;
      const ok3  = !tipo      || f.tipo === tipo;
      const ok4  = !motFiltro || `${f.motoristaCodigo||f.motorista_codigo} ${f.motorista}`.toLowerCase().includes(motFiltro);
      return ok1 && ok2 && ok3 && ok4;
    });
  } catch {
    showToast('Erro ao buscar dados para PDF'); return;
  }

  if (!lista.length) { showToast('Nenhum registro para gerar PDF'); return; }

  const total = lista.reduce((s, f) => s + Number(f.valor || 0), 0);
  const cfg   = state.config || {};

  // Agrupar por motorista para resumo
  const porMotorista = {};
  lista.forEach(f => {
    const cod = f.motoristaCodigo || f.motorista_codigo || f.motorista;
    if (!porMotorista[cod]) porMotorista[cod] = { nome: f.motorista, total: 0, qtd: 0 };
    porMotorista[cod].total += Number(f.valor || 0);
    porMotorista[cod].qtd++;
  });

  const resumoMots = Object.values(porMotorista)
    .sort((a, b) => b.total - a.total);

  // Formatar período
  const fmtData = (s) => s ? s.slice(0, 10).split('-').reverse().join('/') : '—';
  const periodoStr = de === ate
    ? fmtData(de)
    : `${fmtData(de)} a ${fmtData(ate)}`;

  const agora    = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const empresa  = cfg.empresa || 'Rota 013';

  // Montar HTML
  document.getElementById('printArea').innerHTML = `
    <div class="print-header">
      <div>
        <div class="print-logo">Rota<span>013</span></div>
        <div class="print-titulo">Relatório Financeiro — ${tipo || 'Geral'}</div>
        <div class="print-periodo">Período: ${periodoStr}</div>
        ${motFiltro ? `<div class="print-periodo">Motorista: ${motFiltro}</div>` : ''}
      </div>
      <div class="print-gerado">
        <b>${empresa}</b><br/>
        Gerado em: ${agora}<br/>
        ${lista.length} registros
      </div>
    </div>

    <!-- Cards de resumo -->
    <div class="print-resumo">
      <div class="print-card">
        <div class="print-card-num">${lista.length}</div>
        <div class="print-card-label">Registros</div>
      </div>
      <div class="print-card">
        <div class="print-card-num">R$ ${total.toFixed(2).replace('.', ',')}</div>
        <div class="print-card-label">Total</div>
      </div>
      <div class="print-card">
        <div class="print-card-num">${Object.keys(porMotorista).length}</div>
        <div class="print-card-label">Motoristas</div>
      </div>
      <div class="print-card">
        <div class="print-card-num">R$ ${lista.length ? (total / lista.length).toFixed(2).replace('.', ',') : '0,00'}</div>
        <div class="print-card-label">Média</div>
      </div>
    </div>

    <!-- Tabela principal -->
    <table class="print-table">
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Código</th>
          <th>Motorista</th>
          <th>Tipo</th>
          <th>Valor</th>
          <th>Operador</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(f => `
          <tr>
            <td>${(f.data || '').slice(0, 16).replace('T', ' ')}</td>
            <td>${f.motoristaCodigo || f.motorista_codigo || '—'}</td>
            <td>${f.motorista || '—'}</td>
            <td>${f.tipo}</td>
            <td><b>R$ ${Number(f.valor || 0).toFixed(2).replace('.', ',')}</b></td>
            <td>${f.operador || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="print-total">Total: R$ ${total.toFixed(2).replace('.', ',')}</div>

    <!-- Resumo por motorista -->
    ${resumoMots.length > 1 ? `
      <br/>
      <b style="font-size:11pt">Resumo por Motorista</b>
      <table class="print-table" style="margin-top:8pt">
        <thead><tr><th>Motorista</th><th>Registros</th><th>Total</th></tr></thead>
        <tbody>
          ${resumoMots.map(m => `
            <tr>
              <td>${m.nome}</td>
              <td>${m.qtd}</td>
              <td><b>R$ ${m.total.toFixed(2).replace('.', ',')}</b></td>
            </tr>`).join('')}
        </tbody>
      </table>
    ` : ''}

    <div class="print-footer">
      ${empresa} — Relatório gerado em ${agora} — Sistema Beta 2.0
    </div>
  `;

  // Aguardar render e imprimir
  await new Promise(r => setTimeout(r, 150));
  window.print();
}

// ── Injetar botão PDF no painel financeiro ────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Aguardar renderização da seção financeiro
  const injetar = () => {
    const actionsEl = document.querySelector('#pageFinanceiro .actions');
    if (!actionsEl) return;
    if (actionsEl.querySelector('.btn-pdf')) return; // já adicionado

    const btnPDF = document.createElement('button');
    btnPDF.className   = 'btn btn-pdf';
    btnPDF.innerHTML   = '📄 Exportar PDF';
    btnPDF.onclick     = gerarRelPDF;
    actionsEl.appendChild(btnPDF);
  };

  // Tentar imediatamente e também quando a aba financeiro for aberta
  injetar();
  const origShowPage = window.showPage;
  window.showPage = function(page, btn) {
    origShowPage(page, btn);
    if (page === 'financeiro') setTimeout(injetar, 100);
  };
});

window.gerarRelPDF = gerarRelPDF;
