"use client";

export default function DeleteInvoiceButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => void; // Server Action fournie par le parent
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Supprimer définitivement cette facture ?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="px-2 py-1 text-red-600 rounded border hover:bg-red-50">
        Supprimer
      </button>
    </form>
  );
}
