import { NextResponse } from "next/server";
import { updateInvoiceStatus } from "@/lib/invoice";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { status, reason } = await req.json(); // status: "SENT" | "VALIDATED" | "REFUSED" | "CANCELLED"
  if (!status) return NextResponse.json({ error: "status manquant" }, { status: 400 });

  try {
    const inv = await updateInvoiceStatus(params.id, status, reason);
    return NextResponse.json(inv);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
