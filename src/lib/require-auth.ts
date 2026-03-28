import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireAuth(): Promise<{ accessToken: string } | NextResponse> {
  const session = await auth().catch(() => null);
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login para continuar." },
      { status: 401 }
    );
  }
  return { accessToken: session.accessToken };
}

export function isAuthError(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}
