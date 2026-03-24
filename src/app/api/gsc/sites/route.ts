import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGSCSites } from "@/lib/gsc-client";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Connect Google Search Console first." },
        { status: 401 }
      );
    }

    const sites = await getGSCSites(session.accessToken);
    return NextResponse.json({ sites });
  } catch (error) {
    console.error("GSC sites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Search Console sites" },
      { status: 500 }
    );
  }
}
