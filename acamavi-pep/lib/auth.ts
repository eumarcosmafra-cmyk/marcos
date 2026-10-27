import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { Submission } from "./types"

export const ADMIN_COOKIE = "acamavi_admin"
export const ADMIN_SESSION_SECONDS = 12 * 60 * 60

export function newId(): string {
  return randomBytes(12).toString("hex")
}

export function newToken(): string {
  return randomBytes(24).toString("base64url")
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

export function hashToken(token: string): string {
  return sha256(token).toString("hex")
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Confere o token do link pessoal (guardamos só o hash). */
export function tokenMatches(s: Submission, token: string | null): boolean {
  if (!token) return false
  return safeEqual(sha256(token), Buffer.from(s.tokenHash, "hex"))
}

export function passwordMatches(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    console.error("[auth] ADMIN_PASSWORD não configurada")
    return false
  }
  return safeEqual(sha256(password), sha256(expected))
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET não configurada")
  return secret
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
}

export function createSessionValue(): string {
  const expires = String(Date.now() + ADMIN_SESSION_SECONDS * 1000)
  return `${expires}.${sign(expires)}`
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!value) return false
  const [expires, signature] = value.split(".")
  if (!expires || !signature || Number(expires) < Date.now()) return false
  return safeEqual(Buffer.from(signature), Buffer.from(sign(expires)))
}
