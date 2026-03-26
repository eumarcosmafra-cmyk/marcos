import { NextResponse } from "next/server";
import { clientRepository } from "@/repositories/client-repository";

export async function GET() {
  try {
    const clients = await clientRepository.findAll();
    const mapped = clients.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      industry: "",
      status: "active" as const,
      createdAt: c.createdAt.toISOString(),
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    console.error("[clients] Error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, domain } = body;

    if (!name || !domain) {
      return NextResponse.json(
        { error: "Nome e domínio são obrigatórios" },
        { status: 400 }
      );
    }

    const client = await clientRepository.upsertByDomain(name, domain);
    return NextResponse.json({
      id: client.id,
      name: client.name,
      domain: client.domain,
      industry: "",
      status: "active" as const,
      createdAt: client.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("[clients] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
