import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const { displayName, email, phone, vatNumber, address, siret } = await req.json();

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json({ error: "displayName requis" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      displayName,
      email,
      phone,
      vatNumber,
      siret,              
      billingStreet: address, 
    },
  });

  return NextResponse.json(client, { status: 201 });
}
