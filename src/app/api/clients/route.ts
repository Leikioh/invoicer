import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/* ---------- Types & helpers ---------- */

type ClientBody = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  billingStreet?: string | null;
  billingZip?: string | null;
  billingCity?: string | null;
  vatNumber?: string | null;
  siret?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toRequiredString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${field} manquant`);
  }
  return v.trim();
}

function toOptionalString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/** Garde de type structurale pour l'erreur Prisma P2002 (unicité) */
function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code?: unknown }).code === "string"
  );
}

/* ---------- Handlers ---------- */

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clients, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const raw: unknown = await req.json();
    if (!isRecord(raw)) {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }

    const data: ClientBody = {
      displayName: toRequiredString(raw.displayName, "displayName"),
      email: toOptionalString(raw.email),
      phone: toOptionalString(raw.phone),
      billingStreet: toOptionalString(raw.billingStreet),
      billingZip: toOptionalString(raw.billingZip),
      billingCity: toOptionalString(raw.billingCity),
      vatNumber: toOptionalString(raw.vatNumber),
      siret: toOptionalString(raw.siret),
    };

    const created = await prisma.client.create({ data });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    if (isPrismaKnownError(e) && e.code === "P2002") {
      return NextResponse.json({ error: "Conflit: champ unique déjà utilisé" }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
