import { NextResponse } from "next/server";
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

/* ---------- Helpers ---------- */

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

/* Types pour le tableau */
type Row = {
  designation: string;
  quantity: string;
  unitPrice: string;
  lineTotalHt: string;
  lineTax: string;
};

type ColAlign = "left" | "right";
type ColDef = { key: keyof Row; title: string; width: number; align?: ColAlign };

/* ---------- Route ---------- */

type RouteCtx = { params: { id: string } };

export async function GET(_req: Request, { params }: RouteCtx) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: true, lines: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  const { pdf, page, font, bold } = await initDoc();
  drawTopBand(page);
  await tryDrawLogo(pdf, page);

  drawTitle(page, bold, `FACTURE ${invoice.number ?? ""}`);

  // Blocs société & client
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
      invoice.customer?.displayName ?? "Client",
      invoice.customer?.billingStreet ?? "",
      [invoice.customer?.billingZip, invoice.customer?.billingCity]
        .filter(Boolean)
        .join(" "),
      invoice.customer?.email ?? "",
      invoice.customer?.siret ? `SIRET: ${invoice.customer.siret}` : "",
      invoice.customer?.vatNumber ? `TVA: ${invoice.customer.vatNumber}` : "",
    ].filter(Boolean),
    A4.w / 2,
    companyY + 12
  );

  let y = drawMeta(
    page,
    font,
    bold,
    [
      ["Date d’émission", fmtDate(invoice.issueDate)],
      ["Échéance", fmtDate(invoice.dueDate)],
      ["Devise", invoice.currency ?? "EUR"],
      ["Statut", invoice.status],
    ],
    40,
    companyY - 8
  );

  // Tableau
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

  for (const l of invoice.lines) {
    ensureSpace(pdf, pageRef, yRef);

    const tableWidth = cols.reduce((acc, c) => acc + c.width, 0);
    pageRef.page.drawRectangle({
      x,
      y: yRef.y - 20 + 2,
      width: tableWidth,
      height: 20,
      color: PALETTE.tableEven,
    });

    const row: Row = {
      designation: l.designation,
      quantity: toNum(l.quantity) % 1 ? toNum(l.quantity).toFixed(2) : toNum(l.quantity).toString(),
      unitPrice: fmtMoney(toNum(l.unitPrice), invoice.currency ?? "EUR"),
      lineTotalHt: fmtMoney(toNum(l.lineTotalHt), invoice.currency ?? "EUR"),
      lineTax: fmtMoney(toNum(l.lineTax), invoice.currency ?? "EUR"),
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
  const sub = toNum(invoice.subTotal as unknown);
  const tvat = toNum(invoice.taxTotal as unknown);
  const ttc = toNum(invoice.grandTotal as unknown);

  const totals: Array<[string, string, boolean]> = [
    ["Sous-total", fmtMoney(sub, invoice.currency ?? "EUR"), false],
    ["TVA", fmtMoney(tvat, invoice.currency ?? "EUR"), false],
    ["TOTAL TTC", fmtMoney(ttc, invoice.currency ?? "EUR"), true],
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
  if (invoice.notes) {
    ensureSpace(pdf, pageRef, yRef);
    pageRef.page.drawText(sanitizeText("Notes :"), {
      x,
      y: yRef.y,
      size: 11,
      font: bold,
      color: PALETTE.text,
    });
    yRef.y -= 14;
    pageRef.page.drawText(sanitizeText(String(invoice.notes)), {
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
  // crée une copie dont .buffer est typé ArrayBuffer
  const ab: ArrayBuffer = bytes.slice().buffer;

  return new NextResponse(ab, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${invoice.number ?? invoice.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
