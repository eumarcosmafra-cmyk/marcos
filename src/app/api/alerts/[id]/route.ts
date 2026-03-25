import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { alertRepository } from "@/repositories/alert-repository";
import type { AlertStatus } from "@prisma/client";

const updateSchema = z.object({
  status: z.enum(["OPEN", "DISMISSED", "DONE"]),
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

    const alert = await alertRepository.updateStatus(
      id,
      parsed.data.status as AlertStatus
    );
    return NextResponse.json({ alert });
  } catch (error) {
    console.error("[alerts/update] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
