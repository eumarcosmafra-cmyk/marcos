import { describe, expect, it } from "vitest";
import { adaptRedacaoOutput, mapWorkflowStatuses } from "@/domain/workflow-mapping";

describe("mapWorkflowStatuses", () => {
  it("aguardando_revisao_humana vai para a fila de revisão sem pendências", () => {
    expect(mapWorkflowStatuses(["aguardando_revisao_humana"])).toEqual({ inReviewQueue: true, flags: [], unknownStatuses: [] });
  });

  it("pendências de legibilidade e fontes coexistem e preservam o status original", () => {
    const m = mapWorkflowStatuses(["revisao_obrigatoria_legibilidade", "revisao_obrigatoria_fontes"]);
    expect(m.inReviewQueue).toBe(true);
    expect(m.flags).toEqual([
      { kind: "legibilidade", originalStatus: "revisao_obrigatoria_legibilidade" },
      { kind: "fontes", originalStatus: "revisao_obrigatoria_fontes" },
    ]);
  });

  it("status desconhecido é preservado, não descartado nem interpretado", () => {
    expect(mapWorkflowStatuses(["publicado_automaticamente"]).unknownStatuses).toEqual(["publicado_automaticamente"]);
  });
});

describe("adaptRedacaoOutput", () => {
  it("campos ausentes geram estados vazios e são listados", () => {
    const a = adaptRedacaoOutput({ palavra_chave: "fundamentos do boxe" });
    expect(a.keyword).toBe("fundamentos do boxe");
    expect(a.articleMarkdown).toBeUndefined();
    expect(a.chunks).toEqual([]);
    expect(a.missingFields).toContain("artigo_markdown");
    expect(a.missingFields).not.toContain("palavra_chave");
  });

  it("entrada inválida não quebra", () => {
    const a = adaptRedacaoOutput("texto solto");
    expect(a.missingFields.length).toBe(12);
  });

  it("similaridade só aparece quando vem no dado; rag_hibrido sem categoria não é classificado por suposição", () => {
    const a = adaptRedacaoOutput({
      artigo_markdown: "# Título",
      fontes_dominio: [{ titulo: "Fonte A", url: "https://a.example", texto: "trecho A", chunk_id: "c1", similaridade: 0.8 }],
      fontes_metodo: [{ title: "Guia", text: "trecho B" }],
      rag_hibrido: [
        { categoria: "cliente", texto: "trecho C" },
        { texto: "trecho sem categoria" },
      ],
      legibilidade: { motivos: ["Frase longa"] },
      avisos: ["Aviso 1"],
      controle: { status: ["revisao_obrigatoria_fontes"], execucao: "run-1", ignorado: { x: 1 } },
    });
    expect(a.chunks.map((c) => [c.category, c.text, c.similarity])).toEqual([
      ["dominio", "trecho A", 0.8],
      ["metodo", "trecho B", undefined],
      ["cliente", "trecho C", undefined],
    ]);
    expect(a.readability.reasons).toEqual(["Frase longa"]);
    expect(a.warnings).toEqual(["Aviso 1"]);
    expect(a.statuses).toEqual(["revisao_obrigatoria_fontes"]);
    expect(a.controle).toEqual({ execucao: "run-1" });
  });
});
