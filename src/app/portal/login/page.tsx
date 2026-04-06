"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao fazer login");
      }

      router.push("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#07111d] text-white">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_18%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_22%),linear-gradient(180deg,#07111d_0%,#08111c_50%,#040810_100%)]" />
        <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
          <section className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/8 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-cyan-200/90">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
              Portal executivo do cliente
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[0.95] text-white sm:text-5xl lg:text-[4.2rem]">
              Acesso direto ao relatório que conecta
              <span className="text-cyan-300"> SEO</span>, produto e receita.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
              O cliente entra, autentica a conta e encontra uma leitura clara dos resultados orgânicos, sem depender de planilha manual e sem navegar por telas operacionais.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <ShieldCheck className="h-5 w-5" />,
                  title: "Acesso privado",
                  text: "Cada cliente visualiza apenas os próprios relatórios e leituras consolidadas.",
                },
                {
                  icon: <Mail className="h-5 w-5" />,
                  title: "Leitura executiva",
                  text: "A homepage do portal já abre com visão de performance e relatórios recentes.",
                },
                {
                  icon: <LockKeyhole className="h-5 w-5" />,
                  title: "Fluxo simples",
                  text: "Login enxuto para o cliente chegar rápido no que interessa: resultado e próximos passos.",
                },
              ].map((item) => (
                <div key={item.title} className="glass-card rounded-[24px] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/20">
                    {item.icon}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-white/52">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card relative rounded-[32px] border border-white/8 p-6 shadow-[0_34px_120px_rgba(0,0,0,0.34)] sm:p-8 lg:p-9">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Cliente autenticado</p>
              <h2 className="mt-4 text-3xl font-semibold text-white">Entrar no portal</h2>
              <p className="mt-3 text-sm leading-7 text-white/52">
                Use as credenciais enviadas para acessar a área de relatórios e acompanhar os resultados do período.
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-white/35">Email</label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 focus-within:border-cyan-300/25 focus-within:bg-white/[0.06]">
                  <Mail className="h-4 w-4 text-white/35" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="cliente@empresa.com"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-white/35">Senha</label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 focus-within:border-cyan-300/25 focus-within:bg-white/[0.06]">
                  <LockKeyhole className="h-4 w-4 text-white/35" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Digite sua senha"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Entrar no relatório"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-8 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">O que o cliente encontra</p>
              <div className="mt-4 space-y-3 text-sm text-white/58">
                <p>Visão consolidada dos relatórios publicados.</p>
                <p>Leitura de cliques, impressões e receita por período.</p>
                <p>Entrada rápida para a tela detalhada de cada relatório.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
