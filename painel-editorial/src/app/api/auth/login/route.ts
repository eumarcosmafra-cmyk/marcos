import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getConfig } from "@/server/config";
import { DUMMY_HASH, verifyPassword } from "@/server/auth/password";
import { clearFailures, loginBlocked, registerFailure } from "@/server/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE } from "@/server/auth/session";
import { assertSameOrigin, clientIp, errorResponse, PainelError, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ usuario: z.string().trim().toLowerCase().min(1).max(40), senha: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const cfg = getConfig();
    const parsed = bodySchema.safeParse(await readJson(req, 4096));
    if (!parsed.success) throw new PainelError("LOGIN_INVALIDO", "Informe usuário e senha.", 400);
    const { usuario, senha } = parsed.data;
    const key = `${clientIp(req)}|${usuario}`;
    const block = loginBlocked(key);
    if (block.blocked) {
      throw new PainelError("LOGIN_BLOQUEADO", `Muitas tentativas. Tente novamente em ${Math.ceil(block.retryAfterSeconds / 60)} min.`, 429);
    }
    const user = cfg.usuarios.find((u) => u.usuario === usuario && u.ativo);
    const ok = await verifyPassword(senha, user?.senha_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      registerFailure(key);
      console.warn("[login] Falha de login para", usuario);
      throw new PainelError("LOGIN_RECUSADO", "Usuário ou senha incorretos.", 401);
    }
    clearFailures(key);
    const res = NextResponse.json({ ok: true, usuario: { nome: user.nome, papel: user.papel } });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.usuario, cfg.sessionSecret, cfg.sessionTtlSeconds), {
      httpOnly: true,
      sameSite: "strict",
      secure: cfg.cookieSecure,
      path: "/",
      maxAge: cfg.sessionTtlSeconds,
    });
    console.info("[login] Sessão iniciada para", user.usuario);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
