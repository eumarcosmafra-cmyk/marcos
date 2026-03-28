# SEO Analyst — Contexto do Projeto

## O que é
Sistema interno de inteligência SEO para consultores de e-commerce.
Automatiza o processo de diagnóstico que antes era manual: GSC → análise → priorização → recomendações.

## Usuário atual
Marcos — consultor sênior, opera múltiplos clientes simultaneamente.
Uso interno agora, produto SaaS para agências/consultores no roadmap.

## Stack
- Next.js 15 (App Router)
- TypeScript
- Prisma + PostgreSQL (Supabase)
- Tailwind CSS
- NextAuth v5 (Google OAuth)
- Gemini 2.5 Flash (todas as chamadas de IA — NÃO usar Anthropic SDK)
- Vercel (deploy + cron jobs)

## Comandos
- Dev: `npm run dev`
- Build: `npm run build`
- DB push: `npx prisma db push`

## Arquitetura de pastas
```
src/
├── app/
│   ├── api/          ← rotas de API (todas protegidas por requireAuth())
│   ├── [features]/   ← páginas por feature
├── components/
│   ├── ui/           ← componentes genéricos
│   ├── gsc/          ← componentes específicos de GSC
│   ├── layout/       ← header, sidebar
├── lib/
│   ├── gemini.ts     ← wrapper único para todas as chamadas de IA
│   ├── ai-client.ts  ← usa gemini.ts internamente
│   ├── gsc-client.ts ← client GSC com cache
│   ├── auth.ts       ← NextAuth config
│   ├── require-auth.ts ← auth guard para rotas de API
├── services/         ← lógica de negócio complexa
├── repositories/     ← acesso ao banco via Prisma
├── types/            ← interfaces TypeScript
├── jobs/             ← jobs de background
```

## Padrões obrigatórios

### Auth em rotas de API
TODA rota de API (exceto /api/auth/* e /api/cron/*) deve começar com:
```typescript
const authResult = await requireAuth()
if (isAuthError(authResult)) return authResult
const { accessToken } = authResult
```

### Chamadas de IA
SEMPRE usar `callGemini()` de `@/lib/gemini`. NUNCA instanciar Anthropic diretamente.
SEMPRE usar `responseMimeType: "application/json"` para evitar erros de parse.

### Error handling
NUNCA usar `catch {}` vazio. Mínimo: `console.error("[arquivo] Erro:", e)`.
Em page components: também atualizar estado de erro para feedback ao usuário.

### TypeScript
NUNCA usar `: any` em response de IA. Usar tipos de `src/types/`.

## Features implementadas
- Dashboard com métricas GSC
- Monitor de categorias (rastreamento de posição por query)
- Category Map (mapa de categorias com verificação SERP)
- Content Intelligence (clustering de blog com IA)
- Product Map (mapa de produtos com curva ABC)
- Oportunidades (quick wins, striking distance)
- Clients (gestão básica de clientes)

## NÃO fazer
- Instanciar `new Anthropic()` em qualquer lugar
- `catch {}` silencioso
- `: any` em tipos de resposta de IA
- Rota de API sem requireAuth() (exceto cron/* e firehose/*)
- Variáveis de ambiente no client-side
- Cache em Map() em memória
