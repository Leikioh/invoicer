import { prisma } from "@/lib/db";
import NewClientForm from "./NewClientForm";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Clients</h1>
        {/* Bouton + formulaire dans le composant client */}
        <NewClientForm />
      </div>

      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
            <tr>
              <th className="py-2 px-4 text-left">Nom</th>
              <th className="px-4 text-left">Email</th>
              <th className="px-4 text-left">Téléphone</th>
              <th className="px-4 text-left">Adresse</th>
              <th className="px-4 text-left">SIRET</th>
              <th className="px-4 text-left">TVA</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td className="py-6 px-4 text-gray-600" colSpan={6}>
                  Aucun client pour le moment.
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="py-2 px-4 font-medium text-black">{c.displayName}</td>
                <td className="px-4 text-black">{c.email ?? "—"}</td>
                <td className="px-4 text-black">{c.phone ?? "—"}</td>
                <td className="px-4 text-black">{c.billingStreet ?? "—"}</td>
                <td className="px-4 text-black">{c.siret ?? "—"}</td>
                <td className="px-4 text-black">{c.vatNumber ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
