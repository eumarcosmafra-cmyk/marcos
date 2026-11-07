// Nó "Preparar candidatos": um item por candidato, com o pedido de coleta ao Crawl4AI.
// Sem candidatos, emite um item sentinela (coleta vazia) para o fluxo seguir até a proposta.
const base = $('Conferir plano').first().json;
const req = $('Validar pedido').first().json.request;
const candidatos = fCandidatosSerp(base.pauta, base.plano.site_url, req.urls_extras);
if (!candidatos.length) return [{ json: { sentinela: true, crawl: { urls: [] }, registro: [] } }];
return candidatos.map((c) => ({ json: { ...c, crawl: fCrawl(c.url_serp) } }));
