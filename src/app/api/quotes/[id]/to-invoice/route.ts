import { NextResponse } from "next/server";
import { convertQuoteToInvoice } from "@/lib/quote";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const inv = await convertQuoteToInvoice(id);
  return NextResponse.json(inv);
}
