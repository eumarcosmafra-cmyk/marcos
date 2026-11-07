import { describe, expect, it } from "vitest";
import { CODIGO_FONTES, montarWorkflowFontes } from "../scripts/montar-fontes.mjs";

type J = Record<string, unknown>;

/** Roda o código de um nó Code como o n8n faz: $input, $(nome) e $execution. */
function rodar(js: string, entrada: J[], refs: Record<string, J[]> = {}): J[] {
  const $input = { all: () => entrada.map((json) => ({ json })), first: () => ({ json: entrada[0] }) };
  const $ = (nome: string) => {
    if (!refs[nome]) throw new Error(`nó não executado: ${nome}`);
    return { first: () => ({ json: refs[nome][0] }), all: () => refs[nome].map((json) => ({ json })) };
  };
  return (new Function("$input", "$", "$execution", js)($input, $, { id: "teste" }) as { json: J }[]).map((i) => i.json);
}

// Funções da biblioteca para montar dados de teste (mesmo sha256 dos nós).
const lib = new Function(`${CODIGO_FONTES.validar.split("// ---- validar.js ----")[0]}; return { sha256, fHash, fRecorte, cleanMarkdown, fCandidatosSerp, fMelhorSecao, fTermos };`)() as {
  sha256: (t: string) => string;
  fHash: (v: unknown) => string;
  fRecorte: (t: string, s: { inicio: string; fim: string }) => { ok: boolean; texto?: string; motivo?: string };
  fCandidatosSerp: (p: J, site: string, extras: string[]) => { id: string; url_serp: string; origem: string }[];
  fMelhorSecao: (md: string, termos: string[], md2?: string) => { inicio: string; fim: string; trecho: string; localizador: string } | null;
  fTermos: (p: J) => string[];
};

const CLIENTE = "altovaletopteam_com_br";
const SITE = "https://altovaletopteam.com.br/";
const pauta = {
  id: "P001",
  keyword: "equipamento necessário para começar no muay thai",
  titulo: "Equipamento para começar no Muay Thai e no Boxe",
  acao: "criar",
  tema: "Fundamentos das modalidades",
  intencao: "mista",
  justificativa: "SERP mista com lojas e guias.",
  status: "candidata_para_revisao",
  serp: {
    resultados: [
      { url: "https://www.google.com/goto?url=AAA", title: "Guia de equipamentos", rank: 1, website_name: "Federação", is_video: false },
      { url: "https://www.reddit.com/r/MuayThai/x", title: "Reddit", rank: 2, website_name: "Reddit · r/MuayThai", is_video: false },
      { url: "https://revista.example.org/equipamento/", title: "Revista", rank: 3, website_name: "Revista", is_video: false },
      { url: "https://altovaletopteam.com.br/blog/x/", title: "Cliente", rank: 4, website_name: "AVTT", is_video: false },
      { url: "https://loja.example.com/luvas/", title: "Loja", rank: 5, website_name: "Loja", is_video: false },
      { url: "https://youtube.com/watch?v=1", title: "Vídeo", rank: 6, is_video: true },
      { url: "https://guia.example.net/muay-thai/", title: "Guia", rank: 7, website_name: "Guia", is_video: false },
    ],
  },
};
const original = { cliente_id: CLIENTE, site_url: SITE, analise_sha256: "a".repeat(64), pautas: [pauta] };
const plano_original_json = JSON.stringify(original);
const plano_sha256 = lib.sha256(plano_original_json);
const planoPayload = {
  plano_id: `v2_${plano_sha256}`,
  cliente_id: CLIENTE,
  site_url: SITE,
  site_snapshot: "snap",
  analise_sha256: "a".repeat(64),
  plano_sha256,
  pautas: [pauta],
  pautas_sha256: { P001: lib.fHash(pauta) },
  plano_original_json,
  acervo_cache_key: `acervo:${CLIENTE}:${"a".repeat(64)}`,
};
const PLANO_KEY = `plano:${CLIENTE}:v2_${plano_sha256}`;
const linha = (tipo: string, cache_key: string, payload: unknown, id = 1) => {
  const t = JSON.stringify(payload);
  return { id, tipo, cache_key, cliente_id: CLIENTE, payload_json: t, payload_sha256: lib.sha256(t) };
};

function pagina(titulo: string, foco: string): string {
  const par = (n: number) =>
    `${foco} é parte do ${n}º bloco: para começar no muay thai o equipamento necessário inclui bandagens, luvas e caneleiras, e cada item protege mãos e canelas durante o treino de forma específica e progressiva.`;
  return [
    `# ${titulo}`,
    "",
    "Menu [Início](https://x.org/) [Contato](https://x.org/c)",
    "",
    "## Equipamento necessário para começar no Muay Thai",
    "",
    par(1),
    "",
    par(2),
    "",
    par(3),
    "",
    "## Outros assuntos",
    "",
    "Texto curto sobre outra coisa.",
    "",
    "## Rodapé da página",
    "",
    "Direitos reservados e mais informações institucionais sobre a organização responsável por este conteúdo publicado.",
  ].join("\n");
}
const crawl = (url: string, md: string, redirected?: string) => ({
  statusCode: 200,
  body: { success: true, results: [{ success: true, status_code: 200, url, redirected_url: redirected ?? url, markdown: { raw_markdown: md }, metadata: { title: `Título de ${url}` } }] },
});

describe("curadoria de fontes — peças", () => {
  it("candidatos: mantém goto do Google e URLs do editor; descarta fórum, vídeo e o próprio cliente", () => {
    const c = lib.fCandidatosSerp(pauta, SITE, ["https://manual.example.com/fonte/"]);
    const urls = c.map((x) => x.url_serp);
    expect(urls[0]).toBe("https://manual.example.com/fonte/");
    expect(urls).toContain("https://www.google.com/goto?url=AAA");
    expect(urls.some((u) => u.includes("reddit") || u.includes("youtube") || u.includes("altovaletopteam"))).toBe(false);
  });

  it("links do Google: 1ª coleta sem robots só para eles; aviso de redirecionamento vira destino; loja sai", () => {
    const validado = rodar(CODIGO_FONTES.validar, [{ modo: "propor", cliente_id: CLIENTE, plano_cache_key: PLANO_KEY, pauta_id: "P001", ator_id: "marcos_mafra", autorizar_cobranca: true }]);
    const plano = rodar(CODIGO_FONTES.conferirPlano, [linha("plano", PLANO_KEY, planoPayload)], { "Validar pedido": validado });
    const refs: Record<string, J[]> = { "Validar pedido": validado, "Conferir plano": plano };
    const cands = rodar(CODIGO_FONTES.prepararCandidatos, [plano[0]], refs);
    const robots = (c: J) => ((c.crawl as J).crawler_config as { params: { check_robots_txt: boolean } }).params.check_robots_txt;
    const goto = cands.find((c) => String(c.url_serp).includes("google.com/goto"))!;
    expect(robots(goto)).toBe(false);
    expect(cands.filter((c) => c !== goto).every((c) => robots(c) === true)).toBe(true);
    expect(cands.some((c) => String(c.url_serp).includes("loja.example.com"))).toBe(false);
    refs["Preparar candidatos"] = cands;
    // O Google não redireciona: mostra o aviso com o link de destino.
    const aviso = "# Aviso de redirecionamento\n\nA página que você estava visitando está tentando enviar você para [https://federacao.example.org/guia/](https://federacao.example.org/guia/).\n\nSe você não quiser visitar essa página, [volte](https://www.google.com/) para a anterior.";
    const respostas = cands.map((c) => (c === goto ? crawl(String(c.url_serp), aviso + "\n\n" + "x".repeat(200)) : crawl(String(c.url_serp), pagina("P", "x"))));
    const destinos = rodar(CODIGO_FONTES.resolverDestinos, respostas, refs);
    expect(destinos.find((d) => d.id === goto.id)?.url_final).toBe("https://federacao.example.org/guia/");
    // Como na VPS: o Crawl4AI segue o redirecionamento e devolve status 301 com o destino em redirected_url.
    const r301 = (url: string) => {
      const c = crawl(url, pagina("P", "x"), "https://boaforma.example.com.br/muay-thai/");
      ((c.body as J).results as J[])[0].status_code = 301;
      return c;
    };
    const comRedir = rodar(CODIGO_FONTES.resolverDestinos, cands.map((c) => (c === goto ? r301(String(c.url_serp)) : crawl(String(c.url_serp), pagina("P", "x")))), refs);
    expect(comRedir.find((d) => d.id === goto.id)?.url_final).toBe("https://boaforma.example.com.br/muay-thai/");
    // Na 2ª coleta, a que o Pesquisador repete, 301 continua não valendo.
    refs["Resolver destinos"] = comRedir;
    const rec = rodar(CODIGO_FONTES.recortar, comRedir.map((d) => (d.id === goto.id ? r301(String(d.url_final)) : crawl(String(d.url_final), pagina("Q", "y")))), refs);
    expect((rec[0].registro as J[]).find((r) => r.id === goto.id)).toMatchObject({ situacao: "descartada", motivo: "coleta_falhou" });
    // Sem link no aviso: descartado com motivo claro.
    const semLink = rodar(CODIGO_FONTES.resolverDestinos, cands.map((c) => (c === goto ? crawl(String(c.url_serp), "Aviso sem link. " + "y".repeat(250)) : crawl(String(c.url_serp), pagina("P", "x")))), refs);
    expect((semLink[0].registro as J[]).find((r) => r.id === goto.id)).toMatchObject({ situacao: "descartada", motivo: "redirecionamento_google_nao_resolvido" });
  });

  it("página que muda entre acessos: marcadores valem nas duas coletas e evitam trechos voláteis", () => {
    const par = (n: number) => `No boxe profissional, quantos rounds tem uma luta de boxe depende do título em disputa: o bloco ${n} explica que lutas de campeonato têm doze rounds de três minutos, com um minuto de descanso entre eles e regras definidas pela comissão.`;
    const montar = (anuncio: string, leia: string) =>
      ["# Boxe", "", "## Quantos rounds tem uma luta de boxe", "", par(1), "", anuncio, "", par(2), "", par(3), "", `## Leia também: ${leia}`, "", "Notícia relacionada qualquer sobre outro esporte e outro assunto do portal de notícias esportivas."].join("\n");
    const md1 = montar("Texto institucional fixo do portal sobre boxe amador e profissional no Brasil.", "Fulano vence em 12/11 às 21h30");
    const md2 = montar("Publicidade: assine já o plano anual com desconto exclusivo para leitores do portal esportivo.", "Ciclano perde em 13/11 às 20h15");
    const termos = lib.fTermos({ keyword: "quantos rounds tem uma luta de boxe", titulo: "Quantos rounds tem uma luta de boxe" });
    const s = lib.fMelhorSecao(md1, termos, md2);
    expect(s).not.toBeNull();
    expect(s!.fim).not.toMatch(/Leia também/);
    const r1 = lib.fRecorte(md1, s!);
    const r2 = lib.fRecorte(md2, s!);
    expect(r1.ok && r2.ok).toBe(true);
    expect(r1.texto!.length).toBeLessThanOrEqual(3500);
    // O filtro de trechos voláteis já evita o título "Leia também…" mesmo sem a 2ª versão.
    expect(lib.fMelhorSecao(md1, termos)!.fim).not.toMatch(/Leia também/);
    // Título que muda sem palavras voláteis (bloco de recomendação): só a 2ª coleta revela.
    const variar = (titulo: string) => md1.replace(/## Leia também: .*/u, `## ${titulo}`);
    const a = variar("Destaques do esporte nacional e internacional");
    const b = variar("Seleção especial do editor sobre lutas clássicas");
    const semConferencia = lib.fMelhorSecao(a, termos);
    expect(semConferencia!.fim).toMatch(/^## Destaques/);
    expect(lib.fRecorte(b, semConferencia!).ok).toBe(false);
    const comConferencia = lib.fMelhorSecao(a, termos, b);
    expect(comConferencia!.fim).not.toMatch(/^## /);
    expect(lib.fRecorte(a, comConferencia!).ok && lib.fRecorte(b, comConferencia!).ok).toBe(true);
  });

  it("seção escolhida por código passa na mesma conferência do Pesquisador", () => {
    const md = pagina("Guia", "O treino");
    const s = lib.fMelhorSecao(md, lib.fTermos(pauta));
    expect(s).not.toBeNull();
    expect(s!.localizador).toBe("Equipamento necessário para começar no Muay Thai");
    expect(s!.inicio.length).toBeGreaterThan(15);
    expect(s!.fim.length).toBeGreaterThan(10);
    expect(md.indexOf(s!.inicio)).toBe(md.indexOf("## Equipamento"));
    const r = lib.fRecorte(md, s!);
    expect(r.ok).toBe(true);
    expect(r.texto).toBe(s!.trecho);
    expect(r.texto).not.toContain("Outros assuntos");
  });
});

describe("curadoria de fontes — fluxo propor e aprovar", () => {
  const pedido = { modo: "propor", cliente_id: CLIENTE, plano_cache_key: PLANO_KEY, pauta_id: "P001", ator_id: "marcos_mafra", autorizar_cobranca: true };

  function propor(respostaModelo: J | null) {
    const validado = rodar(CODIGO_FONTES.validar, [pedido]);
    expect(validado[0].ok).toBe(true);
    const plano = rodar(CODIGO_FONTES.conferirPlano, [linha("plano", PLANO_KEY, planoPayload)], { "Validar pedido": validado });
    expect(plano[0].ok).toBe(true);
    const refs: Record<string, J[]> = { "Validar pedido": validado, "Conferir plano": plano };
    const candidatos = rodar(CODIGO_FONTES.prepararCandidatos, [plano[0]], refs);
    refs["Preparar candidatos"] = candidatos;
    // 1ª coleta: o goto do Google resolve para a federação.
    const finais: Record<string, string> = {
      "https://www.google.com/goto?url=AAA": "https://federacao.example.org/equipamentos/",
      "https://revista.example.org/equipamento/": "https://revista.example.org/equipamento/",
      "https://loja.example.com/luvas/": "https://loja.example.com/luvas/",
      "https://guia.example.net/muay-thai/": "https://guia.example.net/muay-thai/",
    };
    const coleta1 = candidatos.map((c) => crawl(String(c.url_serp), pagina("P", "x"), finais[String(c.url_serp)]));
    const destinos = rodar(CODIGO_FONTES.resolverDestinos, coleta1, refs);
    refs["Resolver destinos"] = destinos;
    const coleta2 = destinos.map((d) => crawl(String(d.url_final), pagina(`Página ${d.url_final}`, `Conteúdo de ${d.dominio}`)));
    const recorte = rodar(CODIGO_FONTES.recortar, coleta2, refs);
    refs["Recortar e preparar escolha"] = recorte;
    const entrada = respostaModelo ? rodar(CODIGO_FONTES.juntarModelo, [respostaModelo], refs) : recorte;
    const proposta = rodar(CODIGO_FONTES.montarProposta, entrada, refs);
    return { refs, recorte, proposta, coleta2, destinos };
  }

  const modelo = (ids: string[]) => ({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ escolhidas: ids.map((c) => ({ candidato: c, entidade: `Entidade ${c}`, limites: "Não comprova regras oficiais." })), observacao: "ok" }) }],
      },
    ],
  });

  it("propõe 3 fontes que o Enfileirador e o Pesquisador aceitam", () => {
    const { recorte, proposta, coleta2, destinos } = propor(null);
    expect(recorte[0].usar_modelo).toBe(true);
    const ids = (recorte[0].validos as { id: string }[]).map((v) => v.id);
    const { proposta: p2 } = propor(modelo(ids.slice(0, 3)));
    const payload = JSON.parse(String(p2[0].payload_json));
    expect(p2[0].tipo).toBe("fontes_pauta_proposta");
    expect(payload.status).toBe("pronta");
    expect(payload.selecao).toMatchObject({ metodo: "modelo", chamadas_ia: 1 });
    const docs = payload.fontes.documentos as Record<string, string>[];
    expect(docs.map((d) => d.id)).toEqual(["F1", "F2", "F3"]);
    expect(payload.fontes.pauta_sha256).toBe(lib.fHash(pauta));
    for (const d of docs) {
      // Mesmas exigências do Enfileirador (ppSources).
      expect(d.url).toMatch(/^https:\/\/[^\s/@:]+\//u);
      for (const k of ["titulo", "entidade", "versao", "inicio", "fim", "localizador", "limites"]) expect(d[k].trim().length).toBeGreaterThan(0);
      expect(d.inicio.length).toBeGreaterThan(15);
      expect(d.fim.length).toBeGreaterThan(10);
      // Mesma conferência do Pesquisador sobre a página que ele vai coletar.
      const idx = destinos.findIndex((x) => x.url_final === d.url);
      const md = ((coleta2[idx].body as J).results as J[])[0].markdown as { raw_markdown: string };
      expect(lib.fRecorte(md.raw_markdown, { inicio: d.inicio, fim: d.fim }).ok).toBe(true);
    }
    expect(new Set(docs.map((d) => new URL(d.url).host)).size).toBe(3);
    expect(payload.candidatos.find((c: J) => String(c.url_serp).includes("goto")).url_final).toBe("https://federacao.example.org/equipamentos/");
    expect(proposta[0].payload_sha256).toBe(lib.sha256(String(proposta[0].payload_json)));
  });

  it("resposta inválida do modelo cai na escolha automática; candidato inventado é ignorado", () => {
    const { proposta } = propor(modelo(["C9", "C1", "C1"]));
    const payload = JSON.parse(String(proposta[0].payload_json));
    expect(payload.status).toBe("pronta");
    expect(payload.selecao.metodo).toBe("automatica");
    expect(payload.fontes.documentos).toHaveLength(3);
  });

  it("aprovar grava exatamente as fontes da proposta como fontes_pauta", () => {
    const { proposta, refs } = propor(null);
    const prop = JSON.parse(String(proposta[0].payload_json));
    const aprovar = { modo: "aprovar", cliente_id: CLIENTE, plano_cache_key: PLANO_KEY, pauta_id: "P001", ator_id: "marcos_mafra" };
    const validado = rodar(CODIGO_FONTES.validar, [aprovar]);
    const r = rodar(CODIGO_FONTES.conferirProposta, [{ id: 9, ...proposta[0] }], { "Validar pedido": validado, "Conferir plano": refs["Conferir plano"] });
    expect(r[0]).toMatchObject({ ok: true, tipo: "fontes_pauta", cache_key: `fontes:${CLIENTE}:P001:${lib.fHash(pauta)}` });
    expect(JSON.parse(String(r[0].payload_json))).toEqual(prop.fontes);
    // Proposta adulterada é recusada.
    const adulterada = { id: 9, ...proposta[0], payload_json: String(proposta[0].payload_json).replace("pronta", "prontx") };
    expect(rodar(CODIGO_FONTES.conferirProposta, [adulterada], { "Validar pedido": validado, "Conferir plano": refs["Conferir plano"] })[0]).toMatchObject({ ok: false, codigo: "fontes_pauta_proposta_alterado" });
  });

  it("menos de 3 fontes aptas vira proposta 'insuficiente', sem chamar o modelo", () => {
    const validado = rodar(CODIGO_FONTES.validar, [pedido]);
    const plano = rodar(CODIGO_FONTES.conferirPlano, [linha("plano", PLANO_KEY, planoPayload)], { "Validar pedido": validado });
    const refs: Record<string, J[]> = { "Validar pedido": validado, "Conferir plano": plano };
    refs["Preparar candidatos"] = rodar(CODIGO_FONTES.prepararCandidatos, [plano[0]], refs);
    const falhas = refs["Preparar candidatos"].map(() => ({ statusCode: 200, body: { success: false } }));
    refs["Resolver destinos"] = rodar(CODIGO_FONTES.resolverDestinos, falhas, refs);
    expect(refs["Resolver destinos"][0].sentinela).toBe(true);
    const recorte = rodar(CODIGO_FONTES.recortar, [{ statusCode: 422 }], refs);
    expect(recorte[0]).toMatchObject({ status: "insuficiente", usar_modelo: false });
    refs["Recortar e preparar escolha"] = recorte;
    const p = JSON.parse(String(rodar(CODIGO_FONTES.montarProposta, recorte, refs)[0].payload_json));
    expect(p).toMatchObject({ status: "insuficiente", fontes: null });
    expect(p.selecao.chamadas_ia).toBe(0);
    expect(p.candidatos.every((c: J) => c.situacao === "descartada")).toBe(true);
  });

  it("recusa pedido sem autorização, campo extra e plano de outro cliente", () => {
    expect(rodar(CODIGO_FONTES.validar, [{ ...pedido, autorizar_cobranca: false }])[0]).toMatchObject({ ok: false, codigo: "cobranca_nao_autorizada" });
    expect(rodar(CODIGO_FONTES.validar, [{ ...pedido, workflowId: "x" }])[0]).toMatchObject({ ok: false, codigo: "campo_nao_permitido" });
    expect(rodar(CODIGO_FONTES.validar, [{ ...pedido, plano_cache_key: "plano:outro:v2_x" }])[0]).toMatchObject({ ok: false, codigo: "plano_de_outro_cliente" });
    expect(rodar(CODIGO_FONTES.validar, [{ ...pedido, urls_extras: ["http://inseguro.com/"] }])[0]).toMatchObject({ ok: false, codigo: "urls_extras_invalidas" });
  });

  it("estrutura: credenciais existentes, coletas em série e só a tabela de contexto", () => {
    const wf = montarWorkflowFontes();
    expect(wf.id).toBe("MafraFontesPauta");
    const http = wf.nodes.filter((n) => n.type === "n8n-nodes-base.httpRequest");
    expect(http.map((n) => (n.parameters as { url: string }).url).sort()).toEqual(["http://crawl4ai:11235/crawl", "http://crawl4ai:11235/crawl", "https://api.deepseek.com/responses"]);
    const tabelas = wf.nodes.filter((n) => n.type === "n8n-nodes-base.dataTable").map((n) => (n.parameters as { dataTableId: { value: string } }).dataTableId.value);
    expect(new Set(tabelas)).toEqual(new Set(["I0kHnbGg35Y9RA5Y"]));
    expect(wf.settings.callerPolicy).toBe("workflowsFromSameOwner");
    for (const [origem, c] of Object.entries(wf.connections)) {
      expect(wf.nodes.some((n) => n.name === origem)).toBe(true);
      for (const saida of c.main) for (const destino of saida) expect(wf.nodes.some((n) => n.name === destino.node)).toBe(true);
    }
  });
});
