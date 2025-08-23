// src/lib/quote.ts
import { prisma } from "./db";
import { Prisma, $Enums, Quote, Invoice } from "@prisma/client";
import { finalizeInvoice } from "./invoice";

// helper: Prisma.Decimal | string | number -> number
function toNum(v: string | number | Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof (v as Prisma.Decimal).toNumber === "function") {
    return (v as Prisma.Decimal).toNumber();
  }
  return Number(v);
}

/**
 * Numérote un devis + calcule les totaux depuis ses lignes
 */
export async function finalizeQuote(quoteId: string): Promise<Quote> {
  return prisma.$transaction(async (tx) => {
    const q = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { lines: true },
    });
    if (!q) throw new Error("Quote not found");
    if (q.number) return q;

    const totals = q.lines.reduce(
      (acc, l) => {
        acc.sub += toNum(l.lineTotalHt);
        acc.tax += toNum(l.lineTax);
        acc.ttc += toNum(l.lineTotalTtc);
        return acc;
      },
      { sub: 0, tax: 0, ttc: 0 }
    );

    const year = new Date().getFullYear();
    await tx.quoteSequence.upsert({
      where: { year },
      update: {},
      create: { year, lastNumber: 0 },
    });
    const seq = await tx.quoteSequence.findUnique({ where: { year } });
    const next = (seq?.lastNumber ?? 0) + 1;
    await tx.quoteSequence.update({
      where: { year },
      data: { lastNumber: next },
    });

    const number = `${year}-Q${String(next).padStart(5, "0")}`;

    return tx.quote.update({
      where: { id: q.id },
      data: {
        number,
        issueDate: new Date(),
        subTotal: totals.sub,
        taxTotal: totals.tax,
        grandTotal: totals.ttc,
      },
    });
  });
}

/**
 * Met à jour le statut d’un devis (raison optionnelle)
 */
export async function updateQuoteStatus(
  id: string,
  to: $Enums.QuoteStatus,
  reason?: string
): Promise<Quote> {
  const cleanReason =
    typeof reason === "string" ? reason.trim().slice(0, 10_000) : undefined;

  return prisma.quote.update({
    where: { id },
    data: { status: to, notes: cleanReason ?? undefined },
  });
}

/**
 * Convertit un devis ACCEPTED en facture + copie les lignes + FINALISE la facture
 * (tout se fait DANS la même transaction)
 */
export async function convertQuoteToInvoice(quoteId: string): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const q = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { lines: true },
    });
    if (!q) throw new Error("Quote not found");

    if (q.status !== "ACCEPTED") {
      throw new Error("Le devis doit être ACCEPTED.");
    }

    // si déjà liée, renvoyer la facture existante
    if (q.invoiceId) {
      const existing = await tx.invoice.findUnique({ where: { id: q.invoiceId } });
      if (existing) return existing;
    }

    // 1) Créer la facture (DRAFT)
    const inv = await tx.invoice.create({
      data: {
        customerId: q.customerId,
        status: "DRAFT", // string literal pour robustesse runtime
        currency: q.currency,
        notes: `Issue du devis ${q.number ?? ""}`.trim(),
      },
    });

    // 2) Copier les lignes
    await Promise.all(
      q.lines.map((l) =>
        tx.invoiceLine.create({
          data: {
            invoiceId: inv.id,
            designation: l.designation,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            lineTotalHt: l.lineTotalHt,
            lineTax: l.lineTax,
            lineTotalTtc: l.lineTotalTtc,
          },
        })
      )
    );

    // 3) Finaliser/numéroter la facture **dans la transaction**
    const invFinal = await finalizeInvoice(inv.id, tx);

    // 4) Lier le devis à la facture
    await tx.quote.update({
      where: { id: q.id },
      data: { invoiceId: invFinal.id },
    });

    return invFinal;
  });
}
