import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const SECRET = new TextEncoder().encode(
  process.env.CLIENT_PORTAL_SECRET || "client-portal-secret-change-me"
);
const COOKIE_NAME = "client_session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createClientSession(clientUserId: string, clientId: string): Promise<string> {
  return new SignJWT({ clientUserId, clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function getClientSession(): Promise<{ clientUserId: string; clientId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as { clientUserId: string; clientId: string };
  } catch {
    return null;
  }
}

export async function setClientSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearClientSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
