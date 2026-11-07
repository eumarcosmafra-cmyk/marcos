// Nó "Recortar e preparar escolha": confere o endereço estável, escolhe a melhor seção de cada
// página (por código) e prepara a escolha das 3 fontes pelo modelo.
const base = $('Conferir plano').first().json;
const enviados = $('Resolver destinos').all().map((i) => i.json);
const respostas = $input.all().map((i) => i.json);
const registro = (enviados[0] && enviados[0].registro ? enviados[0].registro : []).map((x) => ({ ...x }));
const marcar = (id, situacao, motivo) => {
  const r = registro.find((x) => x.id === id);
  if (r) Object.assign(r, { situacao, motivo });
};
const termos = fTermos(base.pauta);
const aptos = [];
enviados.forEach((c, i) => {
  if (c.sentinela) return;
  const r = respostas.length === enviados.length ? fResultadoCrawl(respostas[i]) : { ok: false, motivo: 'coleta_desalinhada' };
  if (!r.ok) return marcar(c.id, 'descartada', r.motivo);
  if (r.url_final !== c.url_final) return marcar(c.id, 'descartada', 'endereco_instavel');
  if (fPaginaDeLoja(r.markdown)) return marcar(c.id, 'descartada', 'pagina_de_loja');
  // Marcadores conferidos nas duas coletas: a página muda entre acessos e o Pesquisador coleta de novo.
  const secao = fMelhorSecao(r.markdown, termos, typeof c.markdown_1 === 'string' ? c.markdown_1 : undefined);
  if (!secao) return marcar(c.id, 'descartada', 'sem_trecho_util');
  marcar(c.id, 'apta', null);
  aptos.push({ id: c.id, url_final: c.url_final, dominio: c.dominio, titulo: r.titulo || c.titulo_pagina || c.titulo, website_name: c.website_name, ...secao });
});
// Uma página por domínio: fica a de maior pontuação.
const porDominio = new Map();
for (const a of aptos) if (!porDominio.has(a.dominio) || porDominio.get(a.dominio).pontuacao < a.pontuacao) porDominio.set(a.dominio, a);
const validos = [...porDominio.values()].sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 6);
for (const a of aptos) if (!validos.includes(a)) marcar(a.id, 'reserva', 'mesmo_dominio_ou_excedente');
if (validos.length < 3) return [{ json: { status: 'insuficiente', motivo: 'menos_de_tres_fontes_aptas', usar_modelo: false, validos, registro } }];
return [{ json: { status: 'escolher', usar_modelo: true, validos, registro, body: fCorpoModelo(base.pauta, validos) } }];
