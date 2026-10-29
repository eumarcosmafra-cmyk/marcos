# Macchio Engenharia — novo site (v1)

Redesign do site https://macchioengenharia.com.br/ (WordPress 6.1 + Elementor) como página única estática: HTML, CSS e JS puros, sem framework e sem build.

## Antes × depois (home, medido em 29/10/2026 com Chromium, sem limitar a rede)

| | Site atual (WordPress) | Novo site |
|---|---|---|
| Peso na carga inicial (desktop) | 1.329 KB | ~210 KB (HTML/CSS/JS com gzip + fonte + imagens visíveis) |
| Requisições | 53 | 6 |
| LCP medido | 6,0 s desktop / 4,5 s mobile | medir no PageSpeed após publicar |
| Maior imagem do portfólio | PNG 7680×4320 de 33 MB | WebP 640/1280/1920 px, ~25 KB na miniatura |
| CTA na primeira dobra do celular | nenhum (só uma foto genérica) | WhatsApp + "Ver projetos" |

O LCP do site novo só vale ser comparado depois do deploy, medido no mesmo servidor/CDN. O número local não serve de comparação.

## Problemas do site atual que esta versão corrige

- Os botões "Saiba sobre nós" e "Orçamento" da home apontam para **urbseng.com.br** (o site de outra empresa).
- O hero usa foto de banco de imagem (prédio que não é da Macchio), sem headline nem CTA. No celular a primeira tela é só essa foto cinza.
- Não há botão de WhatsApp nem chamada para ação ao longo da página.
- O portfólio fica numa página separada, sem filtro, com PNGs de 1,3 a 33 MB cada.
- O depoimento principal ocupa a tela inteira em itálico cinza claro, com contraste baixo.
- Não há dados estruturados (schema), FAQ nem informação de entidade para o Google e para buscadores de IA.

## Estrutura

```
index.html              página única (todas as seções)
assets/styles.css       estilos (tokens de cor/tipografia em :root)
assets/main.js          menu, filtro e lightbox do portfólio, formulário → WhatsApp, barra fixa no celular
assets/fonts/           Archivo (variável, licença OFL), auto-hospedada
assets/img/             hero, OG image, logo (SVG vetorizado do PNG original), projetos e depoimentos
favicon.svg / *.png     ícones gerados a partir do "M" do logo
robots.txt, sitemap.xml
vercel.json             redirects das URLs antigas do WordPress + cache
```

Seções da home: Hero → Serviços (4 frentes) → Missão → Como funciona (6 etapas) → Projetos (17, com filtro e lightbox) → Depoimentos (5, reais, do site atual) → Sobre + dados da empresa → FAQ → Contato (formulário que abre o WhatsApp com a mensagem pronta) → Rodapé.

## SEO / GEO

- Title, meta description, canonical, Open Graph.
- JSON-LD: `GeneralContractor` + `RealEstateAgent` (NAP, CNPJ, fundador, serviços, redes), `WebSite` e `FAQPage`.
- Um H1, hierarquia de headings, alt descritivo em todas as imagens.
- Redirects 301 de `/sobre/`, `/servicos/`, `/contato/`, `/portfolio/` e `/portfolio/*` para as âncoras da home (`vercel.json`). Em outro host, recriar esses redirects lá.

## Medição

Todo CTA tem `data-track` e envia `{event: "cta_click", cta: "<nome>"}` para o `dataLayer`. Basta instalar o GTM/GA4 no `<head>` (o ponto está marcado com um comentário) e criar a tag a partir do evento `cta_click`.

## Pendências: confirmar com o cliente antes de publicar

1. **"Interiores N e C"**: no site atual está como interiores, mas as 5 imagens do projeto são de fachada. Aqui foi renomeado para "Residência N e C". Confirmar.
2. **Facebook**: o site usa `facebook.com/macchio.imobi`, mas a busca do Google mostra `facebook.com/macchio.eng`. Confirmar qual é o oficial.
3. **Razão social e CNPJ** (40.033.204/0001-43) vieram de bases públicas de CNPJ, não do site atual. Confirmar.
4. **CREA/SC 177418-0**: confirmar se é o registro da empresa ou o pessoal do Djonas e ajustar o rótulo.
5. **Foto do Djonas** e do escritório: não existem no site atual. Com elas, a seção "Sobre" ganha bastante força.
6. **Logo em vetor oficial** (SVG/AI): o logo aqui foi vetorizado a partir de um PNG de 160×44 px. Ficou fiel, mas o ideal é usar o original.
7. **Domínio da imobiliária** (macchioimobiliaria.com.br): decidir se ele será unificado neste site com redirect 301. É o recomendado, para não dividir autoridade.
8. **Credenciamento Caixa**: o site atual não menciona, então este também não. Se for real, entra como prova forte no hero e no FAQ.

## Próximos passos sugeridos (v2)

- Uma página por serviço, com intenção local: financiamento imobiliário, projetos e regularização, construção/gerenciamento e imóveis em Rio do Sul.
- Uma página por projeto, com a galeria completa (cada projeto tem de 4 a 10 renders no site atual).
- Google Business Profile: integrar as avaliações reais. Não usar `aggregateRating` com dados próprios.

## Como visualizar e publicar

- Visualizar: abrir `index.html` no navegador, ou rodar `python3 -m http.server` nesta pasta e acessar `http://localhost:8000`.
- Vercel: novo projeto apontando para este repositório com **Root Directory = `sites/macchio-engenharia`**, framework "Other" e sem build command.
- Qualquer hospedagem estática (Hostinger, Netlify, Cloudflare Pages): subir o conteúdo desta pasta.
