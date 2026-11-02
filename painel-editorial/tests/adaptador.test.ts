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
    for (const op of ["enfileirar", "aprovar_pauta", "preparar_correcao", "retomar", "iniciar_etapa"]) {
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

  it("leituras restritas seguem pela rota de leitura", () => {
    expect(validar({ operacao: "ler_resumos", entrada: base }).rota).toBe("leitura");
    expect(validar({ operacao: "ler_versao", entrada: { ...base, job_key: JOB, numero: 1 } }).rota).toBe("leitura");
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
    expect(exec).toHaveLength(1);
    expect((exec[0].parameters.workflowId as { value: string }).value).toBe("8zHUZGYSA0nPhMWI");
    expect(exec[0].onError).toBe("continueErrorOutput");
    const tabelas = wf.nodes.filter((n) => n.type === "n8n-nodes-base.dataTable");
    expect(tabelas.every((n) => n.parameters.operation === "get")).toBe(true);
    for (const [origem, c] of Object.entries(wf.connections)) {
      expect(wf.nodes.some((n) => n.name === origem)).toBe(true);
      for (const saida of c.main) for (const destino of saida) expect(wf.nodes.some((n) => n.name === destino.node)).toBe(true);
    }
    expect(wf.settings.saveDataSuccessExecution).toBe("none");
  });
});
