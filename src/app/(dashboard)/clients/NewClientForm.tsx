"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CreateClientPayload = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  siret?: string | null;
  billingStreet?: string | null;
  billingZip?: string | null;
  billingCity?: string | null;
};

export default function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState(""); // mappé vers billingStreet
  const [siret, setSiret] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // petite validation côté client
    if (siret && !/^\d{14}$/.test(siret)) {
      alert("SIRET invalide (14 chiffres attendus)");
      return;
    }

    const payload: CreateClientPayload = {
      displayName: displayName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      vatNumber: vatNumber.trim() || null,
      siret: siret.trim() || null,
      billingStreet: address.trim() || null, // ⬅️ important: correspond au schéma/API
      // billingZip: null,
      // billingCity: null,
    };

    setLoading(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      const err: unknown = await res.json().catch(() => ({}));
      const msg =
        typeof err === "object" && err && "error" in err && typeof (err as { error?: unknown }).error === "string"
          ? (err as { error: string }).error
          : "Erreur lors de la création du client";
      alert(msg);
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
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
        required
      />
      <input
        className="border text-black rounded px-3 py-2"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
      />
      <input
        className="border text-black rounded px-3 py-2"
        placeholder="Téléphone"
        value={phone}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
      />
      <input
        className="border text-black rounded px-3 py-2"
        placeholder="N° TVA"
        value={vatNumber}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVatNumber(e.target.value)}
      />

      {/* Adresse libre -> billingStreet côté API */}
      <input
        className="border text-black rounded px-3 py-2 sm:col-span-2"
        placeholder="Adresse postale"
        value={address}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
      />
      <input
        className="border text-black rounded px-3 py-2 sm:col-span-2"
        placeholder="Numéro de SIRET (14 chiffres)"
        value={siret}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSiret(e.target.value.replace(/\D/g, ""))}
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
