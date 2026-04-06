import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  try {
    const session = await auth();
    const token = session?.accessToken;
    if (token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/revoke] Error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
