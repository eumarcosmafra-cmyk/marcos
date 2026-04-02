import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createClientSession, setClientSessionCookie } from "@/lib/client-auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
    }

    const clientUser = await prisma.clientUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!clientUser) {
      return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
    }

    const valid = await verifyPassword(password, clientUser.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
    }

    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createClientSession(clientUser.id, clientUser.clientId);
    await setClientSessionCookie(token);

    return NextResponse.json({ success: true, clientId: clientUser.clientId });
  } catch (error) {
    console.error("[portal/login] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
