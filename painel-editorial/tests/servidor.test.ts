import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSessionToken, readSessionToken, resolveSessionUser } from "@/server/auth/session";
import { buildDecisao, buildEdicao, decisaoSchema, edicaoSchema, parseBody } from "@/server/fila/inputs";
import { mapQueueError } from "@/server/fila/errors";
import { sanitizeResumo, sanitizeTrabalho } from "@/server/fila/sanitize";
import { PainelError } from "@/server/painel-error";
import type { UsuarioConfig } from "@/server/config";

const SECRET = Buffer.from("x".repeat(48));
const JOB = "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888";
const SHA = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const marcos = { usuario: "marcos", nome: "Marcos Mafra", ator_id: "marcos_mafra", papel: "editor_responsavel" as const, cliente_id: "altovaletopteam_com_br", ambientes: ["producao" as const, "teste" as const] };

describe("senha e sessão", () => {
  it("hash scrypt confere só com a senha certa", async () => {
    const h = await hashPassword("uma-senha-bem-longa-123", { N: 1024, r: 8, p: 1 });
    expect(h.startsWith("scrypt$1024$8$1$")).toBe(true);
    expect(await verifyPassword("uma-senha-bem-longa-123", h)).toBe(true);
    expect(await verifyPassword("uma-senha-bem-longa-124", h)).toBe(false);
    expect(await verifyPassword("x", "texto-qualquer")).toBe(false);
  });

  it("cookie assinado: adulteração e expiração invalidam", () => {
    const t = createSessionToken("marcos", SECRET, 3600, 1_000_000_000_000);
    expect(readSessionToken(t, SECRET, 1_000_000_000_000)?.u).toBe("marcos");
    const [data, mac] = t.split(".");
    const forjado = Buffer.from(JSON.stringify({ u: "outro", iat: 1, exp: 9e12 })).toString("base64url");
    expect(readSessionToken(`${forjado}.${mac}`, SECRET)).toBeNull();
    expect(readSessionToken(`${data}.${mac}x`, SECRET)).toBeNull();
    expect(readSessionToken(t, SECRET, 1_000_000_000_000 + 3601_000)).toBeNull();
    expect(readSessionToken(t, Buffer.from("y".repeat(48)), 1_000_000_000_000)).toBeNull();
  });

  it("usuário desativado perde a sessão", () => {
    const usuarios: UsuarioConfig[] = [{ ...marcos, senha_hash: "scrypt$x", ativo: false }];
    expect(resolveSessionUser({ u: "marcos", iat: 0, exp: 9e12 }, usuarios)).toBeNull();
  });
});

describe("entradas montadas pela sessão", () => {
  it("navegador não escolhe ator, cliente, ambiente nem workflow", () => {
    const tentativa = { op_uuid: "abcd1234-ef", revisao_esperada: 2, artigo_sha256: SHA, markdown: "x".repeat(300), ator_id: "outro", cliente_id: "outro" };
    expect(() => parseBody(edicaoSchema, tentativa)).toThrow(PainelError);
    const body = parseBody(edicaoSchema, { op_uuid: "abcd1234-ef", revisao_esperada: 2, artigo_sha256: SHA, markdown: "x".repeat(300) });
    const e = buildEdicao(marcos, "teste", JOB, body);
    expect(e).toMatchObject({ ator_id: "marcos_mafra", cliente_id: "altovaletopteam_com_br", ambiente: "teste", op_id: "painel:marcos_mafra:abcd1234-ef" });
    expect(Object.keys(e)).not.toContain("workflowId");
  });

  it("decisão: devolução exige motivo; justificativa exige identificação das pendências", () => {
    const base = { op_uuid: "abcd1234-ef", revisao_esperada: 2, artigo_sha256: SHA, confirmo_revisao_editorial: true };
    expect(() => parseBody(decisaoSchema, { ...base, decisao: "devolver" })).toThrow(/motivo/);
    expect(() => parseBody(decisaoSchema, { ...base, decisao: "aprovar", confirmo_revisao_editorial: false })).toThrow();
    expect(() => parseBody(decisaoSchema, { ...base, decisao: "aprovar", pendencias_sha256: SHA, justificativa_pendencias: "curta" })).toThrow(/20/);
    const ok = parseBody(decisaoSchema, { ...base, decisao: "aprovar", pendencias_sha256: SHA, justificativa_pendencias: "Avaliei as três pendências e aceito publicar depois do professor." });
    const d = buildDecisao(marcos, "producao", JOB, ok);
    expect(d).toMatchObject({ decisao: "aprovar", confirmo_revisao_editorial: true, pendencias_sha256: SHA, ator_id: "marcos_mafra" });
    // Aprovação sem as pendências passa pelo painel, mas a fila recusa (pendencias_exigem_decisao_explicita).
    const sem = buildDecisao(marcos, "producao", JOB, parseBody(decisaoSchema, { ...base, decisao: "aprovar" }));
    expect(sem).not.toHaveProperty("pendencias_sha256");
  });

  it("códigos da fila viram erros identificáveis", () => {
    expect(mapQueueError("conflito_de_versao", "").code).toBe("VERSAO_DESATUALIZADA");
    expect(mapQueueError("pendencias_exigem_decisao_explicita", "").status).toBe(422);
    expect(mapQueueError("controle_ocupado_ou_indisponivel", "").code).toBe("FILA_OCUPADA");
    expect(mapQueueError("algo_novo", "texto").detail).toEqual({ codigo_fila: "algo_novo" });
  });
});

describe("sanitização", () => {
  const bruto = {
    job_key: JOB,
    cliente_id: "altovaletopteam_com_br",
    pauta_id: "P004",
    keyword: "wai kru significado",
    ambiente: "producao",
    estado: "pendente_ajustes",
    etapa: "rascunho_importado",
    revisao: 2,
    versao_artigo: 1,
    artigo_sha256: SHA,
    artigo_markdown: "# Wai Kru: significado e ritual de respeito no Muay Thai\n\nTexto.",
    decisao_atual: null,
    versoes: [{ numero: 1, sha256: SHA, origem: "importacao_documentada", em: "2026-11-02T14:36:49.738Z", completa: true }],
    historico: [{ evento: "pauta_enfileirada", ator: "marcos_mafra", em: "x", pauta_aprovada: false, entrada_sha256: "abc" }],
    pendencias: ["p1", "p2", "p3"],
    pendencias_sha256: SHA,
    reserva: null,
    chamadas_api_reservadas: 0,
    controle: { aprovacao_editorial: false, aprovacao_professor: false, publicacao_autorizada: false },
    pacote: { segredo: "não deve sair" },
  };

  it("entrega só o necessário e calcula as ações", () => {
    const t = sanitizeTrabalho(bruto, "producao", true);
    expect(t?.titulo_artigo).toBe("Wai Kru: significado e ritual de respeito no Muay Thai");
    expect(t?.pendencias).toHaveLength(3);
    expect(t?.acoes).toMatchObject({ pode_editar: true, pode_aprovar: true, pode_devolver: true, exige_avaliacao_pendencias: true });
    expect(JSON.stringify(t)).not.toContain("não deve sair");
    expect(t?.historico[0].detalhes).toEqual({ pauta_aprovada: false });
  });

  it("leitor não recebe ações; ambiente divergente é descartado", () => {
    expect(sanitizeTrabalho(bruto, "producao", false)?.acoes.pode_aprovar).toBe(false);
    expect(sanitizeResumo(bruto, "teste")).toBeNull();
  });

  it("estado devolvido não permite aprovar, só devolver de novo ou editar", () => {
    const t = sanitizeTrabalho({ ...bruto, estado: "devolvido" }, "producao", true);
    expect(t?.acoes.pode_aprovar).toBe(false);
    expect(t?.acoes.pode_devolver).toBe(true);
    expect(t?.acoes.pode_editar).toBe(true);
  });
});
