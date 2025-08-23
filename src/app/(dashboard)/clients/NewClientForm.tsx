"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState("");
  const [siret, setSiret] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // petite validation côté client
    if (siret && !/^\d{14}$/.test(siret)) {
      alert("SIRET invalide (14 chiffres attendus)");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, email, phone, vatNumber, address, siret }),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Erreur lors de la création du client");
      return;
    }

    // Reset + refresh de la liste
    setDisplayName("");
    setEmail("");
    setPhone("");
    setVatNumber("");
    setAddress("");
    setSiret("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
      >
        + Créer un client
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border text-black rounded-lg shadow-sm p-4 grid sm:grid-cols-2 gap-3"
    >
      <input
        className="border text-black rounded px-3 py-2"
        placeholder="Nom affiché *"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
      <input
        className="border text-black rounded px-3 py-2"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border text-black rounded px-3 py-2"
        placeholder="Téléphone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="border text-black rounded px-3 py-2"
        placeholder="N° TVA"
        value={vatNumber}
        onChange={(e) => setVatNumber(e.target.value)}
      />

      {/* Nouveaux champs */}
      <input
        className="border text-black rounded px-3 py-2 sm:col-span-2"
        placeholder="Adresse postale"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        className="border text-black rounded px-3 py-2 sm:col-span-2"
        placeholder="Numéro de SIRET (14 chiffres)"
        value={siret}
        onChange={(e) => setSiret(e.target.value.replace(/\D/g, ""))} // garde que les chiffres
        maxLength={14}
      />

      <div className="sm:col-span-2 text-black flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-60"
        >
          {loading ? "En cours..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
