// Macchio Engenharia — interações do site (sem dependências)
(() => {
  const WHATSAPP = "5547991723557";
  const waLink = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

  // Cliques de CTA vão para o dataLayer (GTM/GA4), se estiver instalado
  const track = (cta, extra = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "cta_click", cta, ...extra });
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (el) track(el.dataset.track);
  });

  // Header: borda ao rolar
  const header = document.querySelector("[data-header]");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menu mobile
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("menu");
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    document.body.classList.toggle("nav-open", open);
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  // Portfólio: filtro + "ver todos"
  const list = document.querySelector("[data-projects]");
  const items = [...list.querySelectorAll(".project")];
  const moreBtn = document.querySelector("[data-projects-more]");
  const filterBtns = [...document.querySelectorAll("[data-filter]")];
  const INITIAL = 9;
  let filter = "all";
  let expanded = false;

  const matches = (li) => filter === "all" || li.dataset.cat === filter;
  const render = () => {
    let shown = 0;
    items.forEach((li) => {
      const visible = matches(li) && (filter !== "all" || expanded || shown < INITIAL);
      li.hidden = !visible;
      li.classList.remove("is-featured");
      if (visible) shown++;
    });
    if (filter === "all") items[0].classList.add("is-featured");
    moreBtn.hidden = filter !== "all" || expanded;
  };
  filterBtns.forEach((btn) => btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  }));
  moreBtn.addEventListener("click", () => {
    expanded = true;
    render();
    items[INITIAL].querySelector("button").focus();
  });
  render();

  // Portfólio: lightbox
  const dialog = document.querySelector("[data-lightbox]");
  const lbImg = dialog.querySelector("img");
  const lbCaption = dialog.querySelector("[data-lb-caption]");
  const lbCount = dialog.querySelector("[data-lb-count]");
  let gallery = [];
  let current = 0;

  const show = (i) => {
    current = (i + gallery.length) % gallery.length;
    const li = gallery[current];
    const img = li.querySelector("img");
    const base = img.dataset.base;
    lbImg.src = `${base}-1280.webp`;
    lbImg.srcset = `${base}-1280.webp 1280w, ${base}-1920.webp 1920w`;
    lbImg.sizes = "100vw";
    lbImg.alt = img.alt;
    lbCaption.textContent = `${li.querySelector(".project-name").textContent} · ${li.querySelector(".project-type").textContent}`;
    lbCount.textContent = `${current + 1} / ${gallery.length}`;
  };
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".project-btn");
    if (!btn) return;
    gallery = items.filter(matches);
    show(gallery.indexOf(btn.closest(".project")));
    dialog.showModal();
    track("portfolio_ampliar");
  });
  dialog.querySelector("[data-lb-prev]").addEventListener("click", () => show(current - 1));
  dialog.querySelector("[data-lb-next]").addEventListener("click", () => show(current + 1));
  dialog.querySelector("[data-lb-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.classList.contains("lb-figure")) dialog.close();
  });
  let touchX = null;
  dialog.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  dialog.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  // Formulário → WhatsApp com mensagem pronta
  const form = document.querySelector("[data-lead-form]");
  const formError = form.querySelector("[data-form-error]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const nome = String(data.get("nome") || "").trim();
    const interesse = data.get("interesse");
    if (!nome) {
      formError.textContent = "Informe seu nome para continuarmos.";
      form.elements.nome.focus();
      return;
    }
    if (!interesse) {
      formError.textContent = "Escolha do que você precisa.";
      form.querySelector('input[name="interesse"]').focus();
      return;
    }
    formError.textContent = "";
    const cidade = String(data.get("cidade") || "").trim();
    const mensagem = String(data.get("mensagem") || "").trim();
    const lines = [`Olá! Meu nome é ${nome}.`, `Tenho interesse em: ${interesse}.`];
    if (cidade) lines.push(`Cidade do terreno/imóvel: ${cidade}.`);
    if (mensagem) lines.push(mensagem);
    lines.push("(Mensagem enviada pelo site)");
    track("whatsapp_formulario", { interesse });
    const url = waLink(lines.join("\n"));
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else window.location.href = url;
  });

  // Barra fixa no celular: aparece depois do hero e some na área do formulário
  const bar = document.querySelector("[data-mobile-bar]");
  const heroActions = document.querySelector("[data-hero-actions]");
  if (bar && "IntersectionObserver" in window) {
    let heroVisible = true;
    let formVisible = false;
    const update = () => {
      const visible = !heroVisible && !formVisible;
      bar.classList.toggle("is-visible", visible);
      bar.setAttribute("aria-hidden", String(!visible));
      bar.querySelectorAll("a").forEach((a) => { a.tabIndex = visible ? 0 : -1; });
    };
    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; update(); }).observe(heroActions);
    new IntersectionObserver(([entry]) => { formVisible = entry.isIntersecting; update(); }, { threshold: 0.1 }).observe(form);
  }

  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
