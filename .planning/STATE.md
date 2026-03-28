# STATE — Posição Atual do Projeto

> Atualizar ao fim de cada sessão de desenvolvimento.

## Status
Fase: Estabilização e fixes críticos
Data última atualização: 2026-03-28

## O que foi feito
- Auth guard aplicado em 17 rotas de API
- Migração Anthropic → Gemini 2.5 Flash (ai-client.ts, gemini.ts)
- Content Intelligence v3 (GSC-first, batches, Gemini)
- Category Map com agrupamento por posição
- Product Map básico com sitemap + GSC
- CLAUDE.md e settings.json criados

## Próximos passos
1. Corrigir silent catches
2. Criar tipos TypeScript para responses de IA
3. Content Intelligence frontend v3 (4 zonas)
4. Product Map v2 (CSV upload, quadrantes, 3 modos)
5. Arquitetura multi-tenant

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
