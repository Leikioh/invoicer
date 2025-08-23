// src/app/page.tsx
import Link from "next/link";
import { prisma } from "../lib/db";
import { InvoiceStatus } from "@prisma/client";

// helper: formate Prisma.Decimal / number / string
function formatAmount(v: unknown) {
  if (v == null) return "—";
  // @ts-ignore Prisma.Decimal possède .toNumber()
  const n = typeof v === "object" && v?.toNumber ? (v as any).toNumber() : Number(v);
  if (Number.isNaN(n)) return "—";
  return `${n.toFixed(2)} €`;
}

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

export default async function Home() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  const last = invoices.slice(0, 5);
  const totalCount = invoices.length;
  // "À encaisser" = factures envoyées (SENT)
  const toCollect = invoices.filter(i => i.status === InvoiceStatus.SENT).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Bienvenue sur Invoicer</h1>
          <p className="text-sm text-gray-600">Gère tes clients et factures en un clin d’œil.</p>
        </div>
        <Link href="/invoices/new" className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90">
          + Nouvelle facture
        </Link>
      </section>

      {/* KPI cards (même style que le reste) */}
      <section className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Factures</div>
          <div className="mt-1 text-2xl text-black font-semibold">{totalCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">À encaisser</div>
          <div className="mt-1 text-2xl text-black font-semibold">{toCollect}</div>
        </div>
        <Link href="/clients" className="rounded-lg border bg-white p-4 hover:bg-gray-50 shadow-sm">
          <div className="text-sm text-gray-500">Clients</div>
          <div className="mt-1 text-base text-black font-medium underline">Gérer les clients →</div>
        </Link>
      </section>

      {/* Dernières factures (table comme /invoices) */}
      <section className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-medium text-black">Dernières factures</h2>
          <Link href="/invoices" className="text-sm underline">Voir tout</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
              <tr className="text-left border-b">
                <th className="py-2 text-black px-4">Numéro</th>
                <th className="px-4 text-black">Client</th>
                <th className="px-4 text-black">Statut</th>
                <th className="px-4 text-black">Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {last.length === 0 && (
                <tr>
                  <td className="py-6 px-4 text-gray-600" colSpan={4}>
                    Aucune facture pour le moment.
                  </td>
                </tr>
              )}
              {last.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-gray-50">
                  <td className="py-2 px-4 font-medium text-black">{inv.number ?? "(brouillon)"}</td>
                  <td className="px-4 text-black">{inv.customer?.displayName ?? "—"}</td>
                  <td className="px-4"><Badge s={inv.status} /></td>
                  <td className="px-4 font-semibold text-black">{formatAmount(inv.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Shortcuts */}
      <section className="flex flex-wrap gap-3">
        <Link href="/invoices" className="px-3 py-2 rounded-lg border text-black bg-white hover:bg-gray-50 shadow-sm">
          📄 Liste des factures
        </Link>
        <Link href="/invoices/new" className="px-3 py-2 rounded-lg border text-black bg-white hover:bg-gray-50 shadow-sm">
          ➕ Créer une facture
        </Link>
        <Link href="/clients" className="px-3 py-2 rounded-lg border text-black bg-white hover:bg-gray-50 shadow-sm">
          👥 Gérer les clients
        </Link>
      </section>
    </div>
  );
}
