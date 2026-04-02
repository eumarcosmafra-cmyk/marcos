import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string; reportId: string }> };

// GET público — sem requireAuth (cliente acessa sem login)
export async function GET(request: NextRequest, context: Params) {
  try {
    const { id, reportId } = await context.params;
    const report = await prisma.clientReport.findFirst({
      where: { id: reportId, clientId: id },
      include: { client: { select: { name: true, domain: true } } },
    });

    if (!report) {
      return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
    }

    // Remove notas internas do analista
    const { analystNotes: _, ...publicReport } = report;
    return NextResponse.json({ report: publicReport });
  } catch (error) {
    console.error("[client-report] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar relatório" }, { status: 500 });
  }
}

// DELETE — apenas autenticado
export async function DELETE(request: NextRequest, context: Params) {
  const { requireAuth, isAuthError } = await import("@/lib/require-auth");
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const { reportId } = await context.params;
    await prisma.clientReport.delete({ where: { id: reportId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[client-report] DELETE error:", error);
    return NextResponse.json({ error: "Erro ao deletar relatório" }, { status: 500 });
  }
}
