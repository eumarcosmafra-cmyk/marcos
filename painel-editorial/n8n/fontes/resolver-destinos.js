// Nó "Resolver destinos": a 1ª coleta revela o endereço final (a SERP traz links google.com/goto).
// A 2ª coleta usa esse endereço, exatamente como o Pesquisador fará depois.
const enviados = $('Preparar candidatos').all().map((i) => i.json);
const respostas = $input.all().map((i) => i.json);
const base = $('Conferir plano').first().json;
const cliente = fHost(base.plano.site_url);
const registro = [];
const proximos = [];
const finais = new Set();
enviados.forEach((c, i) => {
  if (c.sentinela) return;
  const r = respostas.length === enviados.length ? fResultadoCrawl(respostas[i]) : { ok: false, motivo: 'coleta_desalinhada' };
  let motivo = null;
  let final = null;
  if (!r.ok) motivo = r.motivo;
  else {
    final = r.url_final;
    const host = fHost(final);
    if (!F_URL_FONTE.test(final)) motivo = 'endereco_final_invalido';
    else if (fExcluido(host)) motivo = 'dominio_excluido';
    else if (host === cliente) motivo = 'site_do_cliente';
    else if (finais.has(final)) motivo = 'repetida';
  }
  if (final && !motivo) finais.add(final);
  registro.push({ id: c.id, origem: c.origem, url_serp: c.url_serp, url_final: final, dominio: fHost(final), titulo_serp: c.titulo, rank: c.rank, situacao: motivo ? 'descartada' : 'coletada', motivo });
  if (!motivo) proximos.push({ ...c, url_final: final, dominio: fHost(final), titulo_pagina: r.titulo, crawl: fCrawl(final) });
});
if (!proximos.length) return [{ json: { sentinela: true, crawl: { urls: [] }, registro } }];
return proximos.map((c) => ({ json: { ...c, registro } }));
