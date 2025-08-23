import { NextResponse } from "next/server";
import { finalizeInvoice } from "@/lib/invoice";


export async function POST(_: Request, { params }: { params: { id: string } }) {
try {
const inv = await finalizeInvoice(params.id);
return NextResponse.json(inv);
} catch (e: any) {
return NextResponse.json({ error: e.message }, { status: 400 });
}
}