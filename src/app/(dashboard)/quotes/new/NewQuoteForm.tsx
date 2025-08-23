"use client";

import { useMemo, useState } from "react";

type ClientOpt = { id: string; displayName: string; email: string | null };

export default function NewQuoteForm({ clients }: { clients: ClientOpt[] }) {
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ designation: "", quantity: 1, unitPrice: 0, vatRate: 20 }]);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  const addLine = () => setLines((ls) => [...ls, { designation: "", quantity: 1, unitPrice: 0, vatRate: 20 }]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return alert("Sélectionne un client.");
    if (lines.length === 0 || !lines[0].designation) return alert("Ajoute au moins une ligne.");
    setLoading(true);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, lines, notes }),
    });
    const q = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !q?.id) return alert(q?.error ?? "Erreur");

    // Finalise directement (si tu veux) :
    await fetch(`/api/quotes/${q.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    });

    window.location.href = "/quotes";
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-black bg-white p-4 rounded-lg border shadow-sm">
      {/* Sélection client */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-sm text-black mb-1">Rechercher</label>
          <input
            className="border text-black rounded px-3 py-2 w-full"
            placeholder="Nom ou email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-black mb-1">Client</label>
          <select
            className="border rounded px-3 py-2 w-full bg-white"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
          >
            <option value="">— Sélectionner un client —</option>
            {filtered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName} {c.email ? `· ${c.email}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lignes */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-medium text-black">Lignes</span>
          <button type="button" onClick={addLine} className="text-sm underline">Ajouter une ligne</button>
        </div>

        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              placeholder="Désignation"
              className="col-span-5 border rounded px-2 py-1"
              value={l.designation}
              onChange={(e) => {
                const v = e.target.value;
                setLines((s) => s.map((x, idx) => (idx === i ? { ...x, designation: v } : x)));
              }}
            />
            <input
              type="number" step="0.01" placeholder="Qté"
              className="col-span-2 border rounded px-2 py-1"
              value={l.quantity}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLines((s) => s.map((x, idx) => (idx === i ? { ...x, quantity: v } : x)));
              }}
            />
            <input
              type="number" step="0.01" placeholder="PU"
              className="col-span-2 border rounded px-2 py-1"
              value={l.unitPrice}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLines((s) => s.map((x, idx) => (idx === i ? { ...x, unitPrice: v } : x)));
              }}
            />
            <input
              type="number" step="0.01" placeholder="TVA %"
              className="col-span-2 border rounded px-2 py-1"
              value={l.vatRate}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLines((s) => s.map((x, idx) => (idx === i ? { ...x, vatRate: v } : x)));
              }}
            />
            <button
              type="button"
              className="col-span-1 border rounded px-2 py-1 hover:bg-gray-50"
              onClick={() => setLines((s) => s.filter((_, idx) => idx !== i))}
              aria-label="Supprimer la ligne"
              title="Supprimer la ligne"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm text-black mb-1">Notes</label>
        <textarea
          className="border rounded px-3 py-2 w-full min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Conditions, délais, etc."
        />
      </div>

      <div className="flex justify-end gap-2">
        <a href="/clients" className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50">+ Nouveau client</a>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-60">
          {loading ? "Création..." : "Créer le devis"}
        </button>
      </div>
    </form>
  );
}
