import { prisma } from "@/lib/db";
import NewQuoteForm from "./NewQuoteForm";

export default async function NewQuotePage() {
  const clients = await prisma.client.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, email: true },
  });

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-black">Nouveau devis</h1>
      <NewQuoteForm clients={clients} />
    </main>
  );
}
