// Nó Code "Encaminhar pedido de fontes": pedido da curadoria (MafraFontesPauta) no modo propor.
const p = $input.first().json.pedido;
return [{ json: { modo: 'propor', cliente_id: p.cliente_id, plano_cache_key: p.plano_cache_key, pauta_id: p.pauta_id, ator_id: p.ator_id, autorizar_cobranca: true, urls_extras: Array.isArray(p.urls_extras) ? p.urls_extras : [] } }];
