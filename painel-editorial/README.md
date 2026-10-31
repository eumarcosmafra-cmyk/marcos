# MAFRA LABS — Editorial

Painel de gestão editorial de SEO: pautas, briefings, revisão de artigos por versão, pedidos de ajuste e aprovações humanas. Primeiro projeto demonstrativo: Alto Vale Top Team (AVTT).

> **Modo demonstração — dados locais.** Tudo fica no `localStorage` deste navegador, separado por projeto. Não há autenticação, integração com n8n, Supabase, modelos de IA, pesquisa de palavras-chave nem publicação no Astro. Ações que dependem disso aparecem como **“Integração pendente”**.

Aplicação isolada: não compartilha build, dependências nem rotas com o SEO Analyst da raiz deste repositório.

## Rodar

```bash
cd painel-editorial
npm install
npm run dev
```

Abra http://localhost:3100.

Produção local: `npm run build && npm start` (mesma porta).

## Verificações

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Vitest: regras de versão/aprovação, mapeamento de workflows, Markdown seguro
```

Jornada completa no navegador (requer Playwright instalado e o app rodando em :3100):

```bash
node scripts/jornada-e2e.cjs ./capturas
```

## Telas

- **Visão geral** — contadores calculados dos dados, fila de pendências e atividade recente.
- **Pautas** — tabela e quadro por etapa sincronizados (mesma busca e filtros na URL); criar, editar, aprovar e devolver.
- **Artigo** — Markdown editável com prévia segura, versões, comentários e ajustes por seção, fontes separadas por categoria com recibo da execução, histórico com comparação entre versões e decisões.
- **Projeto e configurações** — dados do cliente, integrações (não conectadas), etapas dos agentes, inventário demonstrativo e identidades locais.

## Regras editoriais implementadas

- Ciclo da pauta, ciclo do artigo e pendências de qualidade são separados.
- A etapa do artigo é **derivada das decisões registradas na versão atual**. Nova versão volta para revisão; decisões anteriores ficam só no histórico.
- Pedir ajustes retira a versão da aprovação (inclusive final). Ajuste só é marcado como resolvido em uma versão posterior.
- Aprovação final exige: aprovação editorial e (se configurado) revisão do especialista **na mesma versão**, sem ajustes nem pendências de legibilidade/fontes abertas.
- “Aprovado para publicação” ≠ “Publicado”. Publicar é integração pendente.
- Aprovar pauta não aprova artigo; editar pauta aprovada a devolve para revisão.
- Parecer de IA é auxiliar e nunca preenche decisão humana.
- Biblioteca de fontes ≠ trecho recebido pelo agente. Sem recibo: “Uso não comprovado nesta execução”.

## Estrutura

```
src/
  domain/      contratos, regras, comandos, mapeamento de workflows (sem React)
  data/        interface do repositório, implementação local, dados demonstrativos
  state/       provedores React (dados, avisos, proteção de alterações não salvas)
  components/  UI, Markdown seguro, comparação de versões, telas
  app/         rotas do App Router (/p/[projeto]/...)
tests/         testes unitários (Vitest)
```

Para conectar serviços reais, ver [INTEGRACAO_FUTURA.md](./INTEGRACAO_FUTURA.md).

## Dados demonstrativos

Pautas, artigos, execuções, trechos e inventário são fictícios e marcados como demonstração. Exceção: dois trechos de “Informações do cliente” foram importados literalmente de `eumarcosmafra-cmyk/avtt-atendimento-ia@c59fa22:knowledge/academy/profile.md` — continuam sendo apenas fontes cadastradas, sem prova de uso por agente.

## Capturas

Geradas pela jornada `scripts/jornada-e2e.cjs` (dados de demonstração):

| | |
|---|---|
| ![Visão geral](docs/capturas/01-visao-geral.jpg) | ![Pautas em quadro](docs/capturas/02-pautas-quadro.jpg) |
| ![Detalhe da pauta](docs/capturas/03-pauta-detalhe.jpg) | ![Artigo — prévia](docs/capturas/04-artigo-previa.jpg) |
| ![Artigo — fontes](docs/capturas/05-artigo-fontes.jpg) | ![Histórico — comparação](docs/capturas/06-historico-comparacao.jpg) |
| ![Aprovado para publicação](docs/capturas/07-aprovado-para-publicacao.jpg) | ![Celular — artigo](docs/capturas/09-celular-artigo.jpg) |
