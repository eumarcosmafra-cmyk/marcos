import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createSessionValue, passwordMatches } from "@/lib/auth"
import { error, json } from "@/lib/http"

export async function POST(req: Request) {
  let password = ""
  try {
    const body = (await req.json()) as { password?: unknown }
    password = typeof body.password === "string" ? body.password : ""
  } catch (e) {
    console.error("[api/admin/login] JSON inválido:", e)
    return error("Requisição inválida.", 400)
  }

  if (!passwordMatches(password)) {
    await new Promise((r) => setTimeout(r, 800))
    return error("Senha incorreta.", 401)
  }

  try {
    const res = json({ ok: true })
    res.cookies.set(ADMIN_COOKIE, createSessionValue(), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_SECONDS,
    })
    return res
  } catch (e) {
    console.error("[api/admin/login] Erro ao criar sessão:", e)
    return error("Erro de configuração do servidor.", 500)
  }
}
