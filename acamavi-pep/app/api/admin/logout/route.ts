import { ADMIN_COOKIE } from "@/lib/auth"
import { json } from "@/lib/http"

export async function POST() {
  const res = json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 })
  return res
}
