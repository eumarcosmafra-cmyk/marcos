import { NextRequest, NextResponse } from "next/server";
import { actionQueueRepository } from "@/repositories/action-queue-repository";
import type { ActionStatus } from "@prisma/client";

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

    const status = searchParams.get("status") as ActionStatus | null;

    const actions = await actionQueueRepository.findByClient(
      clientId,
      status ?? undefined
    );

    return NextResponse.json({ actions });
  } catch (error) {
    console.error("[action-queue] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
