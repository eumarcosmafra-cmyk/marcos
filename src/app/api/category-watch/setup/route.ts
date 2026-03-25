import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { categoryWatchRepository } from "@/repositories/category-watch-repository";
import { clientRepository } from "@/repositories/client-repository";
import { getUrlTopQueries } from "@/services/gsc/get-url-top-queries";
import { getGSCSites, matchDomainToGSCSite } from "@/lib/gsc-client";

const setupSchema = z.object({
  clientId: z.string().min(1),
  categoryName: z.string().min(1).max(100),
  targetUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientId, categoryName, targetUrl } = parsed.data;

    // Validate client exists
    const client = await clientRepository.findById(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check limit of 5 categories per client
    const count = await categoryWatchRepository.countByClient(clientId);
    if (count >= 5) {
      return NextResponse.json(
        { error: "Limite de 5 categorias por cliente atingido" },
        { status: 400 }
      );
    }

    // Create category watch
    const categoryWatch = await categoryWatchRepository.create(
      clientId,
      categoryName,
      targetUrl
    );

    // Try to fetch top queries from GSC
    let suggestedQueries: Awaited<ReturnType<typeof getUrlTopQueries>> = [];
    try {
      const sites = await getGSCSites(session.accessToken);
      const gscSite = matchDomainToGSCSite(client.domain, sites);

      if (gscSite) {
        suggestedQueries = await getUrlTopQueries(
          session.accessToken,
          gscSite,
          targetUrl,
          15
        );
      }
    } catch (e) {
      console.warn("[setup] GSC query failed:", e);
    }

    return NextResponse.json({
      categoryWatch,
      suggestedQueries,
    });
  } catch (error) {
    console.error("[category-watch/setup] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
