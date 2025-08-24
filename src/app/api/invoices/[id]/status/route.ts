import { NextRequest, NextResponse } from "next/server";
import { updateInvoiceStatus } from "@/lib/invoice";
import { InvoiceStatus } from "@prisma/client";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };
type Body = { status: keyof typeof InvoiceStatus | string; reason?: string | null };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "invoice id manquant" }, { status: 400 });

    const raw: unknown = await req.json();
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "corps de requête invalide" }, { status: 400 });
    }

    const { status, reason } = raw as Body;
    if (!status || typeof status !== "string") {
      return NextResponse.json({ error: "status manquant" }, { status: 400 });
    }

    const statusEnum = InvoiceStatus[status as keyof typeof InvoiceStatus];
    if (!statusEnum) {
      return NextResponse.json({ error: "status invalide" }, { status: 400 });
    }

    const reasonClean =
      typeof reason === "string" && reason.trim() ? reason.trim() : undefined;

    const invoice = await updateInvoiceStatus(id, statusEnum, reasonClean);
    return NextResponse.json(invoice, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
