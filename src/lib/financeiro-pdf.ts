/**
 * Geração de PDF do relatório financeiro (client-side).
 * Usa pdf-lib (pure JS, sem dependências nativas).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Registro = {
  id: number;
  motorista_codigo: string;
  motorista: string | null;
  valor: number;
  tipo: string;
  operador: string | null;
  data: string;
  dia_op: string | null;
};

type RankItem = {
  codigo: string;
  motorista: string;
  total: number;
  diarias: number;
  extras: number;
  qtd: number;
};

export type RelatorioInput = {
  de: string;
  ate: string;
  registros: Registro[];
  total: number;
  totalDiarias: number;
  totalExtras: number;
  ranking: RankItem[];
};

const brl = (v: number) =>
  "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

const formatarData = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const formatarDia = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

export async function gerarPdfFinanceiro(input: RelatorioInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const pageW = 595.28; // A4
  const pageH = 841.89;
  const contentW = pageW - margin * 2;

  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const gold = rgb(0.97, 0.78, 0);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.45, 0.45, 0.45);
  const line = rgb(0.85, 0.85, 0.85);

  const novaPaginaSeNec = (precisa: number) => {
    if (y - precisa < margin) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  const texto = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(s, {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.bold ? fontBold : font,
      color: opts.color ?? ink,
    });
  };

  // ─── Cabeçalho ───
  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: contentW,
    height: 50,
    color: rgb(0.07, 0.07, 0.07),
  });
  texto("Rota 013", margin + 16, y - 22, { size: 18, bold: true, color: rgb(1, 1, 1) });
  texto("Relatório Financeiro", margin + 16, y - 40, { size: 11, color: gold });

  const periodo = `Período: ${formatarDia(input.de)} a ${formatarDia(input.ate)}`;
  const periodoW = fontBold.widthOfTextAtSize(periodo, 10);
  texto(periodo, margin + contentW - periodoW - 16, y - 22, {
    size: 10,
    bold: true,
    color: rgb(1, 1, 1),
  });
  const emitido = "Emitido em " + new Date().toLocaleString("pt-BR");
  const emitW = font.widthOfTextAtSize(emitido, 9);
  texto(emitido, margin + contentW - emitW - 16, y - 40, { size: 9, color: rgb(0.8, 0.8, 0.8) });

  y -= 70;

  // ─── Totais ───
  const cards = [
    { label: "Total geral", valor: brl(input.total) },
    { label: "Diárias", valor: brl(input.totalDiarias) },
    { label: "Extras", valor: brl(input.totalExtras) },
    { label: "Lançamentos", valor: String(input.registros.length) },
  ];
  const cardW = (contentW - 30) / 4;
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + 10);
    page.drawRectangle({
      x,
      y: y - 50,
      width: cardW,
      height: 50,
      color: rgb(0.96, 0.96, 0.96),
      borderColor: line,
      borderWidth: 0.5,
    });
    texto(c.label.toUpperCase(), x + 10, y - 18, { size: 8, color: muted, bold: true });
    texto(c.valor, x + 10, y - 38, { size: 13, bold: true });
  });
  y -= 70;

  // ─── Ranking ───
  texto("Ranking por motorista", margin, y, { size: 12, bold: true });
  y -= 16;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentW, y },
    color: line,
    thickness: 0.5,
  });
  y -= 14;

  // header
  texto("#", margin, y, { size: 9, bold: true, color: muted });
  texto("MOTORISTA", margin + 25, y, { size: 9, bold: true, color: muted });
  texto("QTD", margin + 240, y, { size: 9, bold: true, color: muted });
  texto("DIÁRIAS", margin + 290, y, { size: 9, bold: true, color: muted });
  texto("EXTRAS", margin + 370, y, { size: 9, bold: true, color: muted });
  texto("TOTAL", margin + 450, y, { size: 9, bold: true, color: muted });
  y -= 12;

  input.ranking.forEach((r, i) => {
    novaPaginaSeNec(16);
    texto(String(i + 1), margin, y, { size: 9 });
    const nome = (r.motorista || r.codigo).slice(0, 32);
    texto(`${nome} (${r.codigo})`, margin + 25, y, { size: 9 });
    texto(String(r.qtd), margin + 240, y, { size: 9 });
    texto(brl(r.diarias), margin + 290, y, { size: 9 });
    texto(brl(r.extras), margin + 370, y, { size: 9 });
    texto(brl(r.total), margin + 450, y, { size: 9, bold: true });
    y -= 14;
  });

  if (input.ranking.length === 0) {
    texto("Sem lançamentos no período.", margin + 25, y, { size: 9, color: muted });
    y -= 14;
  }

  y -= 12;

  // ─── Lançamentos ───
  novaPaginaSeNec(40);
  texto("Lançamentos", margin, y, { size: 12, bold: true });
  y -= 16;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentW, y },
    color: line,
    thickness: 0.5,
  });
  y -= 14;

  // Colunas (x inicial → largura útil até a próxima coluna)
  const COL = {
    data:  { x: margin,        max: 90  },
    mot:   { x: margin + 95,   max: 140 },
    tipo:  { x: margin + 240,  max: 130 },
    oper:  { x: margin + 375,  max: 90  },
    valor: { x: margin + 470,  max: 45  },
  };

  // Trunca a string para caber em maxW (px) na fonte 9.
  const fit = (s: string, maxW: number, size = 9) => {
    if (!s) return "";
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = ((lo + hi) >> 1) + 1;
      const candidato = s.slice(0, mid) + "…";
      if (font.widthOfTextAtSize(candidato, size) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return s.slice(0, lo) + "…";
  };

  texto("DATA",      COL.data.x,  y, { size: 9, bold: true, color: muted });
  texto("MOTORISTA", COL.mot.x,   y, { size: 9, bold: true, color: muted });
  texto("TIPO",      COL.tipo.x,  y, { size: 9, bold: true, color: muted });
  texto("OPERADOR",  COL.oper.x,  y, { size: 9, bold: true, color: muted });
  texto("VALOR",     COL.valor.x, y, { size: 9, bold: true, color: muted });
  y -= 12;

  for (const r of input.registros) {
    novaPaginaSeNec(16);
    texto(fit(formatarData(r.data), COL.data.max), COL.data.x, y, { size: 9 });
    texto(fit(r.motorista || r.motorista_codigo, COL.mot.max), COL.mot.x, y, { size: 9 });
    texto(fit(r.tipo, COL.tipo.max), COL.tipo.x, y, { size: 9 });
    texto(fit(r.operador ?? "—", COL.oper.max), COL.oper.x, y, { size: 9 });
    texto(brl(Number(r.valor)), COL.valor.x, y, { size: 9, bold: true });
    y -= 13;
  }

  if (input.registros.length === 0) {
    texto("Sem lançamentos no período.", margin, y, { size: 9, color: muted });
  }

  return pdf.save();
}

export function baixarPdf(bytes: Uint8Array, nome: string) {
  // Cópia para garantir ArrayBuffer "puro" (alguns ambientes retornam SharedArrayBuffer)
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  const blob = new Blob([copia.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
