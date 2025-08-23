// src/app/api/quotes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type LineInput = {
  designation: string;
  quantity: number | string;
  unitPrice: number | string;
  vatRate: number | string; // en %
};



export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });
    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json({ error: "Erreur lors du listing des devis" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      customerId?: string;
      lines?: LineInput[];
      notes?: unknown;
      currency?: unknown;
      expiryDate?: unknown;
    };

    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    if (!customerId) return NextResponse.json({ error: "customerId requis" }, { status: 400 });

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length === 0) return NextResponse.json({ error: "Au moins une ligne requise" }, { status: 400 });

    const cleanNotes =
      typeof body.notes === "string" ? body.notes.trim().slice(0, 10_000) : undefined;

    const currency =
      typeof body.currency === "string" && body.currency.trim()
        ? body.currency.trim().slice(0, 8)
        : "EUR";

    const expiryDate =
      typeof body.expiryDate === "string" || body.expiryDate instanceof Date
        ? new Date(body.expiryDate as string)
        : null;

    const lines = rawLines
      .map((l) => {
        const designation =
          typeof l.designation === "string" ? l.designation.trim().slice(0, 500) : "";
        const quantity = Number(l.quantity);
        const unitPrice = Number(l.unitPrice);
        const vatRate = Number(l.vatRate);
        if (!designation || !Number.isFinite(quantity) || quantity <= 0) return null;
        if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
        if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return null;

        const ht = +(quantity * unitPrice).toFixed(2);
        const tax = +((ht * vatRate) / 100).toFixed(2);
        const ttc = +(ht + tax).toFixed(2);

        return { designation, quantity, unitPrice, vatRate, lineTotalHt: ht, lineTax: tax, lineTotalTtc: ttc };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (lines.length === 0) return NextResponse.json({ error: "Lignes invalides" }, { status: 400 });

    const created = await prisma.$transaction(async (tx) => {
      // 1) créer le devis (sans numéro, en DRAFT)
      const quote = await tx.quote.create({
        data: { customerId, notes: cleanNotes, currency, expiryDate: expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : null },
      });

      // 2) insérer les lignes
      await tx.quoteLine.createMany({
        data: lines.map((l) => ({ quoteId: quote.id, ...l })),
      });

      // 3) calculer les totaux et les stocker sur le devis (pour affichage immédiat)
      const totals = lines.reduce(
        (acc, l) => {
          acc.sub += l.lineTotalHt;
          acc.tax += l.lineTax;
          acc.ttc += l.lineTotalTtc;
          return acc;
        },
        { sub: 0, tax: 0, ttc: 0 }
      );

      const updated = await tx.quote.update({
        where: { id: quote.id },
        data: { subTotal: totals.sub, taxTotal: totals.tax, grandTotal: totals.ttc },
        include: { customer: true }, // pratique pour le retour client
      });

      return updated;
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur interne lors de la création du devis" }, { status: 500 });
  }
}
