import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientSession } from "@/lib/client-auth";

type Params = { params: Promise<{ reportId: string }> };

export async function GET(request: NextRequest, context: Params) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { reportId } = await context.params;
    const comments = await prisma.reportComment.findMany({
      where: { reportId },
      orderBy: { createdAt: "asc" },
      include: { clientUser: { select: { name: true, email: true } } },
    });
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[portal/comments] GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Params) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { reportId } = await context.params;
    const { content } = await request.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "Comentário não pode ser vazio" }, { status: 400 });
    }

    const comment = await prisma.reportComment.create({
      data: {
        reportId,
        clientUserId: session.clientUserId,
        content: content.trim(),
      },
      include: { clientUser: { select: { name: true, email: true } } },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("[portal/comments] POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
