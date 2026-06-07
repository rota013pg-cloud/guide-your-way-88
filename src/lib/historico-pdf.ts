/**
 * PDF do Histórico com os filtros aplicados.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Registro = {
  id: number;
  cliente: string | null;
  cliente_codigo?: string | null;
  motorista: string | null;
  motorista_codigo: string | null;
  origem: string;
  destino: string | null;
  valor_final: number | string;
  status: string;
  pagamento: string | null;
  criado_em: string;
};

export type HistoricoFiltros = {
  de: string;
  ate: string;
  status: string;
  motorista: string;
  cliente: string;
};

export type HistoricoPdfInput = {
  filtros: HistoricoFiltros;
  registros: Registro[];
  totalValor: number;
  totalFinalizadas: number;
  totalCanceladas: number;
};

const brl = (v: number) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");
const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtDia = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/** Remove caracteres fora do WinAnsi (pdf-lib StandardFonts) — evita erro ao gerar PDF. */
function sanitize(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    // Mantém chars Latin-1 + extras CP1252 (€ … – — • " " ' ' etc.)
    .replace(/[^\x00-\xFF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/g, "");
}

export async function gerarPdfHistorico(input: HistoricoPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 30;
  const pageW = 841.89; // A4 landscape
  const pageH = 595.28;
  const contentW = pageW - margin * 2;

  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const gold = rgb(0.97, 0.78, 0);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.45, 0.45, 0.45);
  const line = rgb(0.85, 0.85, 0.85);

  const novaPag = (h: number) => {
    if (y - h < margin) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  const t = (
    s: string, x: number, yy: number,
    o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(sanitize(s), {
      x, y: yy,
      size: o.size ?? 9,
      font: o.bold ? fontBold : font,
      color: o.color ?? ink,
    });
  };

  const fit = (s: string, maxW: number, size = 9) => {
    s = sanitize(s);
    if (!s) return "";
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = ((lo + hi) >> 1) + 1;
      const cand = s.slice(0, mid) + "...";
      if (font.widthOfTextAtSize(cand, size) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return s.slice(0, lo) + "...";
  };

  // Cabeçalho
  page.drawRectangle({ x: margin, y: y - 50, width: contentW, height: 50, color: rgb(0.07, 0.07, 0.07) });
  t("Rota 013", margin + 16, y - 22, { size: 18, bold: true, color: rgb(1, 1, 1) });
  t("Histórico de Corridas", margin + 16, y - 40, { size: 11, color: gold });
  const periodo = `Período: ${fmtDia(input.filtros.de)} a ${fmtDia(input.filtros.ate)}`;
  const pw = fontBold.widthOfTextAtSize(periodo, 10);
  t(periodo, margin + contentW - pw - 16, y - 22, { size: 10, bold: true, color: rgb(1, 1, 1) });
  const emitido = "Emitido em " + new Date().toLocaleString("pt-BR");
  const ew = font.widthOfTextAtSize(emitido, 9);
  t(emitido, margin + contentW - ew - 16, y - 40, { size: 9, color: rgb(0.8, 0.8, 0.8) });
  y -= 60;

  // Filtros aplicados
  const partes = [
    `Status: ${input.filtros.status || "Todos"}`,
    `Motociclista: ${input.filtros.motorista || "Todos"}`,
    `Cliente: ${input.filtros.cliente || "Todos"}`,
  ];
  t("Filtros — " + partes.join(" · "), margin, y, { size: 9, color: muted });
  y -= 16;

  // Totais
  const cards = [
    { label: "Registros", v: String(input.registros.length) },
    { label: "Finalizadas", v: String(input.totalFinalizadas) },
    { label: "Canceladas", v: String(input.totalCanceladas) },
    { label: "Valor finalizadas", v: brl(input.totalValor) },
  ];
  const cardW = (contentW - 30) / 4;
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + 10);
    page.drawRectangle({
      x, y: y - 44, width: cardW, height: 44,
      color: rgb(0.96, 0.96, 0.96), borderColor: line, borderWidth: 0.5,
    });
    t(c.label.toUpperCase(), x + 10, y - 16, { size: 8, color: muted, bold: true });
    t(c.v, x + 10, y - 34, { size: 12, bold: true });
  });
  y -= 60;

  // Tabela
  const COL = {
    id:    { x: margin,        w: 40 },
    data:  { x: margin + 45,   w: 95 },
    cli:   { x: margin + 145,  w: 150 },
    mot:   { x: margin + 300,  w: 130 },
    rota:  { x: margin + 435,  w: 230 },
    stat:  { x: margin + 670,  w: 60 },
    val:   { x: margin + 735,  w: 50 },
  };

  const header = () => {
    t("#", COL.id.x, y, { bold: true, color: muted });
    t("DATA", COL.data.x, y, { bold: true, color: muted });
    t("CLIENTE", COL.cli.x, y, { bold: true, color: muted });
    t("MOTORISTA", COL.mot.x, y, { bold: true, color: muted });
    t("ROTA", COL.rota.x, y, { bold: true, color: muted });
    t("STATUS", COL.stat.x, y, { bold: true, color: muted });
    t("VALOR", COL.val.x, y, { bold: true, color: muted });
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, color: line, thickness: 0.5 });
    y -= 10;
  };
  header();

  for (const r of input.registros) {
    novaPag(16);
    t("#" + r.id, COL.id.x, y);
    t(fit(fmtData(r.criado_em), COL.data.w), COL.data.x, y);
    t(fit(r.cliente ?? "—", COL.cli.w), COL.cli.x, y);
    const mot = r.motorista
      ? `${r.motorista}${r.motorista_codigo ? ` (${r.motorista_codigo})` : ""}`
      : "—";
    t(fit(mot, COL.mot.w), COL.mot.x, y);
    const rota = `${r.origem}${r.destino ? ` → ${r.destino}` : ""}`;
    t(fit(rota, COL.rota.w), COL.rota.x, y);
    t(fit(r.status, COL.stat.w), COL.stat.x, y);
    t(brl(Number(r.valor_final)), COL.val.x, y, { bold: true });
    y -= 13;
  }

  if (input.registros.length === 0) {
    t("Sem registros no período/filtro selecionado.", margin, y, { color: muted });
  }

  return pdf.save();
}

export function baixarPdf(bytes: Uint8Array, nome: string) {
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
