import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  initDoc, drawTopBand, tryDrawLogo, drawTitle, drawCompanyBlock, drawClientBlock,
  drawMeta, drawTableHeader, drawCell, drawFooter, ensureSpace, PALETTE, A4, sanitizeText
} from "@/lib/pdfTheme";
import { rgb } from "pdf-lib";

function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v.toNumber === "function") return v.toNumber();
  return Number(v);
}
const fmtMoney = (n: number, c = "EUR") => new Intl.NumberFormat("fr-FR", { style: "currency", currency: c }).format(n);
const fmtDate  = (d?: Date | null) => (d ? new Intl.DateTimeFormat("fr-FR").format(d) : "—");

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, lines: true },
  });
  if (!quote) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

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
  drawClientBlock(page, font, [
    quote.customer?.displayName ?? "Client",
    quote.customer?.billingStreet ?? "",
    [quote.customer?.billingZip, quote.customer?.billingCity].filter(Boolean).join(" "),
    quote.customer?.email ?? "",
    quote.customer?.siret ? `SIRET: ${quote.customer.siret}` : "",
    quote.customer?.vatNumber ? `TVA: ${quote.customer.vatNumber}` : "",
  ].filter(Boolean), A4.w / 2, companyY + 12);

  let y = drawMeta(page, font, bold, [
    ["Date d’émission", fmtDate(quote.issueDate)],
    ["Validité jusqu’au", fmtDate(quote.expiryDate)],
    ["Devise", quote.currency ?? "EUR"],
    ["Statut", quote.status],
  ], 40, companyY - 8);

  const cols = [
    { key: "designation", title: "Désignation", width: 260 },
    { key: "quantity", title: "Qté", width: 60, align: "right" as const },
    { key: "unitPrice", title: "PU HT", width: 90, align: "right" as const },
    { key: "lineTotalHt", title: "Total HT", width: 90, align: "right" as const },
    { key: "lineTax", title: "TVA", width: 60, align: "right" as const },
  ];
  const x = 40;
  y = drawTableHeader(page, bold, cols, x, y);

  const yRef = { y };
  const pageRef = { page };

  for (const l of quote.lines) {
    ensureSpace(pdf, pageRef, yRef);
    pageRef.page.drawRectangle({ x, y: yRef.y - 20 + 2, width: cols.reduce((a, c) => a + c.width, 0), height: 20, color: PALETTE.tableEven });

    const row = {
      designation: l.designation,
      quantity: toNum(l.quantity).toFixed(toNum(l.quantity) % 1 ? 2 : 0),
      unitPrice: fmtMoney(toNum(l.unitPrice), quote.currency ?? "EUR"),
      lineTotalHt: fmtMoney(toNum(l.lineTotalHt), quote.currency ?? "EUR"),
      lineTax: fmtMoney(toNum(l.lineTax), quote.currency ?? "EUR"),
    };
    let cx = x;
    for (const c of cols) {
      // @ts-ignore
      drawCell(pageRef.page, c.align ? bold : font, String(row[c.key]), cx, yRef.y - 14, c.width, c.align ?? "left");
      cx += c.width;
    }
    yRef.y -= 20;
  }

  // Totaux
  yRef.y -= 10;
  const sub = toNum(quote.subTotal);
  const tvat = toNum(quote.taxTotal);
  const ttc = toNum(quote.grandTotal);
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
      pageRef.page.drawLine({ start: { x: rightX, y: yRef.y }, end: { x: rightX + rightW, y: yRef.y }, thickness: 1, color: rgb(0, 0, 0) });
      yRef.y -= 6;
    }
    drawCell(pageRef.page, isBold ? bold : font, label, rightX, yRef.y - 14, rightW - 120, "left", isBold);
    drawCell(pageRef.page, isBold ? bold : font, val, rightX, yRef.y - 14, rightW, "right", isBold);
    yRef.y -= 22;
  });

  if (quote.notes) {
    ensureSpace(pdf, pageRef, yRef);
    pageRef.page.drawText(sanitizeText("Notes :"), { x, y: yRef.y, size: 11, font: bold, color: PALETTE.text });
    yRef.y -= 14;
    pageRef.page.drawText(sanitizeText(String(quote.notes)), {
      x, y: yRef.y, size: 10, font, color: PALETTE.text, lineHeight: 12, maxWidth: A4.w - x * 2,
    });
    yRef.y -= 48;
  }

  drawFooter(pageRef.page);

  const bytes = await pdf.save();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="devis-${quote.number ?? quote.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
