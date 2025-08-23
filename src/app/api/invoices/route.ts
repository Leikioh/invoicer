import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";


export async function GET() {
const invoices = await prisma.invoice.findMany({
orderBy: { createdAt: "desc" },
include: { customer: true },
});
return NextResponse.json(invoices);
}


export async function POST(req: Request) {
const body = await req.json();
const { customerId, lines, dueDate, notes, currency } = body;


const invoice = await prisma.$transaction(async (tx) => {
const created = await tx.invoice.create({
data: { customerId, dueDate: dueDate ? new Date(dueDate) : null, notes, currency },
});


for (const l of lines as any[]) {
const qty = Number(l.quantity);
const up = Number(l.unitPrice);
const rate = Number(l.vatRate);
const ht = +(qty * up).toFixed(2);
const tax = +((ht * rate) / 100).toFixed(2);
const ttc = +(ht + tax).toFixed(2);


await tx.invoiceLine.create({
data: {
invoiceId: created.id,
designation: l.designation,
quantity: qty,
unitPrice: up,
vatRate: rate,
lineTotalHt: ht,
lineTax: tax,
lineTotalTtc: ttc,
},
});
}


return created;
});


return NextResponse.json(invoice, { status: 201 });
}