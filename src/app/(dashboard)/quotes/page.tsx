import Link from "next/link";
import { prisma } from "@/lib/db";
import { QuoteStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { finalizeQuote, updateQuoteStatus, convertQuoteToInvoice } from "@/lib/quote";

function fmt(v: unknown) {
  if (v == null) return "—";
  // @ts-ignore Prisma.Decimal
  const n = typeof v === "object" && v?.toNumber ? (v as any).toNumber() : Number(v);
  if (Number.isNaN(n)) return "—";
  return `${n.toFixed(2)} €`;
}

async function finalizeAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await finalizeQuote(id);
  revalidatePath("/quotes");
}

async function statusAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const raw = String(formData.get("status"));
  const to = QuoteStatus[raw as keyof typeof QuoteStatus];
  await updateQuoteStatus(id, to);
  revalidatePath("/quotes");
}

async function convertAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await convertQuoteToInvoice(id);
  revalidatePath("/quotes");
  revalidatePath("/invoices");
}

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  const Badge = ({ s }: { s: string }) => {
    const map: Record<string, string> = {
      DRAFT: "bg-gray-200 text-gray-800",
      SENT: "bg-blue-100 text-blue-700",
      ACCEPTED: "bg-green-100 text-green-700",
      REFUSED: "bg-red-100 text-red-700",
      CANCELLED: "bg-yellow-100 text-yellow-800",
    };
    return <span className={`px-2 py-1 text-xs rounded-full ${map[s] ?? "bg-gray-200 text-gray-800"}`}>{s}</span>;
  };

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Devis</h1>
        <Link
          href="/quotes/new"
          className="px-3 py-2 rounded-lg border text-black bg-white hover:bg-gray-50 shadow-sm"
        >
          + Nouveau devis
        </Link>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
            <tr>
              <th className="py-2 px-4 text-left">Numéro</th>
              <th className="px-4 text-left">Client</th>
              <th className="px-4 text-left">Statut</th>
              <th className="px-4 text-left">Total TTC</th>
              <th className="px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr>
                <td className="py-6 px-4 text-gray-600" colSpan={5}>
                  Aucun devis.
                </td>
              </tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id} className="border-t">
                <td className="py-2 px-4 font-medium text-black">{q.number ?? "(brouillon)"}</td>
                <td className="px-4 text-black">{q.customer?.displayName ?? "—"}</td>
                <td className="px-4">
                  <Badge s={q.status} />
                </td>
                <td className="px-4 font-semibold text-black">{fmt(q.grandTotal)}</td>
                <td className="px-4">
                  <div className="flex flex-wrap gap-2">
                    {/* PDF */}
                    <Link
                      href={`/api/quotes/${q.id}/pdf`}
                      target="_blank"
                      className="px-2 py-1 rounded border text-blue-600 hover:bg-blue-50"
                    >
                      PDF
                    </Link>

                    {!q.number && (
                      <form action={finalizeAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <button className="px-2 py-1 text-blue-700 rounded border hover:bg-gray-50">
                          Finaliser
                        </button>
                      </form>
                    )}

                    {q.status === "DRAFT" && (
                      <form action={statusAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <input type="hidden" name="status" value="SENT" />
                        <button className="px-2 py-1 text-blue-600 rounded border hover:bg-blue-50">
                          Envoyer
                        </button>
                      </form>
                    )}

                    {q.status === "SENT" && (
                      <>
                        <form action={statusAction}>
                          <input type="hidden" name="id" value={q.id} />
                          <input type="hidden" name="status" value="ACCEPTED" />
                          <button className="px-2 py-1 text-green-600 rounded border hover:bg-green-100">
                            Accepter
                          </button>
                        </form>
                        <form action={statusAction}>
                          <input type="hidden" name="id" value={q.id} />
                          <input type="hidden" name="status" value="REFUSED" />
                          <button className="px-2 py-1 text-red-700 rounded border hover:bg-red-100">
                            Refuser
                          </button>
                        </form>
                      </>
                    )}

                    {q.status === "ACCEPTED" && (
                      <form action={convertAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <button className="px-2 py-1 text-green-600 rounded border hover:bg-gray-50">
                          → Créer la facture
                        </button>
                      </form>
                    )}

                    {(q.status === "REFUSED" || q.status === "ACCEPTED") && (
                      <form action={statusAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <input type="hidden" name="status" value="CANCELLED" />
                        <button className="px-2 py-1 text-yellow-600 rounded border hover:bg-yellow-50">
                          Annuler
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
