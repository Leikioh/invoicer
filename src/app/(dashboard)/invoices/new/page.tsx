import { prisma } from "@/lib/db";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage() {
  const clients = await prisma.client.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, email: true },
  });

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-black">Nouvelle facture</h1>
      <NewInvoiceForm clients={clients} />
    </main>
  );
}
