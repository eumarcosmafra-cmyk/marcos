"use client";

import { Loader2, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, ApiError } from "@/components/real/api";

function safeVoltar(v: string | null): string {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/fila";
  return v;
}

function Login() {
  const router = useRouter();
  const sp = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(undefined);
    setEnviando(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { usuario, senha } });
      router.replace(safeVoltar(sp?.get("voltar") ?? null));
    } catch (err) {
      setErro(err instanceof ApiError ? `${err.message} (${err.codigo})` : "Falha inesperada ao entrar.");
      setSenha("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold tracking-tight">MAFRA LABS</span>
          <span className="text-xs font-medium uppercase tracking-widest text-brand-700">Editorial</span>
        </div>
        <form onSubmit={entrar} className="card flex flex-col gap-4 px-5 py-5" aria-describedby={erro ? "login-erro" : undefined}>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-brand-700" aria-hidden />
            <h1 className="text-lg font-semibold">Entrar no painel</h1>
          </div>
          {erro ? (
            <p id="login-erro" role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
              {erro}
            </p>
          ) : null}
          <div>
            <label htmlFor="usuario" className="field-label">Usuário</label>
            <input id="usuario" className="input" autoComplete="username" autoCapitalize="none" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="senha" className="field-label">Senha</label>
            <input id="senha" type="password" className="input" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={enviando || !usuario || !senha}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Entrar
          </button>
          <p className="text-xs text-faint">Acesso restrito. Sessões expiram automaticamente.</p>
        </form>
      </div>
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
