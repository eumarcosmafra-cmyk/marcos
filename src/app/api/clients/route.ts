import { NextResponse } from "next/server";
import { getClients, addClient } from "@/lib/store";
import { generateId } from "@/lib/utils";

export async function GET() {
  return NextResponse.json(getClients());
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, domain, industry, notes } = body;

  if (!name || !domain) {
    return NextResponse.json(
      { error: "Nome e domínio são obrigatórios" },
      { status: 400 }
    );
  }

  const client = {
    id: generateId(),
    name,
    domain,
    industry: industry || "",
    status: "active" as const,
    createdAt: new Date().toISOString(),
    notes,
  };

  addClient(client);
  return NextResponse.json(client, { status: 201 });
}
