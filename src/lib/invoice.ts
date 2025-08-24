import { prisma } from "./db";
import { Prisma, Invoice, InvoiceStatus } from "@prisma/client";

/** Transitions autorisées */
const ALLOWED: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]:     [InvoiceStatus.SENT],
  [InvoiceStatus.SENT]:      [InvoiceStatus.VALIDATED, InvoiceStatus.REFUSED, InvoiceStatus.CANCELLED],
  [InvoiceStatus.VALIDATED]: [InvoiceStatus.CANCELLED],
  [InvoiceStatus.REFUSED]:   [InvoiceStatus.CANCELLED],
  [InvoiceStatus.CANCELLED]: [],
};

function canTransition(from: InvoiceStatus, to: InvoiceStatus) {
  return ALLOWED[from].includes(to);
}

/* ---------------- Helpers nombres & Decimal ---------------- */

function isDecimal(v: unknown): v is Prisma.Decimal {
  return (
    typeof v === "object" &&
    v !== null &&
    "toNumber" in (v as object) &&
    typeof (v as { toNumber?: unknown }).toNumber === "function"
  );
}

/** Prisma.Decimal | string | number | unknown -> number (0 si invalide) */
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (isDecimal(v)) return v.toNumber();
  const n = Number(v as unknown as number);
  return Number.isFinite(n) ? n : 0;
}

/* ---------------- Services ---------------- */

/** Met à jour le statut avec horodatage + raison éventuelle */
export async function updateInvoiceStatus(
  id: string,
  to: InvoiceStatus,
  reason?: string
): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id } });
    if (!inv) throw new Error("Invoice not found");

    if (!canTransition(inv.status, to)) {
      throw new Error(`Transition interdite: ${inv.status} → ${to}`);
    }

    const now = new Date();
    const reasonClean = typeof reason === "string" && reason.trim() ? reason.trim() : undefined;

    const data: Prisma.InvoiceUpdateInput = {
      status: to,
      ...(to === InvoiceStatus.SENT      ? { sentAt: now } : {}),
      ...(to === InvoiceStatus.VALIDATED ? { validatedAt: now } : {}),
      ...(to === InvoiceStatus.REFUSED   ? { refusedAt: now, statusReason: reasonClean ?? null } : {}),
      ...(to === InvoiceStatus.CANCELLED ? { statusReason: reasonClean ?? inv.statusReason ?? null } : {}),
    };

    return tx.invoice.update({ where: { id }, data });
  });
}

/**
 * Finalise/numérote une facture : calcule totaux, pose number + issueDate.
 * Si `tx` est fourni, utilise la transaction appelante. Sinon, ouvre sa propre transaction.
 */
export async function finalizeInvoice(
  id: string,
  tx?: Prisma.TransactionClient
): Promise<Invoice> {
  const run = async (db: Prisma.TransactionClient) => {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.number) return invoice; // déjà finalisée, on renvoie

    // 1) Calcule les totaux depuis les lignes
    const totals = invoice.lines.reduce(
      (acc, l) => {
        acc.sub += toNum(l.lineTotalHt);
        acc.tax += toNum(l.lineTax);
        acc.ttc += toNum(l.lineTotalTtc);
        return acc;
      },
      { sub: 0, tax: 0, ttc: 0 }
    );

    const year = new Date().getFullYear();

    // 2) Incrémente la séquence de façon atomique dans la même transaction
    await db.invoiceSequence.upsert({
      where: { year },
      update: { lastNumber: { increment: 1 } },
      create: { year, lastNumber: 1 },
    });

    const seq = await db.invoiceSequence.findUnique({ where: { year } });
    const next = seq?.lastNumber ?? 1;

    // ex: 2025-F00001
    const number = `${year}-F${String(next).padStart(5, "0")}`;

    // 3) Met à jour la facture
    const updated = await db.invoice.update({
      where: { id },
      data: {
        number,
        issueDate: new Date(),
        subTotal: +totals.sub.toFixed(2),
        taxTotal: +totals.tax.toFixed(2),
        grandTotal: +totals.ttc.toFixed(2),
      },
    });

    return updated;
  };

  return tx ? run(tx) : prisma.$transaction(run);
}

export async function deleteInvoice(id: string) {
  return prisma.invoice.delete({ where: { id } });
}
