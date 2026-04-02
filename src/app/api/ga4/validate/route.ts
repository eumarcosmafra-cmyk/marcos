import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateGA4Property } from "@/lib/ga4-client";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
    }

    const { propertyId, clientId } = await request.json();
    if (!propertyId || !clientId) {
      return NextResponse.json({ error: "propertyId e clientId obrigatórios" }, { status: 400 });
    }

    const formattedId = propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
    const result = await validateGA4Property(session.accessToken, formattedId);

    if (result.valid) {
      await prisma.client.update({
        where: { id: clientId },
        data: { ga4PropertyId: formattedId },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ga4/validate] Error:", error);
    return NextResponse.json({ error: "Erro ao validar" }, { status: 500 });
  }
}
