"use client";
import { useEffect, useMemo, useState } from "react";


type Client = { id: string; displayName: string };


type Line = { designation: string; quantity: number; unitPrice: number; vatRate: number };


export default function NewInvoice() {
const [clients, setClients] = useState<Client[]>([]);
const [customerId, setCustomerId] = useState("");
const [lines, setLines] = useState<Line[]>([{ designation: "", quantity: 1, unitPrice: 0, vatRate: 20 }]);


useEffect(() => { (async () => {
const res = await fetch("/api/clients", { cache: "no-store" });
setClients(await res.json());
})(); }, []);


const totals = useMemo(() => {
const sub = lines.reduce((a,l)=> a + +(l.quantity*l.unitPrice).toFixed(2), 0);
const tax = lines.reduce((a,l)=> a + +(((l.quantity*l.unitPrice)*(l.vatRate/100))).toFixed(2), 0);
const ttc = +(sub + tax).toFixed(2);
return { sub: sub.toFixed(2), tax: tax.toFixed(2), ttc: ttc.toFixed(2) };
}, [lines]);


const addLine = () => setLines(ls => [...ls, { designation: "", quantity: 1, unitPrice: 0, vatRate: 20 }]);


const submit = async (e: React.FormEvent) => {
e.preventDefault();
const res = await fetch("/api/invoices", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ customerId, lines })
});
const inv = await res.json();
await fetch(`/api/invoices/${inv.id}/finalize`, { method: "POST" });
window.location.href = "/(dashboard)/invoices";
};


return (
<main className="p-6 space-y-6">
<h1 className="text-xl font-semibold">Nouvelle facture</h1>


<form onSubmit={submit} className="space-y-6">
<div>
<label className="block text-sm mb-1">Client</label>
<select className="border rounded px-3 py-2 w-full" value={customerId} onChange={e=>setCustomerId(e.target.value)} required>
<option value="" disabled>Choisir un client…</option>
{clients.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
</select>
</div>


<div className="space-y-2">
<div className="flex justify-between items-center">
<span className="font-medium">Lignes</span>
<button type="button" onClick={addLine} className="text-sm underline">Ajouter une ligne</button>
</div>
{lines.map((l,i)=> (
<div key={i} className="grid grid-cols-12 gap-2">
<input placeholder="Désignation" className="col-span-5 border rounded px-2 py-1" value={l.designation} onChange={e=>setLines(s=>s.map((x,idx)=> idx===i?{...x, designation:e.target.value}:x))} />
<input type="number" step="0.01" placeholder="Qté" className="col-span-2 border rounded px-2 py-1" value={l.quantity} onChange={e=>setLines(s=>s.map((x,idx)=> idx===i?{...x, quantity:+e.target.value}:x))} />
<input type="number" step="0.01" placeholder="PU" className="col-span-2 border rounded px-2 py-1" value={l.unitPrice} onChange={e=>setLines(s=>s.map((x,idx)=> idx===i?{...x, unitPrice:+e.target.value}:x))} />
<input type="number" step="0.01" placeholder="TVA %" className="col-span-2 border rounded px-2 py-1" value={l.vatRate} onChange={e=>setLines(s=>s.map((x,idx)=> idx===i?{...x, vatRate:+e.target.value}:x))} />
</div>
))}
</div>


<div className="border rounded-lg p-4 bg-gray-50 w-full max-w-md">
<div className="flex justify-between"><span>Sous-total HT</span><span>{totals.sub} €</span></div>
<div className="flex justify-between"><span>TVA</span><span>{totals.tax} €</span></div>
<div className="flex justify-between font-semibold text-lg"><span>Total TTC</span><span>{totals.ttc} €</span></div>
</div>


<button className="px-4 py-2 rounded bg-black text-white">Créer & Finaliser</button>
</form>
</main>
);
}