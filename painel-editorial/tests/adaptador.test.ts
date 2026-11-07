import { describe, expect, it } from "vitest";
import { CODIGO, IDS, montarWorkflow } from "../scripts/montar-adaptador.mjs";

type Item = { json: Record<string, unknown> };

function rodar(js: string, entrada: Record<string, unknown>[], refs: Record<string, Record<string, unknown>[]> = {}): Item[] {
  const $input = { all: () => entrada.map((json) => ({ json })), first: () => ({ json: entrada[0] }) };
  const $ = (nome: string) => ({ first: () => ({ json: refs[nome][0] }), all: () => refs[nome].map((json) => ({ json })) });
  return new Function("$input", "$", js)($input, $) as Item[];
}

const JOB = "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888";
const SHA = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const base = { cliente_id: "altovaletopteam_com_br", ambiente: "teste" };

function validar(body: unknown) {
  return rodar(CODIGO.validar, [{ body: body as Record<string, unknown> }])[0].json;
}

describe("adaptador — validação do pedido", () => {
  it("encaminha consultar com apenas os campos permitidos", () => {
    const r = validar({ operacao: "consultar", entrada: { ...base, job_key: JOB } });
    expect(r.rota).toBe("fila");
    expect(r.pedido).toEqual({ operacao: "consultar", ...base, job_key: JOB });
  });

  it("recusa operações fora da lista do painel", () => {
    for (const op of ["enfileirar", "aprovar_pauta", "retomar", "iniciar_etapa", "concluir_etapa", "falha_etapa", "importar_rascunho"]) {
      const r = validar({ operacao: op, entrada: base });
      expect(r.rota).toBe("recusa");
      expect((r.resposta as { erro: { codigo: string } }).erro.codigo).toBe("operacao_nao_permitida");
    }
  });

  it("recusa outro cliente, campo extra e envelope extra", () => {
    expect(validar({ operacao: "consultar", entrada: { ...base, cliente_id: "outro_cliente" } }).rota).toBe("recusa");
    expect(validar({ operacao: "consultar", entrada: { ...base, modo_execucao: "real" } }).rota).toBe("recusa");
    expect(validar({ operacao: "consultar", entrada: base, workflowId: "x" }).rota).toBe("recusa");
  });

  it("mutações exigem editor autorizado e op_id do próprio editor", () => {
    const edicao = { ...base, job_key: JOB, op_id: "painel:marcos_mafra:abcd1234-ef", revisao_esperada: 2, artigo_sha256: SHA, markdown: "x".repeat(250), ator_id: "marcos_mafra" };
    expect(validar({ operacao: "salvar_edicao", entrada: edicao }).rota).toBe("fila");
    const outro = validar({ operacao: "salvar_edicao", entrada: { ...edicao, ator_id: "leitor_teste", op_id: "painel:leitor_teste:abcd1234-ef" } });
    expect((outro.resposta as { erro: { codigo: string } }).erro.codigo).toBe("editor_nao_autorizado");
    const opAlheio = validar({ operacao: "salvar_edicao", entrada: { ...edicao, op_id: "painel:outro:abcd1234-ef" } });
    expect((opAlheio.resposta as { erro: { codigo: string } }).erro.codigo).toBe("op_id_invalido");
  });

  it("decidir exige confirmação e motivos na devolução", () => {
    const d = { ...base, job_key: JOB, op_id: "painel:marcos_mafra:abcd1234-ef", revisao_esperada: 2, artigo_sha256: SHA, decisao: "devolver", confirmo_revisao_editorial: true, ator_id: "marcos_mafra" };
    expect((validar({ operacao: "decidir", entrada: d }).resposta as { erro: { codigo: string } }).erro.codigo).toBe("devolucao_sem_motivos");
    expect(validar({ operacao: "decidir", entrada: { ...d, motivos: ["Rever a abertura do texto."] } }).rota).toBe("fila");
    expect((validar({ operacao: "decidir", entrada: { ...d, confirmo_revisao_editorial: false, motivos: ["Rever a abertura."] } }).resposta as { erro: { codigo: string } }).erro.codigo).toBe("confirmacao_ausente");
  });

  it("leituras restritas seguem pela rota de leitura (lista ou um trabalho)", () => {
    expect(validar({ operacao: "ler_resumos", entrada: base }).rota).toBe("leitura");
    expect(validar({ operacao: "ler_versao", entrada: { ...base, job_key: JOB, numero: 1 } }).rota).toBe("leitura_trabalho");
    expect(validar({ operacao: "ler_trabalho", entrada: { ...base, job_key: JOB } }).rota).toBe("leitura_trabalho");
    expect(validar({ operacao: "ler_trabalho", entrada: base }).rota).toBe("recusa");
  });

  const codigo = (r: Record<string, unknown>) => (r.resposta as { erro: { codigo: string } }).erro.codigo;

  it("preparar_correcao exige autorização explícita de cobrança e op_id do editor", () => {
    const c = { ...base, job_key: JOB, op_id: "painel:marcos_mafra:abcd1234-ef", revisao_esperada: 13, artigo_sha256: SHA, autorizar_cobranca: true, ator_id: "marcos_mafra" };
    const ok = validar({ operacao: "preparar_correcao", entrada: c });
    expect(ok.rota).toBe("fila");
    expect(ok.pedido).toEqual({ operacao: "preparar_correcao", ...c });
    expect(codigo(validar({ operacao: "preparar_correcao", entrada: { ...c, autorizar_cobranca: false } }))).toBe("cobranca_nao_autorizada");
    expect(codigo(validar({ operacao: "preparar_correcao", entrada: { ...c, autorizar_cobranca: "sim" } }))).toBe("cobranca_nao_autorizada");
    expect(codigo(validar({ operacao: "preparar_correcao", entrada: { ...c, op_id: "x" } }))).toBe("op_id_invalido");
    expect(codigo(validar({ operacao: "preparar_correcao", entrada: { ...c, motivos: ["inventado pelo chamador"] } }))).toBe("campo_nao_permitido");
  });

  it("retomar_producao vai ao produtor só com editor, revisão e autorização", () => {
    const r = { ...base, job_key: JOB, revisao_esperada: 14, autorizar_cobranca: true, ator_id: "marcos_mafra" };
    const ok = validar({ operacao: "retomar_producao", entrada: r });
    expect(ok.rota).toBe("producao");
    expect(codigo(validar({ operacao: "retomar_producao", entrada: { ...r, autorizar_cobranca: false } }))).toBe("cobranca_nao_autorizada");
    expect(codigo(validar({ operacao: "retomar_producao", entrada: { ...r, ator_id: "leitor_teste" } }))).toBe("editor_nao_autorizado");
    expect(codigo(validar({ operacao: "retomar_producao", entrada: { ...r, revisao_esperada: 0 } }))).toBe("revisao_invalida");
    for (const extra of [{ modo_execucao: "real" }, { fixture: {} }, { etapa: "redator" }, { op_id: "painel:marcos_mafra:abcd1234-ef" }]) {
      expect(codigo(validar({ operacao: "retomar_producao", entrada: { ...r, ...extra } }))).toBe("campo_nao_permitido");
    }
    // O produtor recusa qualquer campo além destes seis (incluindo `operacao`).
    const enviado = rodar(CODIGO.encaminharProdutor, [ok])[0].json;
    expect(Object.keys(enviado).sort()).toEqual(["ambiente", "ator_id", "autorizar_cobranca", "cliente_id", "job_key", "revisao_esperada"]);
    const resposta = rodar(CODIGO.respostaProdutor, [{}], { "Encaminhar pedido ao produtor": [enviado] })[0].json;
    expect(resposta.resposta).toEqual({ ok: true, resultado: { producao_iniciada: true, job_key: JOB, revisao_esperada: 14 } });
    // Depois da resposta, o produtor recebe o pedido, não a resposta.
    const repassado = rodar(CODIGO.repassarProdutor, [resposta], { "Encaminhar pedido ao produtor": [enviado] })[0].json;
    expect(repassado).toEqual(enviado);
  });
});

describe("adaptador — leitura restrita", () => {
  // Usa a própria função sha256 do código para montar uma linha íntegra.
  const sha256 = new Function(`${CODIGO.leitura.split("const pedido")[0]}; return sha256;`)() as (t: string) => string;
  const md1 = "# Título antigo\n\n" + "a".repeat(220);
  const md2 = "# Wai Kru: significado\n\n" + "b".repeat(220);
  const payload = {
    versao: "editorial_markdown_v2",
    job_key: JOB,
    cliente_id: base.cliente_id,
    ambiente: "teste",
    modo_execucao: "simulado",
    criado_em: "2026-11-02T14:36:49.738Z",
    atualizado_em: "2026-11-02T14:39:59.924Z",
    pacote: { research_input: { pauta: { titulo: "Wai Kru no Muay Thai", intencao: "informacional", tema: "Cultura" } } },
    versoes: [
      { numero: 1, sha256: sha256(md1), markdown: md1, origem: "redator", em: "x", completa: true },
      { numero: 2, sha256: sha256(md2), markdown: md2, origem: "revisor", em: "y", completa: true },
    ],
  };
  const texto = JSON.stringify(payload);
  const linha = { id: 1, job_key: JOB, cliente_id: base.cliente_id, ambiente: "teste", payload_json: texto, payload_sha256: sha256(texto) };

  it("ler_resumos devolve títulos sem expor o payload", () => {
    const out = rodar(CODIGO.leitura, [linha], { "Validar pedido do painel": [{ pedido: { operacao: "ler_resumos", ...base } }] })[0].json;
    const r = (out.resposta as { resultado: { resumos: Record<string, unknown>[] } }).resultado.resumos[0];
    expect(r).toMatchObject({ job_key: JOB, titulo_pauta: "Wai Kru no Muay Thai", titulo_artigo: "Wai Kru: significado", modo_execucao: "simulado" });
    expect(JSON.stringify(out)).not.toContain("research_input");
  });

  it("ler_versao devolve o texto pedido e confere o hash", () => {
    const out = rodar(CODIGO.leitura, [linha], { "Validar pedido do painel": [{ pedido: { operacao: "ler_versao", ...base, job_key: JOB, numero: 1 } }] })[0].json;
    const v = (out.resposta as { resultado: { versao: { markdown: string; sha256_confere: boolean } } }).resultado.versao;
    expect(v.markdown).toBe(md1);
    expect(v.sha256_confere).toBe(true);
  });

  // Mesmo recibo de `consultar` (qSummary da fila), com complementos do painel.
  const decisao = { decisao: "devolver", motivos: ["Rever a abertura do texto."], artigo_sha256: sha256(md2), versao_artigo: 2, ator_id: "marcos_mafra", em: "z" };
  const completo = {
    ...payload,
    pauta_id: "P004",
    revisao: 13,
    estado: "devolvido",
    etapa: "decisao_editorial",
    pacote: { research_input: { pauta: { ...payload.pacote.research_input.pauta, keyword: "wai kru significado" } } },
    etapas: { pesquisador: { briefing_markdown: "b" } },
    decisoes: [decisao],
    historico: [{ evento: "decisao_registrada", em: "z" }],
    operacoes: [{ id: "segredo-operacional" }],
    pendencias: ["p1"],
    inflight: null,
    chamadas_api_reservadas: 4,
    chamadas_api_com_uso_confirmado: 4,
    max_api_ciclo: 4,
    controle: { aprovacao_editorial: false, aprovacao_professor: false, publicacao_autorizada: false },
  };
  const textoCompleto = JSON.stringify(completo);
  const linhaCompleta = { ...linha, payload_json: textoCompleto, payload_sha256: sha256(textoCompleto) };
  const lerTrabalho = (linhas: Record<string, unknown>[]) =>
    rodar(CODIGO.leitura, linhas, { "Validar pedido do painel": [{ pedido: { operacao: "ler_trabalho", ...base, job_key: JOB } }] })[0].json.resposta as {
      ok: boolean;
      resultado: Record<string, unknown>;
      erro?: { codigo: string };
    };

  it("ler_trabalho devolve o recibo de consultar sem passar pela trava", () => {
    const r = lerTrabalho([linhaCompleta]);
    expect(r.ok).toBe(true);
    expect(r.resultado).toMatchObject({
      job_key: JOB,
      pauta_id: "P004",
      keyword: "wai kru significado",
      estado: "devolvido",
      revisao: 13,
      versao_artigo: 2,
      artigo_sha256: sha256(md2),
      artigo_markdown: md2,
      decisao_atual: decisao,
      pendencias: ["p1"],
      pendencias_sha256: sha256(JSON.stringify(["p1"])),
      reserva: null,
      chamadas_api_reservadas: 4,
      chamadas_api_com_uso_confirmado: 4,
      controle: { aprovacao_editorial: false, aprovacao_professor: false, publicacao_autorizada: false },
      proxima_etapa: null,
      retomada_bloqueada: false,
      leitura_sem_trava: true,
      max_api_ciclo: 4,
      correcao_disponivel: true,
      titulo_artigo: "Wai Kru: significado",
    });
    expect((r.resultado.versoes as Record<string, unknown>[])[0]).not.toHaveProperty("markdown");
    const json = JSON.stringify(r);
    expect(json).not.toContain("segredo-operacional");
    expect(json).not.toContain("briefing_markdown");
  });

  it("ler_trabalho mostra reserva e próxima etapa; recusa registro adulterado ou de outro escopo", () => {
    const emExecucao = { ...completo, estado: "executando", inflight: { lease: "L", etapa: "redator", em: "w", execucao_id: "777" } };
    const t = JSON.stringify(emExecucao);
    const r = lerTrabalho([{ ...linha, payload_json: t, payload_sha256: sha256(t) }]);
    expect(r.resultado.reserva).toEqual({ etapa: "redator", em: "w", execucao_id: "777" });
    expect(r.resultado.retomada_bloqueada).toBe(true);
    expect(JSON.stringify(r)).not.toContain('"L"');
    const parado = { ...completo, estado: "aguardando_redacao" };
    const tp = JSON.stringify(parado);
    expect(lerTrabalho([{ ...linha, payload_json: tp, payload_sha256: sha256(tp) }]).resultado.proxima_etapa).toBe("redator");
    expect(lerTrabalho([{ ...linhaCompleta, payload_sha256: SHA }]).erro?.codigo).toBe("trabalho_alterado");
    expect(lerTrabalho([{}]).erro?.codigo).toBe("trabalho_nao_encontrado");
    const outro = { ...completo, ambiente: "producao" };
    const to = JSON.stringify(outro);
    expect(lerTrabalho([{ ...linha, ambiente: "producao", payload_json: to, payload_sha256: sha256(to) }]).erro?.codigo).toBe("isolamento_da_fila");
  });

  it("recusa registro adulterado", () => {
    const adulterada = { ...linha, payload_json: texto.replace("Título antigo", "Título alterado") };
    const out = rodar(CODIGO.leitura, [adulterada], { "Validar pedido do painel": [{ pedido: { operacao: "ler_versao", ...base, job_key: JOB, numero: 1 } }] })[0].json;
    expect((out.resposta as { erro: { codigo: string } }).erro.codigo).toBe("trabalho_alterado");
  });
});

describe("adaptador — respostas e estrutura do workflow", () => {
  it("converte recusa da fila em erro com código", () => {
    const out = rodar(CODIGO.respostaFila, [{ ok: false, codigo: "conflito_de_versao" }])[0].json;
    expect(out.resposta).toEqual({ ok: false, erro: { codigo: "conflito_de_versao", mensagem: "conflito_de_versao" } });
    const err = rodar(CODIGO.erroFila, [{ error: { message: "campo_nao_permitido" } }])[0].json;
    expect((err.resposta as { erro: { codigo: string } }).erro.codigo).toBe("campo_nao_permitido");
  });

  it("aponta somente para o subworkflow e a tabela da fila V2, com autenticação por cabeçalho", () => {
    const wf = montarWorkflow("CRED123");
    const webhook = wf.nodes.find((n) => n.type === "n8n-nodes-base.webhook");
    expect(webhook?.parameters).toMatchObject({ httpMethod: "POST", authentication: "headerAuth", path: IDS.path, responseMode: "responseNode" });
    expect(webhook?.credentials?.httpHeaderAuth.id).toBe("CRED123");
    const exec = wf.nodes.filter((n) => n.type === "n8n-nodes-base.executeWorkflow");
    expect(exec.map((n) => (n.parameters.workflowId as { value: string }).value).sort()).toEqual([
      "1Y2tf9mzggbGIpHZ",
      "8zHUZGYSA0nPhMWI",
      "Kk56hrmdN3ljNUh0",
      "MafraFontesPauta",
      "MafraFontesPauta",
    ]);
    expect(exec.every((n) => (n.parameters.options as { waitForSubWorkflow: boolean }).waitForSubWorkflow === true)).toBe(true);
    // A curadoria em segundo plano responde ao painel antes de executar, como o produtor.
    const cadeiaFontes = ["Fontes em segundo plano?", "Encaminhar pedido de fontes", "Formatar aceite das fontes", "Responder aceite das fontes", "Repassar pedido de fontes", "Executar curadoria de fontes"];
    for (let i = 0; i < cadeiaFontes.length - 1; i += 1) expect(wf.connections[cadeiaFontes[i]].main[0][0].node).toBe(cadeiaFontes[i + 1]);
    expect(wf.nodes.find((n) => n.name === "Executar curadoria de fontes")?.onError).toBeUndefined();
    expect(wf.nodes.find((n) => n.name === "Executar enfileirador")?.onError).toBe("continueErrorOutput");
    const fila = exec.find((n) => (n.parameters.workflowId as { value: string }).value === "8zHUZGYSA0nPhMWI");
    const produtor = exec.find((n) => (n.parameters.workflowId as { value: string }).value === "Kk56hrmdN3ljNUh0");
    expect((fila?.parameters.options as { waitForSubWorkflow: boolean }).waitForSubWorkflow).toBe(true);
    expect(fila?.onError).toBe("continueErrorOutput");
    // "Sem aguardar" gerava subexecução vazia no n8n: responde ao painel primeiro e executa aguardando.
    expect((produtor?.parameters.options as { waitForSubWorkflow: boolean }).waitForSubWorkflow).toBe(true);
    expect(produtor?.onError).toBeUndefined();
    const cadeia = ["Iniciar produção?", "Encaminhar pedido ao produtor", "Formatar início da produção", "Responder disparo ao painel", "Repassar pedido ao produtor", "Executar produtor"];
    for (let i = 0; i < cadeia.length - 1; i += 1) expect(wf.connections[cadeia[i]].main[0][0].node).toBe(cadeia[i + 1]);
    expect(wf.nodes.find((n) => n.name === "Responder disparo ao painel")?.type).toBe("n8n-nodes-base.respondToWebhook");
    const tabelas = wf.nodes.filter((n) => n.type === "n8n-nodes-base.dataTable");
    expect(tabelas.every((n) => n.parameters.operation === "get")).toBe(true);
    expect(new Set(tabelas.map((n) => (n.parameters.dataTableId as { value: string }).value))).toEqual(new Set(["Z8Fekq9qMO3DRWNA", "I0kHnbGg35Y9RA5Y"]));
    const porChave = tabelas.find((n) => n.name === "Ler trabalho do escopo");
    expect(JSON.stringify(porChave?.parameters.filters)).toContain('"keyName":"job_key"');
    for (const [origem, c] of Object.entries(wf.connections)) {
      expect(wf.nodes.some((n) => n.name === origem)).toBe(true);
      for (const saida of c.main) for (const destino of saida) expect(wf.nodes.some((n) => n.name === destino.node)).toBe(true);
    }
    expect(wf.settings.saveDataSuccessExecution).toBe("none");
    // Não pode cortar o produtor (executionTimeout 1800 s) disparado por este workflow.
    expect(wf.settings.executionTimeout as number).toBeGreaterThan(1800);
  });
});

describe("adaptador — pautas", () => {
  const PLANO = `plano:${base.cliente_id}:v2_abc`;
  const codigo = (r: Record<string, unknown>) => (r.resposta as { erro: { codigo: string } }).erro.codigo;

  it("listar_pautas é leitura só com o cliente", () => {
    expect(validar({ operacao: "listar_pautas", entrada: { cliente_id: base.cliente_id } }).rota).toBe("leitura_pautas");
    expect(codigo(validar({ operacao: "listar_pautas", entrada: { cliente_id: "outro_cliente" } }))).toBe("cliente_nao_permitido");
  });

  it("propor_fontes exige editor, autorização e URLs extras https; aprovar não pede cobrança", () => {
    const p = { cliente_id: base.cliente_id, plano_cache_key: PLANO, pauta_id: "P001", ator_id: "marcos_mafra", autorizar_cobranca: true };
    expect(validar({ operacao: "propor_fontes", entrada: p }).rota).toBe("fontes_async");
    expect(validar({ operacao: "propor_fontes", entrada: { ...p, urls_extras: ["https://cbmt.org.br/regras/"] } }).rota).toBe("fontes_async");
    expect(codigo(validar({ operacao: "propor_fontes", entrada: { ...p, autorizar_cobranca: false } }))).toBe("cobranca_nao_autorizada");
    expect(codigo(validar({ operacao: "propor_fontes", entrada: { ...p, urls_extras: ["http://x.com/"] } }))).toBe("urls_extras_invalidas");
    expect(codigo(validar({ operacao: "propor_fontes", entrada: { ...p, ator_id: "leitor_teste" } }))).toBe("editor_nao_autorizado");
    expect(codigo(validar({ operacao: "propor_fontes", entrada: { ...p, plano_cache_key: "plano:outro:v2_x" } }))).toBe("plano_invalido");
    const { autorizar_cobranca, ...semCobranca } = p;
    expect(autorizar_cobranca).toBe(true);
    expect(validar({ operacao: "aprovar_fontes", entrada: semCobranca }).rota).toBe("fontes_sync");
    expect(codigo(validar({ operacao: "aprovar_fontes", entrada: p }))).toBe("campo_nao_permitido");
  });

  it("enfileirar_pauta exige ambiente, op_id do editor e não aceita confirmo_pauta do chamador", () => {
    const e = { cliente_id: base.cliente_id, ambiente: "producao", plano_cache_key: PLANO, pauta_id: "P001", ator_id: "marcos_mafra", op_id: "painel:marcos_mafra:abcd1234-ef" };
    const ok = validar({ operacao: "enfileirar_pauta", entrada: e });
    expect(ok.rota).toBe("enfileirador");
    const enviado = rodar(CODIGO.encaminharEnfileirador, [ok])[0].json;
    expect(enviado).toEqual({ ...e, confirmo_pauta: true });
    expect(codigo(validar({ operacao: "enfileirar_pauta", entrada: { ...e, confirmo_pauta: false } }))).toBe("campo_nao_permitido");
    expect(codigo(validar({ operacao: "enfileirar_pauta", entrada: { ...e, ambiente: "homologacao" } }))).toBe("ambiente_invalido");
    expect(codigo(validar({ operacao: "enfileirar_pauta", entrada: { ...e, op_id: "x" } }))).toBe("op_id_invalido");
  });

  it("curadoria: o aceite sai antes e a curadoria recebe o pedido completo", () => {
    const v = validar({ operacao: "propor_fontes", entrada: { cliente_id: base.cliente_id, plano_cache_key: PLANO, pauta_id: "P002", ator_id: "marcos_mafra", autorizar_cobranca: true } });
    const pedido = rodar(CODIGO.encaminharFontes, [v])[0].json;
    expect(pedido).toEqual({ modo: "propor", cliente_id: base.cliente_id, plano_cache_key: PLANO, pauta_id: "P002", ator_id: "marcos_mafra", autorizar_cobranca: true, urls_extras: [] });
    const aceite = rodar(CODIGO.aceiteFontes, [{}], { "Encaminhar pedido de fontes": [pedido] })[0].json;
    expect(aceite.resposta).toEqual({ ok: true, resultado: { proposta_iniciada: true, pauta_id: "P002" } });
    expect(rodar(CODIGO.repassarFontes, [aceite], { "Encaminhar pedido de fontes": [pedido] })[0].json).toEqual(pedido);
  });

  it("listar pautas: status de fontes por pauta e plano adulterado vira falha", () => {
    const sha256 = new Function(`${CODIGO.pautas.split("const pedido")[0]}; return sha256;`)() as (t: string) => string;
    const hash = (v: unknown) => sha256(JSON.stringify(v));
    const pautas = [
      { id: "P001", keyword: "k1", titulo: "T1", acao: "criar", serp: { resultados: [{ rank: 1, title: "R", website_name: "S", url: "https://a.org/", is_video: false }] } },
      { id: "P002", keyword: "k2", titulo: "T2", acao: "criar" },
      { id: "P003", keyword: "k3", titulo: "T3", acao: "criar" },
    ];
    const original = JSON.stringify({ pautas });
    const plano = { plano_id: "v2_x", site_url: "https://site.com.br/", plano_sha256: sha256(original), plano_original_json: original, pautas, pautas_sha256: Object.fromEntries(pautas.map((p) => [p.id, hash(p)])), criado_em: "2026-11-01" };
    const row = (tipo: string, cache_key: string, payload: unknown, id: number) => {
      const t = JSON.stringify(payload);
      return { id, tipo, cache_key, cliente_id: base.cliente_id, payload_json: t, payload_sha256: sha256(t) };
    };
    const chave = (p: { id: string }) => `fontes:${base.cliente_id}:${p.id}:${hash(p)}`;
    const docs = [1, 2, 3].map((i) => ({ id: `F${i}`, url: `https://f${i}.org/`, titulo: "t", entidade: "e", localizador: "l", limites: "x", inicio: "i".repeat(20), fim: "f".repeat(12) }));
    const refs = {
      "Validar pedido do painel": [{ pedido: { operacao: "listar_pautas", cliente_id: base.cliente_id } }],
      "Ler planos do cliente": [row("plano", PLANO, plano, 1), { ...row("plano", `plano:${base.cliente_id}:v2_y`, plano, 2), payload_sha256: "0".repeat(64) }],
      "Ler propostas de fontes": [row("fontes_pauta_proposta", chave(pautas[0]), { status: "pronta", previas: [{ id: "F1" }], candidatos: [], gerado_em: "g" }, 3), row("fontes_pauta_proposta", chave(pautas[1]), { status: "insuficiente", motivo: "menos_de_tres_fontes_aptas", candidatos: [] }, 4)],
      "Ler fontes aprovadas": [row("fontes_pauta", chave(pautas[0]), { documentos: docs }, 5)],
    };
    const out = rodar(CODIGO.pautas, [{}], refs)[0].json;
    const r = (out.resposta as { resultado: { planos: { pautas: { id: string; fontes: { estado: string; documentos?: unknown[] }; integra: boolean; serp: unknown[] }[] }[]; falhas: { codigo: string }[] } }).resultado;
    expect(r.planos).toHaveLength(1);
    expect(r.falhas).toEqual([{ cache_key: `plano:${base.cliente_id}:v2_y`, codigo: "plano_alterado" }]);
    const [p1, p2, p3] = r.planos[0].pautas;
    expect(p1.fontes.estado).toBe("aprovada");
    expect(p1.fontes.documentos).toHaveLength(3);
    expect(JSON.stringify(p1.fontes)).not.toContain("iiiiiiii");
    expect(p2.fontes.estado).toBe("insuficiente");
    expect(p3.fontes.estado).toBe("nenhuma");
    expect(p1.integra && p1.serp.length === 1).toBe(true);
  });
});

