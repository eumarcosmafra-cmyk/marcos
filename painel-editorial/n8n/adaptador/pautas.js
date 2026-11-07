// Nó Code "Montar lista de pautas": planos gravados pelo Planejador, propostas de fontes e
// fontes aprovadas do cliente. Só leitura da Data Table de contexto, com conferência de hash.
// __SHA256__

const pedido = $('Validar pedido do painel').first().json.pedido;
const linhas = (nome) => $(nome).all().map((i) => i.json).filter((r) => r && r.id && r.cliente_id === pedido.cliente_id);
function ler(row) {
  if (typeof row.payload_json !== 'string' || sha256(row.payload_json) !== row.payload_sha256) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch (e) {
    return null;
  }
}
const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
const falhas = [];
const propostas = new Map();
const aprovadas = new Map();
for (const r of linhas('Ler propostas de fontes')) {
  const p = ler(r);
  if (p) propostas.set(r.cache_key, p);
  else falhas.push({ cache_key: r.cache_key, codigo: 'proposta_alterada' });
}
for (const r of linhas('Ler fontes aprovadas')) {
  const p = ler(r);
  if (p) aprovadas.set(r.cache_key, { p, em: r.atualizado_em || r.consultado_em || null });
  else falhas.push({ cache_key: r.cache_key, codigo: 'fontes_alteradas' });
}
const planos = [];
for (const r of linhas('Ler planos do cliente')) {
  const plano = ler(r);
  if (!plano || typeof plano.plano_original_json !== 'string' || sha256(plano.plano_original_json) !== plano.plano_sha256) {
    falhas.push({ cache_key: r.cache_key, codigo: 'plano_alterado' });
    continue;
  }
  const pautas = (Array.isArray(plano.pautas) ? plano.pautas : []).map((pa) => {
    const h = sha256(JSON.stringify(pa));
    const chave = 'fontes:' + pedido.cliente_id + ':' + pa.id + ':' + h;
    const prop = propostas.get(chave);
    const apr = aprovadas.get(chave);
    let fontes = { estado: 'nenhuma' };
    if (prop) {
      fontes = {
        estado: prop.status === 'pronta' ? 'proposta' : 'insuficiente',
        proposta: {
          status: prop.status,
          motivo: prop.motivo || null,
          gerado_em: prop.gerado_em || null,
          previas: Array.isArray(prop.previas) ? prop.previas : [],
          candidatos: (Array.isArray(prop.candidatos) ? prop.candidatos : []).map((c) => ({
            id: c.id,
            origem: c.origem || null,
            url: texto(c.url_final || c.url_serp, 500),
            dominio: c.dominio || null,
            titulo: texto(c.titulo_serp, 200),
            situacao: c.situacao || null,
            motivo: c.motivo || null,
            fonte: c.fonte || null,
          })),
          selecao: prop.selecao || null,
          urls_extras: Array.isArray(prop.urls_extras) ? prop.urls_extras : [],
        },
      };
    }
    if (apr) {
      fontes = {
        ...fontes,
        estado: 'aprovada',
        aprovada_em: apr.em,
        documentos: (Array.isArray(apr.p.documentos) ? apr.p.documentos : []).map((d) => ({ id: d.id, url: d.url, titulo: d.titulo, entidade: d.entidade, localizador: d.localizador, limites: d.limites })),
      };
    }
    const resultados = pa.serp && Array.isArray(pa.serp.resultados) ? pa.serp.resultados : [];
    return {
      id: pa.id,
      keyword: pa.keyword,
      titulo: pa.titulo,
      acao: pa.acao,
      intencao: pa.intencao || null,
      prioridade: pa.prioridade || null,
      status: pa.status || null,
      tema: pa.tema || null,
      justificativa: texto(pa.justificativa, 2000),
      diferenca_acervo: texto(pa.diferenca_acervo, 2000),
      apuracao_pendente: Array.isArray(pa.apuracao_pendente) ? pa.apuracao_pendente.filter((x) => typeof x === 'string') : [],
      links_internos: Array.isArray(pa.links_internos_urls) ? pa.links_internos_urls.filter((x) => typeof x === 'string') : [],
      volume: pa.metricas && typeof pa.metricas.search_volume === 'number' ? pa.metricas.search_volume : null,
      secundarias: (Array.isArray(pa.secundarias) ? pa.secundarias : []).map((s) => s && s.keyword).filter((k) => typeof k === 'string'),
      serp: resultados.map((s) => ({ rank: typeof s.rank === 'number' ? s.rank : null, titulo: texto(s.title, 200) || '', site: texto(s.website_name, 120) || '', url: texto(s.url, 500) || '', video: s.is_video === true })),
      integra: Boolean(plano.pautas_sha256 && plano.pautas_sha256[pa.id] === h),
      fontes,
    };
  });
  planos.push({ plano_cache_key: r.cache_key, plano_id: plano.plano_id || null, criado_em: plano.criado_em || r.consultado_em || null, site_url: plano.site_url || null, total_pautas: pautas.length, pautas });
}
planos.sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
return [{ json: { http_status: 200, resposta: { ok: true, resultado: { planos, falhas } } } }];
