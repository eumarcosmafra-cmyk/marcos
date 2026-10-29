// Macchio Engenharia — interações (sem dependências)
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const WHATSAPP = "5547991723557";

  // Medição: cliques de CTA vão para o dataLayer (GTM/GA4)
  const track = (cta, extra = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "cta_click", cta, ...extra });
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (el) track(el.dataset.track);
  });

  // Header: transparente sobre o hero, sólido depois; esconde ao descer e volta ao subir
  const header = $("[data-header]");
  const hero = $("[data-hero], .ph");
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    const limit = hero ? hero.offsetHeight - 120 : 40;
    header.classList.toggle("is-solid", y > limit);
    const menuOpen = $("[data-menu]")?.open;
    if (!menuOpen) header.classList.toggle("is-hidden", y > 240 && y > lastY + 4);
    if (y < lastY - 4) header.classList.remove("is-hidden");
    lastY = y;
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menu (mobile)
  const menu = $("[data-menu]");
  if (menu) {
    const opener = $("[data-menu-open]");
    opener.addEventListener("click", () => { menu.showModal(); opener.setAttribute("aria-expanded", "true"); });
    menu.addEventListener("close", () => opener.setAttribute("aria-expanded", "false"));
    $$("[data-menu-close], a", menu).forEach((el) => el.addEventListener("click", () => menu.close()));
  }

  // Reveal ao rolar
  const revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  // Hero: slideshow
  const heroEl = $("[data-hero]");
  if (heroEl) {
    const slides = $$("[data-slide]", heroEl);
    const dots = $$("[data-dot]", heroEl);
    const meta = { name: $("[data-slide-name]", heroEl), info: $("[data-slide-info]", heroEl), num: $("[data-slide-num]", heroEl), link: $("[data-slide-link]", heroEl) };
    const MS = 6500;
    heroEl.style.setProperty("--slide-ms", `${MS}ms`);
    let i = 0;
    let timer = null;
    const load = (n) => {
      const img = $("img", slides[n % slides.length]);
      if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.src = img.dataset.src; delete img.dataset.srcset; }
    };
    const go = (n) => {
      slides[i].classList.remove("is-active");
      dots[i].classList.remove("is-active");
      dots.forEach((d, k) => d.classList.toggle("is-done", k < n));
      i = (n + slides.length) % slides.length;
      if (i === 0) dots.forEach((d) => d.classList.remove("is-done"));
      load(i);
      load(i + 1);
      slides[i].classList.add("is-active");
      void dots[i].offsetWidth;
      dots[i].classList.add("is-active");
      const s = slides[i].dataset;
      meta.name.textContent = s.name;
      meta.info.textContent = s.info;
      meta.num.textContent = `${String(i + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      meta.link.href = s.href;
    };
    const play = () => { clearInterval(timer); if (!reduced) timer = setInterval(() => go(i + 1), MS); };
    dots.forEach((d, k) => d.addEventListener("click", () => { go(k); play(); }));
    if (document.readyState === "complete") load(1); else window.addEventListener("load", () => load(1));
    if (!reduced) { dots[0].classList.add("is-active"); play(); }
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearInterval(timer); else play(); });
  }

  // Intro: palavras acendem conforme a rolagem
  const words = $("[data-words]");
  if (words) {
    words.innerHTML = words.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span> `).join("");
    const spans = $$(".w", words);
    if (reduced) spans.forEach((s) => s.classList.add("is-on"));
    else {
      const update = () => {
        const r = words.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        const n = Math.round(p * spans.length);
        spans.forEach((s, k) => s.classList.toggle("is-on", k < n));
      };
      update();
      window.addEventListener("scroll", update, { passive: true });
    }
  }

  // Projetos selecionados: rolagem horizontal fixada (desktop)
  const pin = $("[data-hscroll]");
  if (pin) {
    const mq = window.matchMedia("(min-width: 1024px)");
    const track = $("[data-rail]", pin);
    const bar = $("[data-bar]", pin);
    let dist = 0;
    let on = false;
    const measure = () => {
      on = mq.matches && !reduced;
      pin.classList.toggle("is-pinned", on);
      if (!on) { pin.style.height = ""; track.style.transform = ""; return; }
      dist = Math.max(0, track.scrollWidth - window.innerWidth);
      pin.style.height = `${window.innerHeight + dist}px`;
      update();
    };
    const update = () => {
      if (!on) return;
      const p = Math.min(1, Math.max(0, -pin.getBoundingClientRect().top / (dist || 1)));
      track.style.transform = `translate3d(${-p * dist}px,0,0)`;
      if (bar) bar.style.transform = `scaleX(${p})`;
    };
    track.addEventListener("focusin", (e) => {
      if (!on) return;
      const card = e.target.closest("li");
      const p = Math.min(1, Math.max(0, (card.offsetLeft - window.innerWidth * 0.1) / (dist || 1)));
      window.scrollTo({ top: pin.offsetTop + p * dist, behavior: reduced ? "auto" : "smooth" });
    });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    window.addEventListener("scroll", update, { passive: true });
  }

  // Cursor "Ver projeto"
  if (finePointer && !reduced) {
    const targets = $$("[data-cursor]");
    if (targets.length) {
      const c = document.createElement("div");
      c.className = "cursor";
      c.setAttribute("aria-hidden", "true");
      document.body.appendChild(c);
      window.addEventListener("pointermove", (e) => { c.style.setProperty("--x", `${e.clientX}px`); c.style.setProperty("--y", `${e.clientY}px`); }, { passive: true });
      targets.forEach((t) => {
        t.addEventListener("pointerenter", () => { c.textContent = t.dataset.cursor; c.classList.add("is-on"); });
        t.addEventListener("pointerleave", () => c.classList.remove("is-on"));
      });
    }
  }

  // Serviços: acordeão + imagem fixa
  const svc = $("[data-svc-list]");
  if (svc) {
    const items = $$(".svc-item", svc);
    const imgs = $$("[data-svc-img]");
    const open = (k) => items.forEach((it, j) => {
      const on = j === k;
      it.classList.toggle("is-open", on);
      $(".svc-btn", it).setAttribute("aria-expanded", String(on));
      imgs[j]?.classList.toggle("is-active", on);
    });
    items.forEach((it, k) => {
      $(".svc-btn", it).addEventListener("click", () => open(it.classList.contains("is-open") ? -1 : k));
      if (finePointer) it.addEventListener("pointerenter", () => { if (!it.classList.contains("is-open")) open(k); });
    });
  }

  // Processo: etapa ativa
  const steps = $$("[data-step]");
  if (steps.length && "IntersectionObserver" in window) {
    const num = $("[data-proc-num]");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        steps.forEach((s) => s.classList.toggle("is-active", s === en.target));
        if (num) num.textContent = String(steps.indexOf(en.target) + 1).padStart(2, "0");
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach((s) => io.observe(s));
    steps[0].classList.add("is-active");
  }

  // Depoimentos
  const tst = $("[data-tst]");
  if (tst) {
    const items = $$(".tst-item", tst);
    const count = $("[data-tst-count]", tst);
    let k = 0;
    const show = (n) => {
      items[k].classList.remove("is-active");
      items[k].setAttribute("aria-hidden", "true");
      k = (n + items.length) % items.length;
      items[k].classList.add("is-active");
      items[k].setAttribute("aria-hidden", "false");
      count.textContent = `${String(k + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    };
    $("[data-tst-prev]", tst).addEventListener("click", () => show(k - 1));
    $("[data-tst-next]", tst).addEventListener("click", () => show(k + 1));
    let x0 = null;
    tst.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    tst.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(k + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  // Índice de projetos: filtro, grade/lista e preview no hover
  const pidx = $("[data-pidx]");
  if (pidx) {
    const grid = $("[data-pgrid]", pidx);
    const list = $("[data-plist]", pidx);
    const cards = $$(".pcard", grid);
    const rows = $$(".prow", list);
    const LAYOUT = ["l-a", "l-b", "l-c", "l-d"];
    const withTransition = (fn) => (document.startViewTransition && !reduced ? document.startViewTransition(fn) : fn());
    const apply = (cat) => {
      let n = 0;
      cards.forEach((c, j) => {
        const show = cat === "all" || c.dataset.cat === cat;
        c.hidden = !show;
        rows[j].hidden = !show;
        c.classList.remove(...LAYOUT);
        if (show) c.classList.add(LAYOUT[n++ % 4]);
      });
    };
    $$("[data-filter]", pidx).forEach((b) => b.addEventListener("click", () => {
      $$("[data-filter]", pidx).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      withTransition(() => apply(b.dataset.filter));
    }));
    $$("[data-view]", pidx).forEach((b) => b.addEventListener("click", () => {
      $$("[data-view]", pidx).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      withTransition(() => { grid.hidden = b.dataset.view !== "grid"; list.hidden = b.dataset.view !== "list"; });
    }));
    if (finePointer && !reduced) {
      const pv = document.createElement("div");
      pv.className = "preview";
      pv.setAttribute("aria-hidden", "true");
      pv.innerHTML = "<img alt=''>";
      document.body.appendChild(pv);
      const pvImg = $("img", pv);
      window.addEventListener("pointermove", (e) => { pv.style.setProperty("--x", `${e.clientX + 24}px`); pv.style.setProperty("--y", `${e.clientY - 120}px`); }, { passive: true });
      rows.forEach((r) => {
        r.addEventListener("pointerenter", () => { pvImg.src = r.dataset.preview; pv.classList.add("is-on"); });
        r.addEventListener("pointerleave", () => pv.classList.remove("is-on"));
      });
    }
  }

  // Galeria do projeto: lightbox
  const lb = $("[data-lb]");
  if (lb) {
    const items = $$("[data-lb-item]");
    const img = $("img", lb);
    const count = $("[data-lb-count]", lb);
    let k = 0;
    const show = (n) => {
      k = (n + items.length) % items.length;
      const it = items[k];
      img.src = it.dataset.full;
      img.alt = $("img", it).alt;
      count.textContent = `${String(k + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    };
    items.forEach((it, j) => it.addEventListener("click", () => { show(j); lb.showModal(); track("galeria_ampliar"); }));
    $("[data-lb-prev]", lb).addEventListener("click", () => show(k - 1));
    $("[data-lb-next]", lb).addEventListener("click", () => show(k + 1));
    $("[data-lb-close]", lb).addEventListener("click", () => lb.close());
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(k - 1); if (e.key === "ArrowRight") show(k + 1); });
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-fig")) lb.close(); });
    let x0 = null;
    lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(k + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  // Formulário → WhatsApp
  const form = $("[data-lead-form]");
  if (form) {
    const err = $("[data-form-err]", form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const nome = String(d.get("nome") || "").trim();
      const interesse = String(d.get("interesse") || "");
      if (!nome) { err.textContent = "Informe seu nome para continuarmos."; form.elements.nome.focus(); return; }
      if (!interesse) { err.textContent = "Escolha do que você precisa."; form.elements.interesse.focus(); return; }
      err.textContent = "";
      const msg = String(d.get("mensagem") || "").trim();
      const lines = [`Olá! Meu nome é ${nome}.`, `Tenho interesse em: ${interesse}.`];
      if (msg) lines.push(msg);
      lines.push("(Mensagem enviada pelo site)");
      track("whatsapp_formulario", { interesse });
      const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
      const win = window.open(url, "_blank");
      if (win) win.opener = null; else window.location.href = url;
    });
  }

  // Botão flutuante (mobile): aparece depois do hero
  const fab = $("[data-fab]");
  if (fab && hero && "IntersectionObserver" in window) {
    const contact = $("#contato");
    let heroOn = true;
    let contactOn = false;
    const set = () => fab.classList.toggle("is-on", !heroOn && !contactOn);
    new IntersectionObserver(([en]) => { heroOn = en.isIntersecting; set(); }).observe(hero);
    if (contact) new IntersectionObserver(([en]) => { contactOn = en.isIntersecting; set(); }, { threshold: 0.2 }).observe(contact);
  }

  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
