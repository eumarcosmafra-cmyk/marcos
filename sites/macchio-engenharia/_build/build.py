"""Gera as páginas estáticas do site da Macchio Engenharia.

Uso:  python3 _build/build.py
Lê _build/projetos.json e escreve index.html, projetos/index.html,
projetos/<slug>/index.html, sitemap.xml e as imagens OG dos projetos.
"""
import html
import json
import re
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://macchioengenharia.com.br/"
WA_NUMBER = "5547991723557"
PHONE_HREF = "tel:+5547991723557"
PHONE = "(47) 99172-3557"
EMAIL = "contato@macchioengenharia.com.br"
ADDRESS = "R. XV de Novembro, 336, sala 01, Centro, Rio do Sul/SC"
CEP = "89160-033"
MAPS = "https://www.google.com/maps/search/?api=1&query=Rua+XV+de+Novembro%2C+336%2C+Centro%2C+Rio+do+Sul+-+SC%2C+89160-033"
INSTAGRAM = "https://www.instagram.com/macchio.eng"
FACEBOOK = "https://www.facebook.com/macchio.imobi"
CNPJ = "40.033.204/0001-43"
CREA = "CREA/SC 177418-0"
CRECI = "CRECI 6174-J"

PROJECTS = json.loads((ROOT / "_build/projetos.json").read_text(encoding="utf-8"))
BY_SLUG = {p["slug"]: p for p in PROJECTS}
CATS = [("all", "Todos"), ("unifamiliar", "Residências"), ("multifamiliar", "Multifamiliares"), ("interiores", "Interiores")]

e = html.escape


def wa(msg):
    return f"https://wa.me/{WA_NUMBER}?text={quote(msg)}"


def two(n):
    return f"{n:02d}"


def info_line(p):
    return " · ".join(x for x in (p["city"], p["area"]) if x)


# ---------- imagens ----------
def img_src(slug, file, prefix):
    folder = ROOT / "assets/img/projetos" / slug
    widths = [w for w in (800, 1280, 1600, 1920, 2400) if (folder / f"{file}-{w}.webp").exists()]
    base = f"{prefix}assets/img/projetos/{slug}/{file}"
    return f"{base}-800.webp", ", ".join(f"{base}-{w}.webp {w}w" for w in widths), f"{base}-{widths[-1]}.webp"


def img_tag(slug, file, prefix, alt, sizes, eager=False, vt=None, lazy_attr=False, w=800, h=450):
    src, srcset, _ = img_src(slug, file, prefix)
    style = f' style="view-transition-name: {vt}"' if vt else ""
    if lazy_attr:
        return f'<img data-src="{src}" data-srcset="{srcset}" sizes="{sizes}" width="{w}" height="{h}" alt="{e(alt)}" decoding="async">'
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<img src="{src}" srcset="{srcset}" sizes="{sizes}" width="{w}" height="{h}" {load} decoding="async" alt="{e(alt)}"{style}>'


def cover_tag(p, prefix, sizes, eager=False, vt=True):
    c = p["renders"][0]
    return img_tag(p["slug"], c["file"], prefix, p["cover_alt"], sizes, eager=eager, vt=f"p-{p['slug']}" if vt else None, w=c["w"], h=c["h"])


# ---------- ícones ----------
ICONS = """
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <symbol id="logo" viewBox="5 1.5 143 31"><path fill="currentColor" fill-rule="evenodd" d="{WORD}"/><text x="5" y="31.6" textLength="143" lengthAdjust="spacingAndGlyphs" font-size="5.4" font-weight="500" fill="currentColor">ENGENHARIA E NEGÓCIOS IMOBILIÁRIOS</text></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></g></symbol>
    <symbol id="i-up" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></g></symbol>
    <symbol id="i-prev" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4M10 6l-6 6 6 6"/></g></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></g></symbol>
    <symbol id="i-wa" viewBox="0 0 24 24"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41Z"/></symbol>
  </svg>"""


def arrow_pill_icon(icon="i-arrow"):
    return f'<span class="pill-ic" aria-hidden="true"><svg><use href="#{icon}"/></svg><svg><use href="#{icon}"/></svg></span>'


# ---------- layout ----------
def head(prefix, title, desc, path, og_image, jsonld, preload=""):
    return f"""<!doctype html>
<html lang="pt-BR" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="{SITE}{path}">
  <meta name="theme-color" content="#0a0a0a">
  <link rel="icon" href="{prefix}favicon.svg" type="image/svg+xml">
  <link rel="icon" href="{prefix}favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="Macchio Engenharia e Negócios Imobiliários">
  <meta property="og:url" content="{SITE}{path}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:image" content="{SITE}{og_image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script>document.documentElement.classList.replace("no-js", "js")</script>
  <link rel="preload" href="{prefix}assets/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin>
{preload}  <link rel="stylesheet" href="{prefix}assets/css/site.css">
  <script src="{prefix}assets/js/site.js" defer></script>
  <!-- Google Tag Manager / GA4: inserir o snippet aqui. Os cliques de CTA já vão para o dataLayer (evento "cta_click"). -->
  <script type="application/ld+json">
{json.dumps(jsonld, ensure_ascii=False, indent=2)}
  </script>
</head>
<body>"""


def header(prefix, current="", solid=False):
    home = prefix or "./"
    links = [("projetos", f"{prefix}projetos/", "Projetos"), ("servicos", f"{home}#servicos", "Serviços"),
             ("processo", f"{home}#processo", "Processo"), ("sobre", f"{home}#sobre", "Sobre"), ("contato", f"{home}#contato", "Contato")]
    nav = "\n        ".join(f'<a href="{h}"{" aria-current=\"page\"" if k == current else ""}>{t}</a>' for k, h, t in links)
    menu_links = "\n      ".join(f'<a href="{h}"><span>{two(i)}</span>{t}</a>' for i, (k, h, t) in enumerate(links, 1))
    msg = wa("Olá! Vim pelo site da Macchio e gostaria de conversar.")
    return f"""{ICONS}
  <a class="skip" href="#conteudo">Pular para o conteúdo</a>
  <header class="hd" data-header{" data-solid" if solid else ""}>
    <div class="wrap hd-in">
      <a class="hd-logo" href="{home}" aria-label="Macchio Engenharia e Negócios Imobiliários, página inicial"><svg aria-hidden="true"><use href="#logo"/></svg></a>
      <nav class="hd-nav" aria-label="Principal">
        {nav}
      </nav>
      <a class="pill pill--light pill--sm hd-cta" href="{msg}" target="_blank" rel="noopener" data-track="whatsapp_header">Fale conosco {arrow_pill_icon("i-up")}</a>
      <button class="hd-menu" type="button" data-menu-open aria-expanded="false" aria-haspopup="dialog">Menu <i aria-hidden="true"></i></button>
    </div>
  </header>
  <dialog class="menu" data-menu aria-label="Menu">
    <div class="wrap menu-top">
      <a class="hd-logo" href="{home}" aria-label="Página inicial"><svg aria-hidden="true"><use href="#logo"/></svg></a>
      <button class="hd-menu" type="button" data-menu-close>Fechar</button>
    </div>
    <nav class="wrap menu-nav" aria-label="Menu principal">
      {menu_links}
    </nav>
    <div class="wrap menu-foot">
      <a class="pill pill--light" href="{msg}" target="_blank" rel="noopener" data-track="whatsapp_menu">Conversar no WhatsApp {arrow_pill_icon("i-up")}</a>
      <p>{PHONE} · {EMAIL}<br>{ADDRESS}</p>
    </div>
  </dialog>"""


def footer(prefix):
    home = prefix or "./"
    return f"""
  <footer class="ft">
    <div class="wrap">
      <div class="ft-cols">
        <div>
          <h2 class="label label--light">Macchio</h2>
          <p class="muted">Engenharia e imobiliária em Rio do Sul/SC.<br>Financiamento, projeto, obra e imóvel com a mesma equipe.</p>
        </div>
        <div>
          <h2 class="label label--light">Navegação</h2>
          <ul>
            <li><a href="{prefix}projetos/">Projetos</a></li>
            <li><a href="{home}#servicos">Serviços</a></li>
            <li><a href="{home}#processo">Processo</a></li>
            <li><a href="{home}#sobre">Sobre</a></li>
            <li><a href="{home}#perguntas">Perguntas frequentes</a></li>
          </ul>
        </div>
        <div>
          <h2 class="label label--light">Contato</h2>
          <ul>
            <li><a href="{PHONE_HREF}">{PHONE}</a></li>
            <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
            <li><a href="{MAPS}" target="_blank" rel="noopener">R. XV de Novembro, 336, sala 01<br>Centro, Rio do Sul/SC, {CEP}</a></li>
          </ul>
        </div>
        <div>
          <h2 class="label label--light">Redes</h2>
          <ul>
            <li><a href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram</a></li>
            <li><a href="{FACEBOOK}" target="_blank" rel="noopener">Facebook</a></li>
          </ul>
        </div>
      </div>
      <svg class="ft-logo" aria-hidden="true"><use href="#logo"/></svg>
      <div class="ft-legal mono">
        <span>© <span data-year>2026</span> Macchio Engenharia e Negócios Imobiliários Ltda</span>
        <span>CNPJ {CNPJ} · {CREA} · {CRECI}</span>
      </div>
    </div>
  </footer>
  <a class="fab" href="{wa('Olá! Vim pelo site da Macchio e gostaria de conversar.')}" target="_blank" rel="noopener" data-fab data-track="whatsapp_flutuante"><svg aria-hidden="true"><use href="#i-wa"/></svg> WhatsApp</a>"""


def page(prefix, title, desc, path, og_image, jsonld, body, current="", solid=False, preload=""):
    return head(prefix, title, desc, path, og_image, jsonld, preload) + header(prefix, current, solid) + body + footer(prefix) + "\n</body>\n</html>\n"


# ---------- dados compartilhados ----------
ORG_ID = SITE + "#empresa"
SERVICES = [
    ("Financiamento imobiliário",
     "Conhecemos o processo e cuidamos do trâmite com as instituições financeiras, para o seu financiamento andar mais rápido e sem a burocracia ficar com você.",
     "Conversar sobre financiamento", "Olá! Vim pelo site e quero ajuda com financiamento imobiliário.", ("residencia-s-e-g", "02"), "whatsapp_financiamento"),
    ("Projetos de engenharia e interiores",
     "Projetos residenciais, comerciais e industriais, design de interiores e regularização de obras, sempre dentro das normas e requisitos exigidos.",
     "Pedir orçamento de projeto", "Olá! Vim pelo site e quero um orçamento de projeto.", ("interiores-j-e-d", "02"), "whatsapp_projetos"),
    ("Execução e gerenciamento de obras",
     "Mão de obra qualificada e material de primeira linha. No gerenciamento, você deixa a obra por nossa conta e não precisa lidar com o estresse do dia a dia.",
     "Falar sobre a minha obra", "Olá! Vim pelo site e quero conversar sobre a execução da minha obra.", ("residencia-p-e-r", "03"), "whatsapp_obras"),
    ("Compra e venda de imóveis",
     "Corretores experientes para quem quer fazer uma boa compra e para quem precisa vender o seu imóvel. Afinal, também somos imobiliária.",
     "Comprar ou vender um imóvel", "Olá! Vim pelo site e quero comprar ou vender um imóvel.", ("multifamiliar-03", "01"), "whatsapp_imoveis"),
]
STEPS = [
    ("Conversa inicial", "Entendemos o que você quer construir, comprar ou vender e o orçamento disponível. Sem compromisso."),
    ("Terreno ou imóvel", "Se você ainda não tem, pesquisamos e apresentamos opções de terrenos e imóveis que façam sentido para você."),
    ("Projeto", "Projeto arquitetônico e de engenharia, da planta à escolha de cores e pisos, já pensando em ampliações futuras."),
    ("Financiamento", "Organizamos o processo e acompanhamos o trâmite junto à instituição financeira."),
    ("Obra", "Execução ou gerenciamento, com reuniões frequentes e acompanhamento das compras dentro do orçamento planejado."),
    ("Entrega e pós-obra", "Depois das chaves, a equipe segue disponível para tirar dúvidas e ajudar no que surgir."),
]
TESTIMONIALS = [
    ("Adriano Rengel", "Projeto e construção da casa", None,
     "Desde o início, a Macchio esteve ao nosso lado em cada detalhe: do projeto arquitetônico à escolha de cores e pisos, inclusive, planejando o futuro e expansão da casa. […] As reuniões constantes nos ajudaram a entender cada etapa do processo, trazendo transparência e segurança.",
     ["Construir nossa casa sempre foi um grande sonho, mas, como muitos dizem, o processo pode ser desafiador e cheio de incertezas. No entanto, com a Macchio e a empreiteira MA3, tudo correu de maneira surpreendentemente tranquila e organizada. Desde o início, a Macchio esteve ao nosso lado em cada detalhe: do projeto arquitetônico à escolha de cores e pisos, inclusive, planejando o futuro e expansão da casa. Eles nos acompanharam até mesmo nas compras, garantindo que tudo se encaixasse perfeitamente dentro do orçamento planejado. Como éramos muito leigos no processo, as reuniões constantes nos ajudaram a entender cada etapa do processo, trazendo transparência e segurança.",
      "Claro, tivemos momentos de ansiedade e dúvidas, mas a equipe sempre esteve pronta para nos orientar e hoje estamos imensamente felizes com nossa casa pronta.",
      "Além disso, mesmo após a entrega, o suporte da equipe continua excelente. Sempre que surge alguma dúvida ou necessidade, eles estão disponíveis para ajudar. Essa qualidade no atendimento faz toda a diferença!",
      "Sem dúvida, recomendamos a Macchio e a MA3 para quem busca um trabalho sério, transparente e de alta qualidade. E se um dia decidirmos construir novamente, já sabemos a quem recorrer. Muito obrigado por tornarem nosso sonho realidade!"]),
    ("Neiva Fátima Sacon", "Venda e compra de imóvel", "neiva",
     "A venda da casa e compra do apartamento foi rápida e dentro do prazo previsto. Destaco a agilidade, preocupação e responsabilidade com toda parte burocrática. Minha expectativa e planejamento foram atendidos.", None),
    ("Susana Carvalho Eyng", "Venda, projeto e obra", "susana",
     "Para executar esse longo processo que costuma ser bastante complicado e cansativo, escolhi e confiei no trabalho do corretor Djonas, da Macchio, que se mostrou sempre muito atencioso e prestativo, sem medir esforços para rapidamente vender minha antiga casa e projetar e construir com excelência minha atual morada.", None),
    ("Diego Butzke", "Compra de imóvel", "diego",
     "Agendamos uma conversa sem compromisso para o dia seguinte, e depois de uma boa conversa, sabia que poderia confiar no profissionalismo dele. Fechamos o negócio no mesmo dia.", None),
    ("Amauri Carboni Bitencourt", "Busca de terreno · Professor do IFC, Rio do Sul", "amauri",
     "Em 2018 procurei alguém que pudesse pesquisar e me apresentar algumas opções de terrenos em Rio do Sul. […] Ele se empenhou em atender minha busca e se mostrou um profissional competente, sempre atento às minhas expectativas e anseios.", None),
]
FAQ = [
    ("A Macchio é imobiliária ou construtora?",
     f"As duas. Somos imobiliária ({CRECI}) e empresa de engenharia ({CREA}): compramos e vendemos imóveis, elaboramos projetos, cuidamos do financiamento e executamos ou gerenciamos a obra, com a mesma equipe do início ao fim."),
    ("Vocês ajudam a conseguir o financiamento imobiliário?",
     "Sim. Nossa equipe conhece o processo de financiamento imobiliário e cuida do trâmite com as instituições financeiras, para que ele seja mais ágil e menos burocrático para você."),
    ("Qual a diferença entre execução e gerenciamento de obra?",
     "Na execução, nossa equipe constrói o seu projeto com mão de obra qualificada e material de primeira linha, acompanhando todas as etapas. No gerenciamento, você deixa tudo por nossa conta e não precisa se preocupar com o estresse de uma obra."),
    ("Vocês fazem regularização de obras?",
     "Sim. Elaboramos os projetos necessários para regularizar obras residenciais e comerciais, seguindo todas as normas e requisitos exigidos."),
    ("Atendem projetos comerciais e industriais?",
     "Sim. Além de residências unifamiliares e multifamiliares, desenvolvemos projetos técnicos para obras comerciais e industriais."),
    ("Onde fica o escritório da Macchio?",
     f"Na Rua XV de Novembro, 336, sala 01, Centro, Rio do Sul/SC, CEP {CEP}. Também atendemos pelo WhatsApp {PHONE} e pelo e-mail {EMAIL}."),
]
ORG = {
    "@type": ["GeneralContractor", "RealEstateAgent"],
    "@id": ORG_ID,
    "name": "Macchio Engenharia e Negócios Imobiliários",
    "alternateName": "Macchio Engenharia",
    "legalName": "Macchio Engenharia e Negócios Imobiliários Ltda",
    "taxID": CNPJ,
    "url": SITE,
    "logo": SITE + "assets/img/logo-macchio.png",
    "image": SITE + "assets/img/og-macchio.jpg",
    "description": "Engenharia e imobiliária na mesma equipe em Rio do Sul/SC: financiamento imobiliário, projetos de engenharia e interiores, regularização, execução e gerenciamento de obras e compra e venda de imóveis.",
    "telephone": "+55 47 99172-3557",
    "email": EMAIL,
    "address": {"@type": "PostalAddress", "streetAddress": "Rua XV de Novembro, 336, sala 01", "addressLocality": "Rio do Sul",
                "addressRegion": "SC", "postalCode": CEP, "addressCountry": "BR"},
    "areaServed": {"@type": "City", "name": "Rio do Sul"},
    "founder": {"@type": "Person", "name": "Djonas Roberto Matias", "jobTitle": "Engenheiro civil e corretor de imóveis"},
    "sameAs": [INSTAGRAM, FACEBOOK],
    "knowsAbout": ["Financiamento imobiliário", "Projetos de engenharia civil", "Design de interiores", "Regularização de obras",
                   "Execução de obras", "Gerenciamento de obras", "Compra e venda de imóveis"],
}


def breadcrumb(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": n, "item": SITE + u} for i, (n, u) in enumerate(items, 1)]}


# ---------- home ----------
HERO_SLIDES = [("residencia-a-e-d", "01"), ("residencia-l-e-d", "02"), ("residencia-l-e-g", "03"), ("multifamiliar-01", "03")]
FEATURED = ["residencia-f-e-m", "residencia-p-e-r", "residencia-l-e-g", "interiores-j-e-j", "multifamiliar-03", "residencia-l-e-d"]


def build_home():
    p0 = ""
    slides = []
    for i, (slug, file) in enumerate(HERO_SLIDES):
        p = BY_SLUG[slug]
        alt = f"{p['name']}, projeto Macchio em {p['city']}/SC"
        tag = img_tag(slug, file, p0, alt, "100vw", eager=(i == 0), lazy_attr=(i > 0))
        slides.append(f'<figure class="hero-slide{" is-active" if i == 0 else ""}" data-slide data-name="{e(p["name"])}" data-info="{e(info_line(p))}" data-href="projetos/{slug}/">{tag}</figure>')
    first = BY_SLUG[HERO_SLIDES[0][0]]
    dots = "".join(f'<button type="button" data-dot aria-label="Mostrar projeto {i + 1}"><i></i></button>' for i in range(len(HERO_SLIDES)))
    _, hero_srcset, _ = img_src(HERO_SLIDES[0][0], HERO_SLIDES[0][1], p0)
    preload = f'  <link rel="preload" as="image" imagesrcset="{hero_srcset}" imagesizes="100vw" fetchpriority="high">\n'

    cards = []
    for i, slug in enumerate(FEATURED, 1):
        p = BY_SLUG[slug]
        cards.append(f"""          <li class="work-card">
            <a href="projetos/{slug}/" data-cursor="Ver projeto">
              <div class="work-media">{cover_tag(p, p0, "(min-width: 1024px) 34vw, (min-width: 700px) 56vw, 84vw")}</div>
              <div class="work-cap"><span class="mono num">{two(i)}</span><h3>{e(p["name"])}</h3><span class="mono">{e(p["type"])} · {e(info_line(p))}</span></div>
            </a>
          </li>""")
    cards.append(f"""          <li class="work-card work-all">
            <a href="projetos/">
              <span class="mono">Portfólio completo</span>
              <span class="h3">Ver todos os {len(PROJECTS)} projetos</span>
              <span class="link-u">Abrir portfólio <svg aria-hidden="true"><use href="#i-arrow"/></svg></span>
            </a>
          </li>""")

    svc_items, svc_imgs = [], []
    for i, (title, text, cta, msg, (s, f), tr) in enumerate(SERVICES):
        p = BY_SLUG[s]
        mobile_img = img_tag(s, f, p0, "", "(min-width: 1024px) 1px, 100vw")
        svc_items.append(f"""          <div class="svc-item{" is-open" if i == 0 else ""}">
            <h3><button class="svc-btn" type="button" id="svc-b{i}" aria-expanded="{"true" if i == 0 else "false"}" aria-controls="svc-p{i}"><span class="mono">{two(i + 1)}</span><span class="svc-name">{title}</span><span class="svc-ic" aria-hidden="true"></span></button></h3>
            <div class="svc-panel" id="svc-p{i}" role="region" aria-labelledby="svc-b{i}">
              <div class="svc-panel-in"><div class="svc-panel-body">
                {mobile_img}
                <p>{text}</p>
                <a class="link-u" href="{wa(msg)}" target="_blank" rel="noopener" data-track="{tr}">{cta} <svg aria-hidden="true"><use href="#i-up"/></svg></a>
              </div></div>
            </div>
          </div>""")
        src, srcset, _ = img_src(s, f, p0)
        svc_imgs.append(f'<img data-svc-img src="{src}" srcset="{srcset}" sizes="34vw" width="800" height="450" loading="lazy" decoding="async" alt=""{" class=\"is-active\"" if i == 0 else ""}>')

    steps = "\n".join(f'          <li class="proc-step" data-step><span class="mono">{two(i)}</span><div><h3>{t}</h3><p>{d}</p></div></li>'
                      for i, (t, d) in enumerate(STEPS, 1))

    tst = []
    for i, (name, tag, photo, quote_, full) in enumerate(TESTIMONIALS):
        avatar = (f'<img src="assets/img/depoimentos/{photo}.webp" width="56" height="56" loading="lazy" decoding="async" alt="">' if photo
                  else f'<span class="ini" aria-hidden="true">{"".join(w[0] for w in name.split()[:2])}</span>')
        more = ""
        if full:
            more = '<details class="tst-more"><summary>Ler depoimento completo</summary><div>' + "".join(f"<p>{x}</p>" for x in full) + "</div></details>"
        tst.append(f"""          <figure class="tst-item{" is-active" if i == 0 else ""}" aria-hidden="{"false" if i == 0 else "true"}">
            <blockquote><p>“{quote_}”</p></blockquote>
            {more}
            <figcaption>{avatar}<span><strong>{name}</strong><span class="mono">{tag}</span></span></figcaption>
          </figure>""")

    faq = "\n".join(f"""          <details class="faq-item"{" open" if i == 0 else ""}>
            <summary>{q}<span class="svc-ic" aria-hidden="true"></span></summary>
            <div class="faq-a"><p>{a}</p></div>
          </details>""" for i, (q, a) in enumerate(FAQ))

    about_img = img_tag("residencia-l-e-d", "06", p0, "Área gourmet integrada à cozinha, projeto Residência L e D", "(min-width: 1024px) 40vw, 100vw")
    cta_img = img_tag("residencia-n-e-a", "06", p0, "", "100vw")

    body = f"""
  <main id="conteudo">
    <section class="hero" data-hero aria-labelledby="hero-title">
      <div class="hero-slides">
        {chr(10).join("        " + s for s in slides).strip()}
      </div>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="wrap hero-content">
        <h1 class="hero-title" id="hero-title"><span class="label">Engenharia e imobiliária · Rio do Sul/SC</span><span class="display">Do terreno<br>à chave.</span></h1>
        <div class="hero-row">
          <p class="hero-sub">Financiamento, projeto, obra e compra ou venda do imóvel com a mesma equipe, do primeiro contato à entrega das chaves.</p>
          <div class="hero-ctas">
            <a class="pill pill--light" href="{wa("Olá! Vim pelo site da Macchio e quero começar um projeto.")}" target="_blank" rel="noopener" data-track="whatsapp_hero">Iniciar meu projeto {arrow_pill_icon("i-up")}</a>
            <a class="link-u" href="projetos/">Ver projetos</a>
          </div>
        </div>
        <div class="hero-meta">
          <a class="hero-proj" href="projetos/{first["slug"]}/" data-slide-link><span class="mono" data-slide-num>01 / {two(len(HERO_SLIDES))}</span><strong data-slide-name>{e(first["name"])}</strong><span class="mono" data-slide-info>{e(info_line(first))}</span></a>
          <div class="hero-dots">{dots}</div>
        </div>
      </div>
    </section>

    <section class="wrap intro" aria-labelledby="intro-label">
      <span class="label" id="intro-label">Macchio Engenharia e Negócios Imobiliários</span>
      <p class="intro-text" data-words>Não somos só imobiliária nem só construtora. A Macchio reúne engenharia e negócios imobiliários para que o seu projeto tenha um único responsável, do terreno à chave.</p>
      <dl class="facts">
        <div><dt class="label">Engenharia</dt><dd>{CREA}</dd></div>
        <div><dt class="label">Imobiliária</dt><dd>{CRECI}</dd></div>
        <div><dt class="label">Portfólio</dt><dd>{len(PROJECTS)} projetos</dd></div>
        <div><dt class="label">Escritório</dt><dd>Centro, Rio do Sul/SC</dd></div>
      </dl>
    </section>

    <section class="work dark" id="projetos" aria-labelledby="work-title">
      <div class="wrap sec-head">
        <span class="label">01 — Projetos</span>
        <h2 class="h2" id="work-title">Projetos selecionados<sup>{len(PROJECTS)}</sup></h2>
        <div class="sec-aside">
          <p class="muted">Residências, sobrados e interiores desenvolvidos pela nossa equipe, do estudo à execução.</p>
          <a class="link-u" href="projetos/">Ver todos os projetos <svg aria-hidden="true"><use href="#i-arrow"/></svg></a>
        </div>
      </div>
      <div class="work-pin" data-hscroll>
        <div class="work-sticky">
          <ul class="work-track" data-rail>
{chr(10).join(cards)}
          </ul>
          <div class="wrap work-bar" aria-hidden="true"><span class="mono">Role para explorar</span><span class="work-bar-line"><i data-bar></i></span></div>
        </div>
      </div>
    </section>

    <section class="wrap sec" id="servicos" aria-labelledby="svc-title">
      <div class="sec-head">
        <span class="label">02 — Serviços</span>
        <h2 class="h2" id="svc-title">Quatro frentes, uma só equipe.</h2>
        <p class="muted">Não somos só imobiliária nem só construtora. Começar e terminar com a mesma equipe significa menos burocracia e um único responsável.</p>
      </div>
      <div class="svc-body">
        <div class="svc-list" data-svc-list>
{chr(10).join(svc_items)}
        </div>
        <div class="svc-visual" aria-hidden="true">
          {"".join(svc_imgs)}
        </div>
      </div>
    </section>

    <section class="proc sec" id="processo" aria-labelledby="proc-title">
      <div class="wrap proc-grid">
        <div class="proc-head">
          <span class="label">03 — Processo</span>
          <h2 class="h2" id="proc-title">Do terreno<br>à chave.</h2>
          <p>Você pode seguir o caminho completo ou contratar só a etapa de que precisa.</p>
          <p class="proc-count mono"><b data-proc-num>01</b> / {two(len(STEPS))}</p>
        </div>
        <ol class="proc-steps">
{steps}
        </ol>
      </div>
    </section>

    <section class="wrap sec" id="depoimentos" aria-labelledby="tst-title" data-tst>
      <div class="tst-top">
        <h2 class="label" id="tst-title">04 — Depoimentos</h2>
        <div class="tst-ctrl">
          <span class="mono" data-tst-count aria-live="polite">01 / {two(len(TESTIMONIALS))}</span>
          <button class="circ" type="button" data-tst-prev aria-label="Depoimento anterior"><svg aria-hidden="true"><use href="#i-prev"/></svg></button>
          <button class="circ" type="button" data-tst-next aria-label="Próximo depoimento"><svg aria-hidden="true"><use href="#i-arrow"/></svg></button>
        </div>
      </div>
      <div class="tst-view">
{chr(10).join(tst)}
      </div>
    </section>

    <section class="sec dark" id="sobre" aria-labelledby="about-title">
      <div class="wrap about-grid">
        <figure class="about-media" data-reveal="img">{about_img}<figcaption class="mono">Residência L e D</figcaption></figure>
        <div class="about-copy">
          <span class="label">05 — Sobre</span>
          <h2 class="h2" id="about-title">Engenheiro e corretor na mesma mesa.</h2>
          <p class="lead">A Macchio nasceu da vontade de tornar leve e compreensível um processo conhecido pela dificuldade e pela burocracia.</p>
          <p>Foi fundada por Djonas Roberto Matias, engenheiro civil formado em 2017 e corretor de imóveis, com experiência em venda de imóveis, projetos, gerenciamento e execução de obras e financiamento imobiliário. Por isso a empresa atende as quatro frentes, com a mesma equipe do início ao fim.</p>
          <dl class="about-facts">
            <div><dt class="mono">Fundador</dt><dd>Djonas Roberto Matias</dd></div>
            <div><dt class="mono">Registros</dt><dd>{CREA} · {CRECI}</dd></div>
            <div><dt class="mono">Valores</dt><dd>Inovação no processo, ética, respeito e comprometimento</dd></div>
            <div><dt class="mono">Missão</dt><dd>Comprar com prudência, projetar com conhecimento e construir com segurança</dd></div>
          </dl>
        </div>
      </div>
    </section>

    <section class="wrap sec" id="perguntas" aria-labelledby="faq-title">
      <div class="faq-grid">
        <div class="faq-head">
          <span class="label">06 — Perguntas frequentes</span>
          <h2 class="h2" id="faq-title">Antes de você chamar a gente.</h2>
          <p>Não encontrou sua dúvida? <a href="{wa("Olá! Vim pelo site e tenho uma dúvida.")}" target="_blank" rel="noopener" data-track="whatsapp_faq">Pergunte no WhatsApp</a>.</p>
        </div>
        <div class="faq-list">
{faq}
        </div>
      </div>
    </section>

    <section class="cta dark" id="contato" aria-labelledby="cta-title">
      <div class="cta-bg" aria-hidden="true">{cta_img}</div>
      <div class="wrap cta-in">
        <span class="label">07 — Contato</span>
        <h2 class="display" id="cta-title">Vamos começar pelo seu terreno?</h2>
        <div class="cta-grid">
          <form class="cta-form" data-lead-form novalidate>
            <div class="field"><label class="mono" for="f-nome">Seu nome</label><input id="f-nome" name="nome" type="text" autocomplete="name" required></div>
            <div class="field"><label class="mono" for="f-int">Do que você precisa?</label>
              <select id="f-int" name="interesse" required>
                <option value="">Selecione</option>
                <option>construir minha casa</option>
                <option>financiamento imobiliário</option>
                <option>projeto ou regularização de obra</option>
                <option>projeto de interiores</option>
                <option>comprar um imóvel</option>
                <option>vender meu imóvel</option>
                <option>outro assunto</option>
              </select>
            </div>
            <div class="field"><label class="mono" for="f-msg">Mensagem (opcional)</label><textarea id="f-msg" name="mensagem" rows="2"></textarea></div>
            <p class="form-err" data-form-err role="alert"></p>
            <div><button class="pill pill--light" type="submit">Continuar no WhatsApp {arrow_pill_icon("i-up")}</button></div>
          </form>
          <ul class="cta-info">
            <li><a href="{wa("Olá! Vim pelo site da Macchio e gostaria de conversar.")}" target="_blank" rel="noopener" data-track="whatsapp_contato"><span class="mono">WhatsApp</span><span>{PHONE}</span><svg aria-hidden="true"><use href="#i-up"/></svg></a></li>
            <li><a href="{PHONE_HREF}" data-track="telefone_contato"><span class="mono">Telefone</span><span>{PHONE}</span><svg aria-hidden="true"><use href="#i-up"/></svg></a></li>
            <li><a href="mailto:{EMAIL}" data-track="email_contato"><span class="mono">E-mail</span><span>{EMAIL}</span><svg aria-hidden="true"><use href="#i-up"/></svg></a></li>
            <li><a href="{MAPS}" target="_blank" rel="noopener" data-track="mapa_contato"><span class="mono">Escritório · ver no mapa</span><span>{ADDRESS}</span><svg aria-hidden="true"><use href="#i-up"/></svg></a></li>
          </ul>
        </div>
      </div>
    </section>
  </main>"""

    jsonld = {"@context": "https://schema.org", "@graph": [
        {**ORG, "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Serviços Macchio", "itemListElement": [
            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": s[0], "description": s[1]}} for s in SERVICES]}},
        {"@type": "WebSite", "@id": SITE + "#site", "url": SITE, "name": "Macchio Engenharia e Negócios Imobiliários", "inLanguage": "pt-BR", "publisher": {"@id": ORG_ID}},
        {"@type": "FAQPage", "@id": SITE + "#perguntas", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]},
    ]}
    word = (ROOT / "_build/logo-word.path").read_text()
    out = page("", "Macchio Engenharia | Construção, financiamento e imóveis em Rio do Sul/SC",
               "Engenharia e imobiliária na mesma equipe: financiamento imobiliário, projetos, execução e gerenciamento de obras e compra e venda de imóveis em Rio do Sul/SC.",
               "", "assets/img/og-macchio.jpg", jsonld, body, preload=preload)
    (ROOT / "index.html").write_text(out.replace("{WORD}", word), encoding="utf-8")


# ---------- índice de projetos ----------
LAYOUT = ["l-a", "l-b", "l-c", "l-d"]


def build_index():
    pre = "../"
    counts = {c: (len(PROJECTS) if c == "all" else sum(p["cat"] == c for p in PROJECTS)) for c, _ in CATS}
    filters = "".join(f'<button type="button" data-filter="{c}" aria-pressed="{"true" if c == "all" else "false"}">{t}<sup>{counts[c]}</sup></button>' for c, t in CATS)
    cards, rows = [], []
    for i, p in enumerate(PROJECTS):
        cards.append(f"""        <li class="pcard {LAYOUT[i % 4]}" data-cat="{p["cat"]}" data-reveal>
          <a href="{p["slug"]}/" data-cursor="Ver projeto">
            <div class="pcard-media">{cover_tag(p, pre, "(min-width: 900px) 50vw, 100vw", eager=(i < 2))}</div>
            <div class="pcard-cap"><div><h2>{e(p["name"])}</h2><span class="mono">{e(p["type"])}</span></div><span class="mono">{e(info_line(p))}</span></div>
          </a>
        </li>""")
        src, _, _ = img_src(p["slug"], p["renders"][0]["file"], pre)
        rows.append(f"""        <li class="prow" data-cat="{p["cat"]}" data-preview="{src}">
          <a href="{p["slug"]}/"><span class="mono">{two(i + 1)}</span><h2>{e(p["name"])}</h2><span class="mono c-type">{e(p["type"])}</span><span class="mono c-city">{e(p["city"] or "")}</span><span class="mono c-area">{e(p["area"] or "—")}</span></a>
        </li>""")
    body = f"""
  <main id="conteudo" class="dark pidx" data-pidx>
    <div class="wrap pidx-head">
      <span class="label">Portfólio</span>
      <h1 class="display">Projetos<sup>{len(PROJECTS)}</sup></h1>
      <p>Residências unifamiliares, sobrados geminados e interiores desenvolvidos pela equipe Macchio em Rio do Sul e região. Clique em um projeto para ver todas as imagens e o programa da casa.</p>
    </div>
    <div class="pidx-bar">
      <div class="wrap pidx-bar-in">
        <div class="filters" role="group" aria-label="Filtrar projetos">{filters}</div>
        <div class="views" role="group" aria-label="Visualização"><button type="button" data-view="grid" aria-pressed="true">Grade</button><button type="button" data-view="list" aria-pressed="false">Lista</button></div>
      </div>
    </div>
    <div class="wrap">
      <ul class="pgrid" data-pgrid>
{chr(10).join(cards)}
      </ul>
      <ul class="plist" data-plist hidden>
{chr(10).join(rows)}
      </ul>
    </div>
  </main>"""
    jsonld = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "@id": SITE + "projetos/", "url": SITE + "projetos/", "name": "Projetos | Macchio Engenharia",
         "isPartOf": {"@id": SITE + "#site"}, "about": {"@id": ORG_ID},
         "hasPart": [{"@type": "CreativeWork", "name": p["name"], "url": f"{SITE}projetos/{p['slug']}/"} for p in PROJECTS]},
        breadcrumb([("Início", ""), ("Projetos", "projetos/")]),
    ]}
    out = page(pre, "Projetos de casas, sobrados e interiores em Rio do Sul/SC | Macchio Engenharia",
               f"Portfólio Macchio: {len(PROJECTS)} projetos de residências unifamiliares, sobrados geminados e interiores em Rio do Sul e Aurora/SC, com imagens e área de cada obra.",
               "projetos/", "assets/img/og-macchio.jpg", jsonld, body, current="projetos", solid=True)
    word = (ROOT / "_build/logo-word.path").read_text()
    (ROOT / "projetos").mkdir(exist_ok=True)
    (ROOT / "projetos/index.html").write_text(out.replace("{WORD}", word), encoding="utf-8")


# ---------- página de projeto ----------
GAL_PATTERN = ["g-full", "g-half", "g-half", "g-wide", "g-narrow"]


def gallery_classes(n):
    cls = [GAL_PATTERN[i % len(GAL_PATTERN)] for i in range(n)]
    if n and cls[-1] == "g-wide":
        cls[-1] = "g-full"
    elif n and cls[-1] == "g-half" and (n < 2 or cls[-2] != "g-half"):
        cls[-1] = "g-full"
    return cls


def build_project(i, p):
    pre = "../../"
    slug = p["slug"]
    nxt = PROJECTS[(i + 1) % len(PROJECTS)]
    rest = p["renders"][1:]
    total = len(p["renders"])
    items = []
    for j, (r, cls) in enumerate(zip(rest, gallery_classes(len(rest))), 2):
        src, srcset, full = img_src(slug, r["file"], pre)
        alt = f"{p['name']}: perspectiva {j} de {total}"
        sizes = "(min-width: 900px) 50vw, 100vw" if cls in ("g-half", "g-narrow") else "100vw"
        items.append(f'        <button class="pgal-item {cls}" type="button" data-lb-item data-full="{full}" data-reveal="img" aria-label="Ampliar imagem {j}"><img src="{src}" srcset="{srcset}" sizes="{sizes}" width="{r["w"]}" height="{r["h"]}" loading="lazy" decoding="async" alt="{e(alt)}"></button>')
    plans = []
    for j, r in enumerate(p["plans"], 1):
        src, srcset, full = img_src(slug, r["file"], pre)
        plans.append(f'        <button class="pgal-item is-plan" type="button" data-lb-item data-full="{full}" aria-label="Ampliar planta {j}"><img src="{src}" srcset="{srcset}" sizes="(min-width: 900px) 50vw, 100vw" width="{r["w"]}" height="{r["h"]}" loading="lazy" decoding="async" alt="{e(p["name"])}: planta humanizada {j}"></button>')
    plans_html = ""
    if plans:
        plans_html = f'        <h2 class="label pgal-h">Plantas humanizadas</h2>\n' + "\n".join(plans)
    desc = p["desc"]
    lead = desc[0] if desc else ""
    paras = "".join(f"<p>{e(x)}</p>" for x in desc[1:])
    dl = [("Tipo", p["type"]), ("Cidade", f"{p['city']}/SC" if p["city"] else None), ("Área total", p["area"]), ("Escopo", p["scope"]),
          ("Imagens", f"{total} perspectivas" + (f" + {len(p['plans'])} planta{'s' if len(p['plans']) > 1 else ''}" if p["plans"] else ""))]
    dl_html = "".join(f"<div><dt class=\"mono\">{k}</dt><dd>{e(v)}</dd></div>" for k, v in dl if v)
    src0, srcset0, _ = img_src(slug, p["renders"][0]["file"], pre)
    preload = f'  <link rel="preload" as="image" href="{src0}" imagesrcset="{srcset0}" imagesizes="100vw" fetchpriority="high">\n'
    nxt_img = img_tag(nxt["slug"], nxt["renders"][0]["file"], pre, "", "100vw")
    msg = wa(f"Olá! Vi o projeto {p['name']} no site da Macchio e quero conversar sobre um projeto parecido.")
    body = f"""
  <main id="conteudo">
    <section class="ph">
      <figure class="ph-media">{cover_tag(p, pre, "100vw", eager=True)}</figure>
      <div class="wrap ph-in">
        <nav class="crumbs mono" aria-label="Você está em"><a href="{pre}">Início</a><span aria-hidden="true">/</span><a href="../">Projetos</a><span aria-hidden="true">/</span><span aria-current="page">{e(p["name"])}</span></nav>
        <h1 class="display">{e(p["name"])}</h1>
      </div>
    </section>
    <section class="wrap pinfo" aria-label="Sobre o projeto">
      <dl class="pinfo-dl">{dl_html}</dl>
      <div class="pinfo-text">
        <p class="lead">{e(lead)}</p>
        {paras}
      </div>
    </section>
    <section class="wrap pgal" aria-label="Galeria do projeto">
{chr(10).join(items)}
{plans_html}
    </section>
    <section class="wrap pcta" aria-labelledby="pcta-title">
      <h2 class="h2" id="pcta-title">Quer um projeto como este?</h2>
      <div class="pcta-actions">
        <a class="pill" href="{msg}" target="_blank" rel="noopener" data-track="whatsapp_projeto">Conversar no WhatsApp {arrow_pill_icon("i-up")}</a>
        <a class="link-u" href="../">Ver todos os projetos</a>
      </div>
    </section>
    <a class="pnext" href="../{nxt["slug"]}/" data-cursor="Próximo">
      <div class="pnext-media" aria-hidden="true">{nxt_img}</div>
      <div class="wrap pnext-in"><span class="mono">Próximo projeto · {two((i + 1) % len(PROJECTS) + 1)} / {two(len(PROJECTS))}</span><span class="display">{e(nxt["name"])}</span></div>
    </a>
  </main>
  <dialog class="lb" data-lb aria-label="Imagem ampliada">
    <div class="lb-top"><span class="mono">{e(p["name"])}</span><button class="circ" type="button" data-lb-close aria-label="Fechar"><svg aria-hidden="true"><use href="#i-close"/></svg></button></div>
    <figure class="lb-fig"><img alt=""></figure>
    <div class="lb-bot"><span class="mono" data-lb-count></span><div class="lb-nav"><button class="circ" type="button" data-lb-prev aria-label="Imagem anterior"><svg aria-hidden="true"><use href="#i-prev"/></svg></button><button class="circ" type="button" data-lb-next aria-label="Próxima imagem"><svg aria-hidden="true"><use href="#i-arrow"/></svg></button></div></div>
  </dialog>"""
    url = f"projetos/{slug}/"
    cover_full = SITE + img_src(slug, p["renders"][0]["file"], "")[2]
    jsonld = {"@context": "https://schema.org", "@graph": [
        {"@type": "CreativeWork", "@id": SITE + url, "url": SITE + url, "name": p["name"], "genre": p["type"],
         "description": " ".join(desc), "image": [cover_full], "inLanguage": "pt-BR", "creator": {"@id": ORG_ID},
         **({"locationCreated": {"@type": "Place", "address": {"@type": "PostalAddress", "addressLocality": p["city"], "addressRegion": "SC", "addressCountry": "BR"}}} if p["city"] else {})},
        breadcrumb([("Início", ""), ("Projetos", "projetos/"), (p["name"], url)]),
    ]}
    meta_desc = f"{p['name']}: {p['type'].lower()}" + (f" de {p['area']}" if p["area"] else "") + (f" em {p['city']}/SC" if p["city"] else "") + f". Projeto Macchio Engenharia com {total} imagens" + (" e plantas humanizadas" if p["plans"] else "") + "."
    title = f"{p['name']} · {p['type']}" + (f" em {p['city']}/SC" if p["city"] else "") + " | Macchio Engenharia"
    og = f"assets/img/projetos/{slug}/og.jpg"
    make_og(slug, p["renders"][0]["file"])
    out = page(pre, title, meta_desc, url, og, jsonld, body, current="projetos", preload=preload)
    word = (ROOT / "_build/logo-word.path").read_text()
    d = ROOT / "projetos" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(out.replace("{WORD}", word), encoding="utf-8")


def make_og(slug, file):
    folder = ROOT / "assets/img/projetos" / slug
    target = folder / "og.jpg"
    if target.exists():
        return
    src = next(folder / f"{file}-{w}.webp" for w in (1600, 1280, 800) if (folder / f"{file}-{w}.webp").exists())
    im = Image.open(src).convert("RGB")
    ImageOps.fit(im, (1200, 630), Image.LANCZOS).save(target, "JPEG", quality=80, optimize=True, progressive=True)


def build_sitemap():
    urls = [SITE, SITE + "projetos/"] + [f"{SITE}projetos/{p['slug']}/" for p in PROJECTS]
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


if __name__ == "__main__":
    build_home()
    build_index()
    for i, p in enumerate(PROJECTS):
        build_project(i, p)
    build_sitemap()
    print(f"ok: home, índice e {len(PROJECTS)} projetos")
