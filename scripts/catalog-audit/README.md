# Auditoria de catálogo (categorias, produtos, breadcrumbs)

Script de teste, somente leitura, que audita o HTML público da loja como o Google e os crawlers de IA veem.
Não precisa de credencial da plataforma. Respeita o robots.txt e faz 1 requisição/s por padrão.

## Rodar

```bash
npm install
```

```bash
npm run audit:catalogo -- --site https://www.loja.com.br --produtos --amostra 400 --categorias
```

Outros modos:

```bash
npm run audit:catalogo -- --categoria https://www.loja.com.br/nome-da-categoria --max-paginas 5
```

```bash
npm run audit:catalogo -- --url https://www.loja.com.br/slug-do-produto
```

Testes offline: `npm run audit:catalogo:test`. Typecheck: `npm run audit:catalogo:typecheck`.

O relatório fica em `output/catalog-audit/<host>-<data>/` (pasta ignorada pelo git):

| Arquivo | Conteúdo |
|---|---|
| `resumo.md` | Contagem por regra/severidade, categorias principais observadas, limitações |
| `produtos.csv` | Uma linha por produto: breadcrumb (JSON-LD e plataforma), categoria principal, compatibilidade, sugestão, achados |
| `arvore-observada.csv` | Caminhos de categoria que aparecem nos breadcrumbs da amostra, com contagem |
| `categorias.csv` | Uma linha por categoria do sitemap: H1, canonical, trilha, achados |

CSV com `;` e BOM UTF-8 (abre direto no Excel pt-BR).

## Fontes lidas por página

- JSON-LD `BreadcrumbList`, `Product` (marca, `itemCondition`, descrição) e `ItemList` (listagens)
- Magazord: `breadcrumb: [...]` embutido no script (traz o ID da categoria), `categoria_id`, `#prod-categorias`
- Bloco "Marca: X Modelo: Y Compatibilidade: anos" da descrição, usado para a sugestão Marca > Modelo
- `<title>`, `<h1>`, canonical, meta robots

## Regras

| Regra | Severidade | O que significa |
|---|---|---|
| CATEGORIA_TECNICA | CRITICA | Categoria de marketplace/integração/feed no breadcrumb (lista em `config.ts`) |
| SEM_BREADCRUMB | CRITICA | Nenhuma trilha encontrada |
| HTTP_ERRO | CRITICA | Página não respondeu 200 |
| CATEGORIA_SEM_URL | ALTA | Item do breadcrumb sem link (categoria não pública/inativa) |
| BREADCRUMB_SEM_CATEGORIA | ALTA | Home direto para o produto |
| CANONICAL_BARRA_DUPLA / CANONICAL_DIVERGENTE / SEM_CANONICAL | ALTA | Canonical aponta para outra URL |
| CONDICAO_DIVERGENTE | ALTA | Produto "usado" declarado como `NewCondition` |
| MARCA_DIVERGENTE | ALTA | Marca do veículo no produto ≠ marca no breadcrumb |
| CATEGORIA_PROMOCIONAL_NO_BREADCRUMB | ALTA | Black Friday, % OFF etc. como categoria principal |
| BREADCRUMB_FORA_DA_PRINCIPAL | ALTA | `categoria_id` do produto não está na trilha |
| H1_DUPLICADO | ALTA | Mesmo H1 em várias categorias |
| SEM_BREADCRUMB_JSONLD, JSONLD_INVALIDO, NOINDEX, LISTAGEM_SEM_PRODUTOS | ALTA | Autoexplicativas |
| NOME_GENERICO, NIVEL_REPETIDO, PROFUNDIDADE_EXCESSIVA, URL_COM_ACENTO, SEM_H1_NO_HTML, CATEGORIA_PROMOCIONAL_INDEXAVEL, JSONLD_DIVERGE_DA_PLATAFORMA, REDIRECIONA | MEDIA | |
| ARVORE_PLANA, CATEGORIA_RAIZ, LISTADO_FORA_DA_PRINCIPAL | INFO | Sinal de estrutura, não erro em si |

## Limitações

- Percentuais valem para a amostra.
- Não executa JS: o que só aparece no navegador conta como ausente.
- Listas de termos são heurísticas; a classificação final das categorias é do negócio.
- A API Magazord (`GET /api/v2/site/produto`, campo `categorias`, em que o primeiro item é a principal) é o passo seguinte para cobrir 100% do catálogo com o ID exato de cada vínculo.

## Ambiente com proxy

Em ambientes onde o `fetch` do Node precisa de proxy (Node ≥ 22.21): `NODE_USE_ENV_PROXY=1 npm run audit:catalogo -- ...`
