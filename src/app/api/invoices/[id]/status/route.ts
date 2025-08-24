import { NextResponse } from "next/server";
import { updateInvoiceStatus } from "@/lib/invoice";
import { InvoiceStatus } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = { params: { id: string } };
type Body = {
  status: keyof typeof InvoiceStatus | string; // ex: "SENT" | "VALIDATED" | …
  reason?: string | null;
};

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const id = params?.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "invoice id manquant" }, { status: 400 });
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "corps de requête invalide" }, { status: 400 });
    }

    const { status, reason } = body as Body;
    if (!status || typeof status !== "string") {
      return NextResponse.json({ error: "status manquant" }, { status: 400 });
    }

    // Mappe la chaîne vers l'enum Prisma
    const statusEnum = InvoiceStatus[status as keyof typeof InvoiceStatus];
    if (!statusEnum) {
      return NextResponse.json({ error: "status invalide" }, { status: 400 });
    }

    const reasonClean =
      typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : undefined;

    const invoice = await updateInvoiceStatus(id, statusEnum, reasonClean);
    return NextResponse.json(invoice, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
