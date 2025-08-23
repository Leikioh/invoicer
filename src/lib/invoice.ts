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

/** Helper: Prisma.Decimal | string | number -> number */
function toNum(v: string | number | Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  // @ts-ignore .toNumber() sur Prisma.Decimal
  if (typeof (v as Prisma.Decimal).toNumber === "function") return (v as Prisma.Decimal).toNumber();
  return Number(v);
}

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

    const data: Prisma.InvoiceUpdateInput = {
      status: to,
      ...(to === InvoiceStatus.SENT      ? { sentAt: now } : {}),
      ...(to === InvoiceStatus.VALIDATED ? { validatedAt: now } : {}),
      ...(to === InvoiceStatus.REFUSED   ? { refusedAt: now, statusReason: reason ?? null } : {}),
      ...(to === InvoiceStatus.CANCELLED ? { statusReason: reason ?? inv.statusReason ?? null } : {}),
    };

    return tx.invoice.update({ where: { id }, data });
  });
}

/**
 * Finalise/numérote une facture : calcule totaux, pose number + issueDate.
 * ⚠️ Accepte un client de transaction pour être appelée à l'intérieur d'un prisma.$transaction.
 */
export async function finalizeInvoice(
  id: string,
  tx?: Prisma.TransactionClient
): Promise<Invoice> {
  const db = tx ?? prisma;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.number) return invoice; // déjà finalisée

  // calcule totaux depuis les lignes stockées
  const totals = invoice.lines.reduce(
    (acc, l) => {
      acc.sub += toNum(l.lineTotalHt);
      acc.tax += toNum(l.lineTax);
      acc.ttc += toNum(l.lineTotalTtc);
      return acc;
    },
    { sub: 0, tax: 0, ttc: 0 }
  );

  // séquence annuelle (MySQL)
  const year = new Date().getFullYear();
  await db.invoiceSequence.upsert({
    where: { year },
    update: {},
    create: { year, lastNumber: 0 },
  });
  const current = await db.invoiceSequence.findUnique({ where: { year } });
  const next = (current?.lastNumber ?? 0) + 1;
  await db.invoiceSequence.update({ where: { year }, data: { lastNumber: next } });

  // ex: 2025-F00001 (ajoute le préfixe que tu préfères)
  const number = `${year}-F${String(next).padStart(5, "0")}`;

  return db.invoice.update({
    where: { id },
    data: {
      number,
      issueDate: new Date(),
      subTotal: totals.sub,
      taxTotal: totals.tax,
      grandTotal: totals.ttc,
    },
  });
}

export async function deleteInvoice(id: string) {
  return prisma.invoice.delete({ where: { id } });
}
