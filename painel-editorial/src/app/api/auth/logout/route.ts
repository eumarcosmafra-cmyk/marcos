import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/server/config";
import { SESSION_COOKIE } from "@/server/auth/session";
import { assertSameOrigin, errorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: getConfig().cookieSecure, path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
