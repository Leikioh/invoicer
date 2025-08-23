import Link from "next/link";
import { prisma } from "@/lib/db";
import { updateInvoiceStatus, deleteInvoice } from "@/lib/invoice";
import { revalidatePath } from "next/cache";
import { InvoiceStatus } from "@prisma/client";
import DeleteInvoiceButton from "./DeleteInvoiceButton";

function formatAmount(v: unknown) {
  if (v == null) return "—";
  // @ts-ignore Prisma.Decimal
  const n = typeof v === "object" && v?.toNumber ? (v as any).toNumber() : Number(v);
  if (Number.isNaN(n)) return "—";
  return `${n.toFixed(2)} €`;
}

async function setStatusAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const raw = String(formData.get("status"));
  const status = InvoiceStatus[raw as keyof typeof InvoiceStatus];
  const reason = (formData.get("reason") as string) || undefined;
  await updateInvoiceStatus(id, status, reason);
  revalidatePath("/invoices");
}

async function deleteInvoiceAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await deleteInvoice(id);
  revalidatePath("/invoices");
}

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  const Badge = ({ s }: { s: string }) => {
    const map: Record<string, string> = {
      DRAFT: "bg-gray-200 text-gray-800",
      SENT: "bg-blue-100 text-blue-700",
      VALIDATED: "bg-green-100 text-green-700",
      REFUSED: "bg-red-100 text-red-700",
      CANCELLED: "bg-yellow-100 text-yellow-800",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${map[s] ?? "bg-gray-200 text-gray-800"}`}>
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
                <td className="px-4 font-semibold text-black">{formatAmount(inv.grandTotal)}</td>
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
