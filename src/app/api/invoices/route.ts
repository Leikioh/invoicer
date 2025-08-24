import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/* ------------------ Helpers & types ------------------ */

type LineInput = {
  designation: string;
  quantity: number | string;
  unitPrice: number | string;
  vatRate: number | string; // en %
};

type Body = {
  customerId: string;
  lines: LineInput[];
  dueDate?: string | Date | null;
  notes?: string | null;
  currency?: string | null; // ex: "EUR"
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

function parseDueDate(d: unknown): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(String(d));
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function normalizeCurrency(c: unknown): string {
  const cur = typeof c === "string" ? c.trim().toUpperCase() : "EUR";
  return cur || "EUR";
}

/* ------------------ Handlers ------------------ */

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });
  return NextResponse.json(invoices, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json();
    if (!isRecord(raw)) {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }

    const { customerId, lines, dueDate, notes, currency } = raw as Body;

    if (!customerId || typeof customerId !== "string") {
      return NextResponse.json({ error: "customerId manquant ou invalide" }, { status: 400 });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "lines doit être un tableau non vide" }, { status: 400 });
    }

    const due = parseDueDate(dueDate);
    const cur = normalizeCurrency(currency);

    const invoice = await prisma.$transaction(async (tx) => {
      // 1) Crée la facture vide (totaux à 0 au départ)
      const created = await tx.invoice.create({
        data: { customerId, dueDate: due, notes: notes ?? null, currency: cur },
      });

      // 2) Insère les lignes + accumule les totaux
      let subTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;

      for (const l of lines) {
        if (!isRecord(l) || typeof l.designation !== "string" || !l.designation.trim()) {
          throw new Error("Chaque ligne doit contenir un 'designation' non vide");
        }

        const qty = toNumberStrict(l.quantity, "quantity");
        const unit = toNumberStrict(l.unitPrice, "unitPrice");
        const rate = toNumberStrict(l.vatRate, "vatRate"); // %

        const ht = +(qty * unit).toFixed(2);
        const tax = +((ht * rate) / 100).toFixed(2);
        const ttc = +(ht + tax).toFixed(2);

        await tx.invoiceLine.create({
          data: {
            invoiceId: created.id,
            designation: l.designation.trim(),
            quantity: qty,
            unitPrice: unit,
            vatRate: rate,
            lineTotalHt: ht,
            lineTax: tax,
            lineTotalTtc: ttc,
          },
        });

        subTotal += ht;
        taxTotal += tax;
        grandTotal += ttc;
      }

      // 3) Met à jour les totaux sur la facture
      await tx.invoice.update({
        where: { id: created.id },
        data: {
          subTotal: +subTotal.toFixed(2),
          taxTotal: +taxTotal.toFixed(2),
          grandTotal: +grandTotal.toFixed(2),
        },
      });

      // 4) Retourne la facture complète
      const full = await tx.invoice.findUnique({
        where: { id: created.id },
        include: { customer: true, lines: true },
      });

      // Par sécurité (ne devrait pas arriver)
      if (!full) throw new Error("Création facture échouée");
      return full;
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
