#!/usr/bin/env node
// Libera o ambiente "producao" no Enfileirador 1Y2tf9mzggbGIpHZ ("Montar e enfileirar pauta de plano persistido").
// Muda só 4 trechos: a checagem de ambiente (3 nós) e o ambiente fixo do pedido à fila (1 nó).
// Os marcadores do pacote (cadeia_editorial_v2_teste, chain_control.ambiente "teste") ficam iguais:
// são constantes do contrato validadas pela fila e pelos agentes, não o ambiente do trabalho.
// Uso: node scripts/liberar-producao-enfileirador.mjs --entrada=export.json --saida=liberado.json
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const TROCAS = [
  {
    nome: "checagem de ambiente",
    antes: "ppEnsure(p.ambiente==='teste',p.ambiente==='producao'?'contrato_de_producao_pendente':'ambiente_invalido');",
    depois: "ppEnsure(p.ambiente==='teste'||p.ambiente==='producao','ambiente_invalido');",
    esperado: 3,
  },
  { nome: "ambiente do pedido à fila", antes: "ambiente:'teste',ator_id:p.ator_id", depois: "ambiente:p.ambiente,ator_id:p.ator_id", esperado: 1 },
];

export function liberarProducao(entrada) {
  const wf = JSON.parse(JSON.stringify(Array.isArray(entrada) ? entrada[0] : entrada));
  if (wf.id && wf.id !== "1Y2tf9mzggbGIpHZ") throw new Error(`workflow inesperado: ${wf.id}`);
  const contagem = Object.fromEntries(TROCAS.map((t) => [t.nome, 0]));
  for (const n of wf.nodes) {
    const js = n.parameters && n.parameters.jsCode;
    if (typeof js !== "string") continue;
    let novo = js;
    for (const t of TROCAS) {
      const partes = novo.split(t.antes);
      contagem[t.nome] += partes.length - 1;
      novo = partes.join(t.depois);
    }
    n.parameters.jsCode = novo;
  }
  for (const t of TROCAS) {
    if (contagem[t.nome] !== t.esperado) throw new Error(`"${t.nome}": esperado ${t.esperado}, encontrado ${contagem[t.nome]} (versão diferente da revisada)`);
  }
  return { wf, contagem };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const arg = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
  const { wf, contagem } = liberarProducao(JSON.parse(readFileSync(arg("entrada"), "utf8")));
  writeFileSync(arg("saida"), JSON.stringify(wf, null, 2) + "\n");
  console.log("Trocas:", JSON.stringify(contagem));
}
