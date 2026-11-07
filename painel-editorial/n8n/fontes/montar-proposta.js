// Nó "Montar proposta": grava a proposta (tipo fontes_pauta_proposta). O Enfileirador só
// lê "fontes_pauta", gravado quando o editor aprova no painel.
const base = $('Conferir plano').first().json;
const req = $('Validar pedido').first().json.request;
const d = $input.first().json;
const agora = new Date();
const registro = (d.registro || []).map((x) => ({ ...x }));
const validos = d.validos || [];
let status = d.status === 'escolher' ? 'escolher' : 'insuficiente';
const selecao = { metodo: null, modelo: null, observacao: null, chamadas_ia: 0 };
let fontes = null;
let previas = [];
if (status === 'escolher') {
  let escolha = null;
  if (d.resposta_modelo) {
    selecao.chamadas_ia = 1;
    selecao.modelo = 'deepseek-v4-pro';
    escolha = fEscolhaModelo(d.resposta_modelo, validos);
    if (escolha) {
      selecao.metodo = 'modelo';
      selecao.observacao = escolha.observacao;
    }
  }
  if (!escolha) {
    escolha = { escolhidas: fEscolhaAutomatica(validos) };
    selecao.metodo = 'automatica';
  }
  if (escolha.escolhidas.length === 3) {
    const documentos = fDocumentos(escolha.escolhidas, validos, fAssunto(base.pauta), fDataBR(agora));
    fontes = { assunto: fAssunto(base.pauta), keyword: base.pauta.keyword, pauta_sha256: base.pauta_sha256, documentos };
    previas = documentos.map((doc) => {
      const c = validos.find((x) => x.url_final === doc.url);
      const r = registro.find((x) => x.id === c.id);
      if (r) Object.assign(r, { situacao: 'escolhida', motivo: null, fonte: doc.id });
      return { id: doc.id, url: doc.url, dominio: fHost(doc.url), titulo: doc.titulo, entidade: doc.entidade, localizador: doc.localizador, limites: doc.limites, trecho: c.trecho.slice(0, 1500), caracteres: c.trecho.length };
    });
    status = 'pronta';
  } else status = 'insuficiente';
}
const payload = {
  versao: 'proposta_fontes_v1',
  status,
  motivo: status === 'pronta' ? null : d.motivo || 'menos_de_tres_fontes_aptas',
  cliente_id: req.cliente_id,
  plano_cache_key: req.plano_cache_key,
  pauta_id: req.pauta_id,
  pauta_sha256: base.pauta_sha256,
  fontes_cache_key: base.fontes_cache_key,
  fontes,
  previas,
  candidatos: registro,
  selecao,
  urls_extras: req.urls_extras,
  gerado_em: agora.toISOString(),
  ator_id: req.ator_id,
};
const texto = JSON.stringify(payload);
return [{
  json: {
    tipo: 'fontes_pauta_proposta',
    cache_key: base.fontes_cache_key,
    cliente_id: req.cliente_id,
    site_url: base.plano.site_url,
    site_snapshot: base.plano.site_snapshot,
    payload_json: texto,
    payload_sha256: sha256(texto),
    consultado_em: agora.toISOString(),
    atualizado_em: agora.toISOString(),
  },
}];
