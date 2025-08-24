import { NextResponse } from "next/server";
import { finalizeInvoice } from "@/lib/invoice";

export const runtime = "nodejs";

type RouteParams = { params: { id: string } };

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const id = params?.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });
    }

    const invoice = await finalizeInvoice(id);
    return NextResponse.json(invoice, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
