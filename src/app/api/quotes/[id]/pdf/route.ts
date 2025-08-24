import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  initDoc,
  drawTopBand,
  tryDrawLogo,
  drawTitle,
  drawCompanyBlock,
  drawClientBlock,
  drawMeta,
  drawTableHeader,
  drawCell,
  drawFooter,
  ensureSpace,
  PALETTE,
  A4,
  sanitizeText,
} from "@/lib/pdfTheme";
import { rgb } from "pdf-lib";

export const runtime = "nodejs";

/* ---------------- Helpers & types ---------------- */

function hasToNumber(v: unknown): v is { toNumber: () => number } {
  return (
    typeof v === "object" &&
    v !== null &&
    "toNumber" in v &&
    typeof (v as { toNumber?: unknown }).toNumber === "function"
  );
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (hasToNumber(v)) return v.toNumber();
  return Number(v);
}

const fmtMoney = (n: number, c = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: c }).format(n);

const fmtDate = (d?: Date | null) =>
  d ? new Intl.DateTimeFormat("fr-FR").format(d) : "—";

type Row = {
  designation: string;
  quantity: string;
  unitPrice: string;
  lineTotalHt: string;
  lineTax: string;
};

type ColAlign = "left" | "right";
type ColDef = { key: keyof Row; title: string; width: number; align?: ColAlign };

type RouteCtx = { params: Promise<{ id: string }> };

/* ---------------- Route ---------------- */

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, lines: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  const { pdf, page, font, bold } = await initDoc();
  drawTopBand(page);
  await tryDrawLogo(pdf, page);

  drawTitle(page, bold, `DEVIS ${quote.number ?? ""}`);

  const companyY = drawCompanyBlock(page, font, [
    "Plaut Luke",
    "2 rue André Huot",
    "51510 Fagnières",
    "SIRET: 123 456 789 00010",
    "TVA: FR12 123456789",
  ]);

  drawClientBlock(
    page,
    font,
    [
      quote.customer?.displayName ?? "Client",
      quote.customer?.billingStreet ?? "",
      [quote.customer?.billingZip, quote.customer?.billingCity].filter(Boolean).join(" "),
      quote.customer?.email ?? "",
      quote.customer?.siret ? `SIRET: ${quote.customer.siret}` : "",
      quote.customer?.vatNumber ? `TVA: ${quote.customer.vatNumber}` : "",
    ].filter(Boolean),
    A4.w / 2,
    companyY + 12
  );

  let y = drawMeta(
    page,
    font,
    bold,
    [
      ["Date d’émission", fmtDate(quote.issueDate)],
      ["Validité jusqu’au", fmtDate(quote.expiryDate)],
      ["Devise", quote.currency ?? "EUR"],
      ["Statut", quote.status],
    ],
    40,
    companyY - 8
  );

  const cols: ColDef[] = [
    { key: "designation", title: "Désignation", width: 260 },
    { key: "quantity", title: "Qté", width: 60, align: "right" },
    { key: "unitPrice", title: "PU HT", width: 90, align: "right" },
    { key: "lineTotalHt", title: "Total HT", width: 90, align: "right" },
    { key: "lineTax", title: "TVA", width: 60, align: "right" },
  ];
  const x = 40;
  y = drawTableHeader(page, bold, cols, x, y);

  const yRef = { y };
  const pageRef = { page };

  for (const l of quote.lines) {
    ensureSpace(pdf, pageRef, yRef);

    const tableWidth = cols.reduce((a, c) => a + c.width, 0);
    pageRef.page.drawRectangle({
      x,
      y: yRef.y - 20 + 2,
      width: tableWidth,
      height: 20,
      color: PALETTE.tableEven,
    });

    const qty = toNum(l.quantity);
    const row: Row = {
      designation: l.designation,
      quantity: qty % 1 ? qty.toFixed(2) : qty.toString(),
      unitPrice: fmtMoney(toNum(l.unitPrice), quote.currency ?? "EUR"),
      lineTotalHt: fmtMoney(toNum(l.lineTotalHt), quote.currency ?? "EUR"),
      lineTax: fmtMoney(toNum(l.lineTax), quote.currency ?? "EUR"),
    };

    let cx = x;
    for (const c of cols) {
      const value = row[c.key];
      drawCell(
        pageRef.page,
        c.align ? bold : font,
        String(value),
        cx,
        yRef.y - 14,
        c.width,
        c.align ?? "left"
      );
      cx += c.width;
    }
    yRef.y -= 20;
  }

  // Totaux
  yRef.y -= 10;
  const sub = toNum(quote.subTotal as unknown);
  const tvat = toNum(quote.taxTotal as unknown);
  const ttc = toNum(quote.grandTotal as unknown);

  const totals: Array<[string, string, boolean]> = [
    ["Sous-total", fmtMoney(sub, quote.currency ?? "EUR"), false],
    ["TVA", fmtMoney(tvat, quote.currency ?? "EUR"), false],
    ["TOTAL TTC", fmtMoney(ttc, quote.currency ?? "EUR"), true],
  ];

  const rightW = 300;
  const rightX = x + cols.reduce((a, c) => a + c.width, 0) - rightW;

  totals.forEach(([label, val, isBold], idx) => {
    ensureSpace(pdf, pageRef, yRef);
    if (idx === totals.length - 1) {
      pageRef.page.drawLine({
        start: { x: rightX, y: yRef.y },
        end: { x: rightX + rightW, y: yRef.y },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      yRef.y -= 6;
    }
    drawCell(pageRef.page, isBold ? bold : font, label, rightX, yRef.y - 14, rightW - 120, "left", isBold);
    drawCell(pageRef.page, isBold ? bold : font, val, rightX, yRef.y - 14, rightW, "right", isBold);
    yRef.y -= 22;
  });

  // Notes
  if (quote.notes) {
    ensureSpace(pdf, pageRef, yRef);
    pageRef.page.drawText(sanitizeText("Notes :"), {
      x,
      y: yRef.y,
      size: 11,
      font: bold,
      color: PALETTE.text,
    });
    yRef.y -= 14;
    pageRef.page.drawText(sanitizeText(String(quote.notes)), {
      x,
      y: yRef.y,
      size: 10,
      font,
      color: PALETTE.text,
      lineHeight: 12,
      maxWidth: A4.w - x * 2,
    });
    yRef.y -= 48;
  }

  drawFooter(pageRef.page);

  const bytes = await pdf.save();

  // Convertit en ArrayBuffer (pas ArrayBufferLike)
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="devis-${quote.number ?? quote.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
