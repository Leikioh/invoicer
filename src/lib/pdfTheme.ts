// src/lib/pdfTheme.ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

export type MoneyFmt = (n: number, currency?: string) => string;
export type DateFmt = (d?: Date | null) => string;

export const PALETTE = {
  bg: rgb(0.97, 0.96, 0.94),     // beige clair
  band: rgb(0.11, 0.11, 0.11),   // noir titrage
  text: rgb(0.10, 0.10, 0.10),
  muted: rgb(0.45, 0.45, 0.45),
  tableEven: rgb(0.99, 0.99, 0.99),
  tableHead: rgb(0.94, 0.93, 0.91),
  accent: rgb(0.23, 0.23, 0.23),
};

export const A4 = { w: 595.28, h: 841.89 };

export function sanitizeText(s: string): string {
  // remplace les espaces fines insécables non supportées par Helvetica WinAnsi
  return s.replace(/\u202F/g, " ").replace(/\u00A0/g, " ");
}

export async function initDoc(): Promise<{ pdf: PDFDocument; page: PDFPage; font: PDFFont; bold: PDFFont }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  return { pdf, page, font, bold };
}

export function drawTopBand(page: PDFPage): void {
  page.drawRectangle({ x: 0, y: A4.h - 46, width: A4.w, height: 46, color: PALETTE.band });
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: PALETTE.bg, opacity: 0.15 });
}

export async function tryDrawLogo(pdf: PDFDocument, page: PDFPage, margin = 40): Promise<void> {
  try {
    const p = path.join(process.cwd(), "public", "logo.png");
    const buf = await fs.readFile(p);
    const png = await pdf.embedPng(new Uint8Array(buf));
    const h = 28;
    const w = (png.width / png.height) * h;
    page.drawImage(png, { x: margin, y: A4.h - 40 - h, width: w, height: h });
  } catch {
    // pas de logo -> rien
  }
}

export function drawTitle(page: PDFPage, bold: PDFFont, title: string, margin = 40): void {
  page.drawText(sanitizeText(title), {
    x: margin,
    y: A4.h - 80,
    size: 20,
    font: bold,
    color: PALETTE.text,
  });
}

export function drawCompanyBlock(page: PDFPage, font: PDFFont, lines: string[], margin = 40): number {
  const y = A4.h - 110;
  lines.forEach((t, i) => {
    page.drawText(sanitizeText(t), { x: margin, y: y - i * 12, size: 10, font, color: PALETTE.text });
  });
  return y - lines.length * 12 - 8;
}

export function drawClientBlock(page: PDFPage, font: PDFFont, lines: string[], x: number, yStart: number): void {
  lines.forEach((t, i) => {
    page.drawText(sanitizeText(t), { x, y: yStart - i * 12, size: 10, font, color: PALETTE.text });
  });
}

export function drawMeta(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  rows: Array<[string, string]>,
  x: number,
  y: number
): number {
  rows.forEach(([k, v], i) => {
    page.drawText(sanitizeText(k + " :"), { x, y: y - i * 14, size: 10, font: bold, color: PALETTE.text });
    page.drawText(sanitizeText(v), { x: x + 120, y: y - i * 14, size: 10, font, color: PALETTE.text });
  });
  return y - rows.length * 14 - 10;
}

export type Col = { key: string; title: string; width: number; align?: "left" | "right" };

export function drawTableHeader(page: PDFPage, bold: PDFFont, cols: Col[], x: number, y: number): number {
  const h = 24;
  const totalW = cols.reduce((a, c) => a + c.width, 0);
  page.drawRectangle({ x, y: y - h + 2, width: totalW, height: h, color: PALETTE.tableHead });
  let cx = x;
  cols.forEach((c) => {
    drawCell(page, bold, c.title, cx, y - 16, c.width, c.align ?? "left", true);
    cx += c.width;
  });
  return y - h;
}

/**
 * Dessine une cellule de tableau.
 * NB: on choisit déjà la bonne police (regular/bold) à l’appel,
 * le paramètre `_bold` est conservé pour compat avec les appels et éviter les warnings lint.
 */
export function drawCell(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right" = "left",
  _bold = false,
  size = 10
): void {
  const pad = 6;
  const safe = sanitizeText(text);
  const textWidth = font.widthOfTextAtSize(safe, size);
  const tx = align === "left" ? x + pad : x + width - pad - textWidth;
  page.drawText(safe, { x: tx, y, size, font, color: PALETTE.text });
}

export function ensureSpace(pdf: PDFDocument, pageRef: { page: PDFPage }, yRef: { y: number }, minY = 120): void {
  if (yRef.y < minY) {
    drawFooter(pageRef.page);
    pageRef.page = pdf.addPage([A4.w, A4.h]);
    drawTopBand(pageRef.page);
    yRef.y = A4.h - 80;
  }
}

export function drawFooter(page: PDFPage, margin = 40): void {
  page.drawText(sanitizeText("Merci pour votre confiance."), {
    x: margin,
    y: 28,
    size: 9,
    color: PALETTE.muted,
  });
}
