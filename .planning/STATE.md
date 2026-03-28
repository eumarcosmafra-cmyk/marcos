# STATE — Posição Atual do Projeto

> Atualizar ao fim de cada sessão de desenvolvimento.

## Status
Fase: Estabilização e fixes críticos
Data última atualização: 2026-03-28

## O que foi feito
- Content Intelligence v1 implementado (sitemap + GSC + Claude AI clustering)
- Content Intelligence v2 (5-state scores, merge, opportunity score, priority queue)
- Content Intelligence v3 API (GSC-first, Gemini, gap detection) — frontend pendente
- Category Map implementado (sitemap + GSC enrichment + position groups)
- Product Map v1 implementado (sitemap + GSC)
- Monitor de categorias (SERP + GSC position tracking)
- Decisão: migrar Anthropic → Gemini 2.5 Flash (40× mais barato)
- lib/gemini.ts criado
- API content-intelligence reescrita com Gemini

## Próximos passos (em ordem)
1. ✅ CLAUDE.md + STATE.md + settings.json
2. require-auth.ts em todas as rotas
3. Migração Gemini completa (ai-client.ts + todas as rotas)
4. Remover @anthropic-ai/sdk do package.json
5. Corrigir silent catches
6. Criar tipos TypeScript para respostas de IA
7. Content Intelligence v3 frontend (4 zonas, GSC-first)
8. Product Map v2 (CSV upload, quadrants, 3 modos) — em 4 commits

## Variáveis de ambiente
```
GEMINI_API_KEY=          ← já configurada no Vercel
GOOGLE_CLIENT_ID=        ← já configurado
GOOGLE_CLIENT_SECRET=    ← já configurado
AUTH_SECRET=             ← já configurado
DATABASE_URL=            ← já configurado
DIRECT_URL=              ← já configurado
SERP_API_KEY=            ← já configurado
CRON_SECRET=             ← já configurado
```
