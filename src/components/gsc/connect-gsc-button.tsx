"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, CheckCircle, AlertTriangle } from "lucide-react";

export function ConnectGSCButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="glass-card animate-pulse p-5">
        <div className="h-12 rounded bg-white/5" />
      </div>
    );
  }

  if (session?.error === "RefreshAccessTokenError") {
    return (
      <div className="glass-card border-seo-orange/20 p-5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-seo-orange" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Sessão expirada</p>
            <p className="text-xs text-white/40">
              Reconecte sua conta Google para continuar acessando o Search Console
            </p>
          </div>
          <button
            onClick={() => signIn("google")}
            className="btn-primary flex items-center gap-2 text-xs"
          >
            <LogIn className="h-3 w-3" />
            Reconectar
          </button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-seo-green/10">
            <CheckCircle className="h-5 w-5 text-seo-green" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              Google Search Console conectado
            </p>
            <p className="text-xs text-white/40">{session.user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <LogOut className="h-3 w-3" />
            Desconectar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">
            Conectar Google Search Console
          </p>
          <p className="text-xs text-white/40">
            Acesse dados reais de performance dos seus sites
          </p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="btn-primary flex items-center gap-2 text-xs"
        >
          <LogIn className="h-3 w-3" />
          Conectar
        </button>
      </div>
    </div>
  );
}
