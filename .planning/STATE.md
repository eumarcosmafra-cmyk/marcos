# STATE — Posição Atual do Projeto

> Atualizar ao fim de cada sessão de desenvolvimento.

## Status
Fase: Features v3 + estabilização
Data última atualização: 2026-03-28

## Concluído (sessão atual)
- Auth guard em 17+ rotas de API (require-auth.ts)
- Migração completa Anthropic → Gemini 2.5 Flash (zero referências Anthropic)
- lib/gemini.ts com callGemini() + parseGeminiJSON()
- ai-client.ts reescrito usando gemini.ts
- Content Intelligence API v3 (GSC-first, batches de 25 URLs, Gemini)
- Content Intelligence frontend v3 (4 zonas, 5 KPIs, priority queue, gap detection)
- Category Map com agrupamento por faixa de posição
- Product Map libs criados (GA4 CSV parser + category aggregation)
- CLAUDE.md, STATE.md, settings.json criados
- Tipos: content-intelligence.ts, product-diagnosis.ts
- Settings page atualizada (Gemini em vez de Anthropic)

## Próximos passos (em ordem)
1. Product Map v2 — reescrever page.tsx em 4 blocos (Step 17b-17d da master spec)
   - Libs GA4 já existem (csv-parser.ts, category-aggregation.ts)
   - Falta: quadrants.ts, componentes UI, integração no page.tsx
2. Corrigir silent catches restantes
3. Implementar botão "Salvar no projeto" (AnalysisSnapshot)
4. Arquitetura multi-tenant (Parte 3 da master spec)

## Variáveis de ambiente
```
GEMINI_API_KEY=          ← configurado
GOOGLE_CLIENT_ID=        ← configurado
GOOGLE_CLIENT_SECRET=    ← configurado
AUTH_SECRET=             ← configurado
DATABASE_URL=            ← configurado
DIRECT_URL=              ← configurado
SERP_API_KEY=            ← configurado
CRON_SECRET=             ← configurado
```
