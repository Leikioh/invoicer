import Link from "next/link";
import { prisma } from "@/lib/db";
import { updateInvoiceStatus, deleteInvoice } from "@/lib/invoice";
import { revalidatePath } from "next/cache";
import { InvoiceStatus } from "@prisma/client";
import DeleteInvoiceButton from "./DeleteInvoiceButton";
import { unstable_noStore as noStore } from "next/cache";

export const runtime = "nodejs";
export const revalidate = 0; // ou: export const dynamic = "force-dynamic";


/** Type guard: valeur avec une méthode toNumber() (ex: Prisma.Decimal) */
function hasToNumber(v: unknown): v is { toNumber: () => number } {
  return (
    typeof v === "object" &&
    v !== null &&
    "toNumber" in v &&
    typeof (v as { toNumber?: unknown }).toNumber === "function"
  );
}

/** Formatte montants: supporte number | Prisma.Decimal | string | null/undefined */
function formatAmount(v: unknown): string {
  if (v == null) return "—";
  let n: number | null = null;

  if (typeof v === "number") n = v;
  else if (hasToNumber(v)) n = v.toNumber();
  else {
    const parsed = Number(v);
    n = Number.isFinite(parsed) ? parsed : null;
  }

  if (n === null) return "—";
  return `${n.toFixed(2)} €`;
}

// ----- Server Actions -----

async function setStatusAction(formData: FormData) {
  "use server";
  const idRaw = formData.get("id");
  const statusRaw = formData.get("status");
  const reasonRaw = formData.get("reason");

  const id = typeof idRaw === "string" ? idRaw : "";
  const statusKey = typeof statusRaw === "string" ? statusRaw : "";

  const status = InvoiceStatus[statusKey as keyof typeof InvoiceStatus];
  const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw : undefined;

  if (!id || !status) return;

  await updateInvoiceStatus(id, status, reason);
  revalidatePath("/invoices");
}

async function deleteInvoiceAction(formData: FormData) {
  "use server";
  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" ? idRaw : "";
  if (!id) return;
  await deleteInvoice(id);
  revalidatePath("/invoices");
}

// ----- Page -----

export default async function Page() {
  noStore();
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  const Badge: React.FC<{ s: InvoiceStatus }> = ({ s }) => {
    const map: Record<InvoiceStatus, string> = {
      DRAFT: "bg-gray-200 text-gray-800",
      SENT: "bg-blue-100 text-blue-700",
      VALIDATED: "bg-green-100 text-green-700",
      REFUSED: "bg-red-100 text-red-700",
      CANCELLED: "bg-yellow-100 text-yellow-800",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${map[s]}`}>
        {s}
      </span>
    );
  };

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-black">Factures</h1>
      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
            <tr>
              <th className="py-2 px-4 text-left">Numéro</th>
              <th className="px-4 text-left">Client</th>
              <th className="px-4 text-left">Statut</th>
              <th className="px-4 text-left">Montant TTC</th>
              <th className="px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td className="py-6 px-4 text-gray-600" colSpan={5}>
                  Aucune facture.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="py-2 px-4 font-medium text-black">
                  {inv.number ?? "(brouillon)"}
                </td>
                <td className="px-4 text-black">{inv.customer?.displayName ?? "—"}</td>
                <td className="px-4"><Badge s={inv.status} /></td>
                <td className="px-4 font-semibold text-black">
                  {formatAmount(inv.grandTotal as unknown)}
                </td>
                <td className="px-4">
                  <div className="flex flex-wrap gap-2">
                    {/* Statuts */}
                    {inv.status === "DRAFT" && (
                      <form action={setStatusAction}>
                        <input type="hidden" name="id" value={inv.id} />
                        <input type="hidden" name="status" value="SENT" />
                        <button className="px-2 py-1 text-blue-500 rounded border hover:bg-gray-50">
                          Envoyer
                        </button>
                      </form>
                    )}

                    {inv.status === "SENT" && (
                      <>
                        <form action={setStatusAction}>
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="status" value="VALIDATED" />
                          <button className="px-2 py-1 text-green-600 rounded border hover:bg-green-100">
                            Valider
                          </button>
                        </form>

                        <form action={setStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="status" value="REFUSED" />
                          <button className="px-2 py-1 text-red-700 rounded border hover:bg-red-100">
                            Refuser
                          </button>
                        </form>
                      </>
                    )}

                    {(inv.status === "REFUSED" || inv.status === "VALIDATED") && (
                      <form action={setStatusAction}>
                        <input type="hidden" name="id" value={inv.id} />
                        <input type="hidden" name="status" value="CANCELLED" />
                        <button className="px-2 py-1 text-yellow-500 rounded border hover:bg-gray-50">
                          Annuler
                        </button>
                      </form>
                    )}

                    {/* PDF */}
                    <Link
                      href={`/api/invoices/${inv.id}/pdf`}
                      target="_blank"
                      className="px-2 py-1 rounded border text-blue-600 hover:bg-blue-50"
                    >
                      PDF
                    </Link>

                    {/* Supprimer (confirm côté client) */}
                    <DeleteInvoiceButton id={inv.id} action={deleteInvoiceAction} />
                  </div>

                  {inv.status === "REFUSED" && inv.statusReason && (
                    <div className="text-xs text-red-700 mt-1">Raison: {inv.statusReason}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
