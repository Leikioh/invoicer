import { NextResponse } from "next/server";
import { updateQuoteStatus } from "@/lib/quote";
import { QuoteStatus } from "@prisma/client";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { status, reason } = await req.json();
  const to = QuoteStatus[status as keyof typeof QuoteStatus];
  if (!to) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });

  const q = await updateQuoteStatus(id, to, reason);
  return NextResponse.json(q);
}
