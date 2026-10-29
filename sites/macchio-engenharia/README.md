# Macchio Engenharia — novo site (v2)

Redesign do site https://macchioengenharia.com.br/ (WordPress 6.1 + Elementor) como site estático: HTML, CSS e JS puros, sem framework. As páginas são geradas por um script Python a partir de um JSON com os dados das obras.

## Direção visual

- **Monocromático**, como a identidade atual (logo branco sobre preto): preto `#0a0a0a`, branco e cinzas. A cor fica nas fotos das obras.
- **Tipografia:** Geist (títulos grandes e leves, entrelinha justa) e Geist Mono para dados técnicos (m², cidade, numeração das seções). Licença OFL, fontes auto-hospedadas.
- **Logo:** vetorizado a partir do PNG original (160×44 px) e usado também em tamanho grande no rodapé.

## Páginas

| URL | Conteúdo |
|---|---|
| `/` | Hero em tela cheia com 4 obras se alternando e os dados de cada uma · manifesto · obras selecionadas em rolagem horizontal fixada · serviços em acordeão com imagem · processo em 6 etapas · depoimentos · sobre · FAQ · contato |
| `/projetos/` | Índice das 17 obras: grade editorial assimétrica ou lista com prévia da foto no hover; filtro por tipo |
| `/projetos/<obra>/` | Página de cada obra: foto em tela cheia, ficha técnica (tipo, cidade, área, escopo), descrição real da obra, galeria completa com ampliação, plantas humanizadas (quando houver), CTA de WhatsApp com o nome da obra e link para a próxima obra |

Interações: transição suave entre páginas (View Transitions API), cursor "Ver projeto" sobre as obras, revelação das imagens ao rolar, header que se esconde ao descer a página e menu em tela cheia no celular. Tudo respeita `prefers-reduced-motion`.

## Antes × depois (home, medido em 29/10/2026 com Chromium, sem limitar a rede)

| | Site atual | Novo site |
|---|---|---|
| Peso da carga inicial (desktop) | 1.329 KB | ~510 KB (texto com gzip + fonte + hero e próximo slide) |
| Requisições | 53 | 11 |
| Imagens do portfólio | PNGs de 1,3 a 33 MB, só a capa na listagem | WebP 800/1600 px, galeria completa (94 perspectivas + 3 plantas) |
| Páginas de obra indexáveis | 17, sem texto estruturado | 17, com ficha técnica, schema e 301 das URLs antigas |

O LCP só vale ser comparado depois do deploy, medido no PageSpeed.

## SEO / GEO

- Home: `GeneralContractor` + `RealEstateAgent`, `WebSite`, `FAQPage`. Índice: `CollectionPage` + `BreadcrumbList`. Obras: `CreativeWork` (cidade, descrição, imagem) + `BreadcrumbList`.
- Title, description e imagem OG próprios por obra (`assets/img/projetos/<obra>/og.jpg`).
- `vercel.json`: 301 de cada `/portfolio/<slug-antigo>/` para a nova `/projetos/<obra>/`, além de `/sobre`, `/servicos`, `/contato` e `/portfolio`.
- `sitemap.xml` com as 19 URLs.

## Medição

Todo CTA tem `data-track` e envia `{event: "cta_click", cta: "<nome>"}` para o `dataLayer`. Basta instalar o GTM/GA4 no `<head>` (o ponto está marcado com um comentário em `_build/build.py`).

## Como editar

1. Dados das obras: `_build/projetos.json` (nome, tipo, cidade, área, escopo, descrição, imagens).
2. Textos da home, serviços, FAQ e depoimentos: constantes no topo de `_build/build.py`.
3. Gerar as páginas: `python3 _build/build.py` (precisa do Pillow para as imagens OG).
4. Estilos: `assets/css/site.css`. Interações: `assets/js/site.js`.

Nova obra: criar `assets/img/projetos/<slug>/01-800.webp`, `01-1600.webp`… (01 é a capa) e adicionar a entrada no JSON.

## Pendências: confirmar com o cliente antes de publicar

1. **Cidade da Residência F e M**: o site atual diz "Autora". Corrigi para Aurora/SC (a obra P e R também é de Aurora). Confirmar.
2. **"Interiores N e C"**: as imagens e a descrição (215,45 m², suítes e garagem) são de uma casa, então foi publicada como "Residência N e C".
3. **Interiores J e D**: a descrição é de uma ampliação (106,36 m²), e as imagens são dos interiores. Tipo definido como "Ampliação e interiores".
4. **"A execução dessa obra também será da Macchio"** (P e R e Multifamiliares 01, 02 e 03): aparece como escopo "Projeto e execução". Confirmar se as obras foram executadas e, se houver, enviar fotos da obra pronta, que valem mais que render.
5. **Correções de texto** feitas nas descrições: "lavado" → "lavabo", "pra" → "para", "demi suíte" → "demi-suíte", pontuação na Residência L e D.
6. **Facebook**: o site usa `/macchio.imobi`, mas o Google mostra `/macchio.eng`.
7. **Razão social e CNPJ** vieram de bases públicas de CNPJ. Confirmar, junto com quem é o titular do CREA 177418-0.
8. **Logo vetorial oficial** (SVG/AI) e **foto do Djonas e do escritório**.
9. **Domínio da imobiliária** (macchioimobiliaria.com.br): recomendo unificar aqui com 301.
10. **Credenciamento na Caixa**: o site atual não menciona. Se existir, entra no hero e no FAQ.

## Publicar

- Vercel: projeto com **Root Directory = `sites/macchio-engenharia`**, framework "Other" e sem build command (as páginas já estão geradas). `_build/` e este README ficam fora do deploy (`.vercelignore`).
- Outra hospedagem estática: subir a pasta (sem `_build/`) e recriar os redirects do `vercel.json`.
