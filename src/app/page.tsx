import Link from "next/link";
import {
  Zap,
  Search,
  TrendingUp,
  Globe,
  FileText,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/20">
          <Zap className="h-8 w-8 text-white" />
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">
          SEO <span className="gradient-text">Analyst AI</span>
        </h1>
        <p className="mx-auto max-w-md text-lg text-white/50">
          Seu analista de SEO sênior powered by IA. Auditorias completas,
          keywords, concorrentes e relatórios automatizados.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="mb-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            icon: MessageSquare,
            title: "Chat com Analista",
            desc: "Converse com um analista SEO sênior sobre qualquer dúvida",
          },
          {
            icon: Search,
            title: "Auditoria SEO",
            desc: "Análise completa on-page, técnica, conteúdo e backlinks",
          },
          {
            icon: TrendingUp,
            title: "Pesquisa de Keywords",
            desc: "Encontre as melhores keywords para seu nicho",
          },
          {
            icon: Globe,
            title: "Análise de Concorrentes",
            desc: "Descubra gaps e oportunidades vs concorrência",
          },
          {
            icon: FileText,
            title: "Relatórios",
            desc: "Relatórios profissionais automatizados para clientes",
          },
          {
            icon: Zap,
            title: "IA Avançada",
            desc: "Powered by Claude - recomendações de nível sênior",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="glass-card-hover p-5"
          >
            <feature.icon className="mb-3 h-5 w-5 text-brand-400" />
            <h3 className="mb-1 text-sm font-semibold text-white">
              {feature.title}
            </h3>
            <p className="text-xs text-white/40">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href="/dashboard"
        className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
      >
        Acessar Dashboard
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
