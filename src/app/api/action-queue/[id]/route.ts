import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actionQueueRepository } from "@/repositories/action-queue-repository";
import type { ActionStatus } from "@prisma/client";

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    const action = await actionQueueRepository.updateStatus(
      id,
      parsed.data.status as ActionStatus
    );
    return NextResponse.json({ action });
  } catch (error) {
    console.error("[action-queue/update] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
