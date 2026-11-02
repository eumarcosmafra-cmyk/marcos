// Nó Code "Leitura restrita da fila" (executar uma vez para todos os itens).
// Somente leitura. Recebe as linhas da Data Table já filtradas por cliente e
// ambiente, confere a integridade (payload_sha256) e devolve só o necessário:
//  - ler_resumos: títulos e datas de cada trabalho (a listagem oficial não traz);
//  - ler_versao: texto de uma versão anterior (a consulta oficial só traz a atual).
// __SHA256__

const pedido = $('Validar pedido do painel').first().json.pedido;
const linhas = $input.all().map((i) => i.json).filter((r) => r && r.id);

function carregar(row) {
  if (row.payload_sha256 !== sha256(row.payload_json || '')) return { erro: 'trabalho_alterado' };
  let j;
  try {
    j = JSON.parse(row.payload_json);
  } catch {
    return { erro: 'payload_ilegivel' };
  }
  if (j.versao !== 'editorial_markdown_v2' || j.job_key !== row.job_key || j.cliente_id !== row.cliente_id || j.ambiente !== row.ambiente) {
    return { erro: 'identidade_persistida_divergente' };
  }
  if (j.cliente_id !== pedido.cliente_id || j.ambiente !== pedido.ambiente) return { erro: 'isolamento_da_fila' };
  return { j };
}

function tituloH1(markdown) {
  if (typeof markdown !== 'string') return null;
  const m = markdown.match(/^#\s+(.+?)\s*#*\s*$/m);
  return m ? m[1].slice(0, 300) : null;
}

function responder(resposta) {
  return [{ json: { http_status: 200, resposta } }];
}

if (pedido.operacao === 'ler_resumos') {
  const resumos = [];
  const falhas = [];
  for (const row of linhas) {
    const r = carregar(row);
    if (r.erro) {
      falhas.push({ job_key: row.job_key, codigo: r.erro });
      continue;
    }
    const pauta = (r.j.pacote && r.j.pacote.research_input && r.j.pacote.research_input.pauta) || {};
    const atual = r.j.versoes[r.j.versoes.length - 1];
    resumos.push({
      job_key: r.j.job_key,
      titulo_pauta: typeof pauta.titulo === 'string' ? pauta.titulo.slice(0, 300) : null,
      intencao: typeof pauta.intencao === 'string' ? pauta.intencao : null,
      tema: typeof pauta.tema === 'string' ? pauta.tema.slice(0, 200) : null,
      titulo_artigo: atual ? tituloH1(atual.markdown) : null,
      modo_execucao: r.j.modo_execucao === 'simulado' ? 'simulado' : 'real',
      criado_em: r.j.criado_em || null,
      atualizado_em: r.j.atualizado_em || null,
    });
  }
  return responder({ ok: true, resultado: { resumos, falhas } });
}

if (pedido.operacao === 'ler_versao') {
  const row = linhas.find((r) => r.job_key === pedido.job_key);
  if (!row) return responder({ ok: false, erro: { codigo: 'trabalho_nao_encontrado', mensagem: 'Trabalho não encontrado neste escopo.' } });
  const r = carregar(row);
  if (r.erro) return responder({ ok: false, erro: { codigo: r.erro, mensagem: 'Registro não passou na conferência de integridade.' } });
  const v = r.j.versoes.find((x) => x.numero === pedido.numero);
  if (!v) return responder({ ok: false, erro: { codigo: 'versao_nao_encontrada', mensagem: 'Versão inexistente.' } });
  return responder({
    ok: true,
    resultado: {
      job_key: r.j.job_key,
      revisao: r.j.revisao,
      versao: { numero: v.numero, sha256: v.sha256, origem: v.origem, em: v.em, completa: v.completa, markdown: v.markdown, sha256_confere: sha256(v.markdown) === v.sha256 },
    },
  });
}

return responder({ ok: false, erro: { codigo: 'operacao_nao_permitida', mensagem: 'Leitura não suportada.' } });
