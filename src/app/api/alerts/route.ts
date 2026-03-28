import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { alertRepository } from "@/repositories/alert-repository";
import type { AlertSeverity, AlertStatus, AlertType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const severity = searchParams.get("severity") as AlertSeverity | null;
    const status = searchParams.get("status") as AlertStatus | null;
    const type = searchParams.get("type") as AlertType | null;

    const alerts = await alertRepository.findByClient(clientId, {
      ...(severity && { severity }),
      ...(status && { status }),
      ...(type && { type }),
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[alerts] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
