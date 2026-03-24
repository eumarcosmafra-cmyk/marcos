import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO Analyst AI - Analista SEO Sênior com IA",
  description:
    "Ferramenta de análise SEO profissional powered by Claude AI. Auditorias, keywords, análise de concorrentes e relatórios automatizados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
