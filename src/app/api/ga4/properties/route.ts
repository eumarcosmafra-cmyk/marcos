import { NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { auth } from "@/lib/auth";

export async function GET() {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: session.accessToken });
    const admin = google.analyticsadmin({ version: "v1beta", auth: oauth2 });

    const properties: { id: string; displayName: string; account: string }[] = [];
    let pageToken: string | undefined;
    do {
      const res = await admin.accountSummaries.list({ pageSize: 200, pageToken });
      for (const acct of res.data.accountSummaries || []) {
        for (const prop of acct.propertySummaries || []) {
          if (prop.property) {
            properties.push({
              id: prop.property,
              displayName: prop.displayName || prop.property,
              account: acct.displayName || "",
            });
          }
        }
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return NextResponse.json({ properties });
  } catch (error) {
    console.error("[ga4/properties] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
