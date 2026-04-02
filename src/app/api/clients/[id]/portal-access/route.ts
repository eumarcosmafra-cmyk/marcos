import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/client-auth";

type Params = { params: Promise<{ id: string }> };

// GET — check if portal access exists
export async function GET(request: NextRequest, context: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const { id } = await context.params;
    const clientUser = await prisma.clientUser.findFirst({
      where: { clientId: id },
      select: { id: true, email: true, name: true, lastLoginAt: true, createdAt: true },
    });
    return NextResponse.json({ clientUser });
  } catch (error) {
    console.error("[portal-access] GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST — create portal access
export async function POST(request: NextRequest, context: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const { id } = await context.params;
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
    }

    const existing = await prisma.clientUser.findFirst({ where: { clientId: id } });
    if (existing) {
      return NextResponse.json({ error: "Este cliente já tem acesso ao portal" }, { status: 400 });
    }

    const emailExists = await prisma.clientUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (emailExists) {
      return NextResponse.json({ error: "Este email já está em uso" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const clientUser = await prisma.clientUser.create({
      data: {
        clientId: id,
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name || null,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return NextResponse.json({ clientUser });
  } catch (error) {
    console.error("[portal-access] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar acesso" }, { status: 500 });
  }
}

// PATCH — reset password
export async function PATCH(request: NextRequest, context: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const { id } = await context.params;
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: "Nova senha obrigatória" }, { status: 400 });
    }

    const clientUser = await prisma.clientUser.findFirst({ where: { clientId: id } });
    if (!clientUser) {
      return NextResponse.json({ error: "Acesso não encontrado" }, { status: 404 });
    }

    const passwordHash = await hashPassword(password);
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[portal-access] PATCH error:", error);
    return NextResponse.json({ error: "Erro ao redefinir senha" }, { status: 500 });
  }
}

// DELETE — revoke access
export async function DELETE(request: NextRequest, context: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const { id } = await context.params;
    const clientUser = await prisma.clientUser.findFirst({ where: { clientId: id } });
    if (!clientUser) {
      return NextResponse.json({ error: "Acesso não encontrado" }, { status: 404 });
    }

    await prisma.clientUser.delete({ where: { id: clientUser.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[portal-access] DELETE error:", error);
    return NextResponse.json({ error: "Erro ao revogar acesso" }, { status: 500 });
  }
}
