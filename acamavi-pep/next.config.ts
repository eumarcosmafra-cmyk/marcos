import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Esta pasta vive dentro do repo do SEO Analyst: rastrear arquivos só a partir daqui
  outputFileTracingRoot: __dirname,
  // As fontes do PDF são lidas do disco pelas rotas de API
  outputFileTracingIncludes: {
    "/api/**/*": ["./fonts/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // Links de envio carregam token na URL: não vazar via Referer
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ]
  },
}

export default nextConfig
