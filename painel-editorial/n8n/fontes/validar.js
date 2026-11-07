// Nó "Validar pedido". modo "propor": coleta candidatos, recorta e escolhe 3 fontes (proposta);
// modo "aprovar": grava a proposta conferida como "fontes_pauta", que o Enfileirador lê.
const CAMPOS = {
  propor: ['modo', 'cliente_id', 'plano_cache_key', 'pauta_id', 'ator_id', 'autorizar_cobranca', 'urls_extras'],
  aprovar: ['modo', 'cliente_id', 'plano_cache_key', 'pauta_id', 'ator_id'],
};
try {
  const all = $input.all();
  fEnsure(all.length === 1, 'um_pedido_por_vez');
  const p = all[0].json;
  fEnsure(p && typeof p === 'object' && Object.prototype.hasOwnProperty.call(CAMPOS, p.modo), 'modo_invalido');
  fEnsure(Object.keys(p).every((k) => CAMPOS[p.modo].includes(k)), 'campo_nao_permitido');
  fEnsure(/^[a-zA-Z0-9_-]{2,100}$/u.test(p.cliente_id), 'cliente_invalido');
  fEnsure(typeof p.plano_cache_key === 'string' && p.plano_cache_key.startsWith('plano:' + p.cliente_id + ':') && p.plano_cache_key.length <= 250, 'plano_de_outro_cliente');
  fEnsure(/^P\d{3,6}$/u.test(p.pauta_id), 'pauta_invalida');
  fEnsure(typeof p.ator_id === 'string' && /^[a-z0-9_]{2,60}$/u.test(p.ator_id), 'ator_invalido');
  const extras = p.urls_extras === undefined ? [] : p.urls_extras;
  if (p.modo === 'propor') {
    fEnsure(p.autorizar_cobranca === true, 'cobranca_nao_autorizada');
    fEnsure(Array.isArray(extras) && extras.length <= 5 && extras.every((u) => typeof u === 'string' && u.length <= 500 && F_URL_FONTE.test(u)), 'urls_extras_invalidas');
  }
  return [{ json: { ok: true, request: { ...p, urls_extras: extras } } }];
} catch (e) {
  return [{ json: fRecusa(e, 'pedido_invalido') }];
}
