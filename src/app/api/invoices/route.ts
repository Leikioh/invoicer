// src/app/api/quotes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------ Types & helpers ------------------ */

type LineInput = {
  designation: string;
  quantity: number | string;
  unitPrice: number | string;
  vatRate: number | string; // en %
};

type Body = {
  customerId: string;
  lines: LineInput[];
  notes?: string | null;
  currency?: string | null;
  expiryDate?: string | Date | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toNumberStrict(v: unknown, fieldName: string): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
      ? Number(v)
      : Number((v as { toString?: () => string })?.toString?.() ?? NaN);

  if (!Number.isFinite(n)) {
    throw new Error(`Champ "${fieldName}" invalide`);
  }
  return n;
}

function normalizeCurrency(c: unknown): string {
  const cur = typeof c === "string" ? c.trim().toUpperCase() : "EUR";
  return cur || "EUR";
}

function parseDateMaybe(d: unknown): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(String(d));
  return Number.isFinite(dt.getTime()) ? dt : null;
}

/* ------------------ Handlers ------------------ */

export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });
    return NextResponse.json(quotes, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Erreur lors du listing des devis" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json();
    if (!isRecord(raw)) {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }

    const { customerId, lines: rawLines, notes, currency, expiryDate } = raw as Body;

    if (!customerId || typeof customerId !== "string") {
      return NextResponse.json({ error: "customerId requis" }, { status: 400 });
    }

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return NextResponse.json({ error: "Au moins une ligne requise" }, { status: 400 });
    }

    const cleanNotes = typeof notes === "string" ? notes.trim().slice(0, 10_000) : null;
    const cur = normalizeCurrency(currency);
    const exp = parseDateMaybe(expiryDate);

    // Valide + calcule chaque ligne
    const lines = rawLines
      .map((l): {
        designation: string;
        quantity: number;
        unitPrice: number;
        vatRate: number;
        lineTotalHt: number;
        lineTax: number;
        lineTotalTtc: number;
      } | null => {
        if (!isRecord(l) || typeof l.designation !== "string") return null;
        const designation = l.designation.trim().slice(0, 500);
        if (!designation) return null;

        const quantity = toNumberStrict(l.quantity, "quantity");
        const unitPrice = toNumberStrict(l.unitPrice, "unitPrice");
        const vatRate = toNumberStrict(l.vatRate, "vatRate");

        if (!(quantity > 0)) return null;
        if (!(unitPrice >= 0)) return null;
        if (!(vatRate >= 0 && vatRate <= 100)) return null;

        const ht = +(quantity * unitPrice).toFixed(2);
        const tax = +((ht * vatRate) / 100).toFixed(2);
        const ttc = +(ht + tax).toFixed(2);

        return { designation, quantity, unitPrice, vatRate, lineTotalHt: ht, lineTax: tax, lineTotalTtc: ttc };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (lines.length === 0) {
      return NextResponse.json({ error: "Lignes invalides" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      // 1) Créer le devis (DRAFT, sans numéro)
      const quote = await tx.quote.create({
        data: {
          customerId,
          notes: cleanNotes,
          currency: cur,
          expiryDate: exp,
        },
      });

      // 2) Insérer les lignes
      await tx.quoteLine.createMany({
        data: lines.map((l) => ({ quoteId: quote.id, ...l })),
      });

      // 3) Calculer les totaux et les stocker sur le devis
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
        data: {
          subTotal: +totals.sub.toFixed(2),
          taxTotal: +totals.tax.toFixed(2),
          grandTotal: +totals.ttc.toFixed(2),
        },
        include: { customer: true },
      });

      return updated;
    });

    // 🔁 Rafraîchir les pages concernées (listes & home)
    revalidatePath("/quotes");
    revalidatePath("/");

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur interne lors de la création du devis" }, { status: 500 });
  }
}
