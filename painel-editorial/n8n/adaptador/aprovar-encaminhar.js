// Nó Code "Encaminhar aprovação de fontes": grava a proposta conferida como fontes_pauta.
const p = $input.first().json.pedido;
return [{ json: { modo: 'aprovar', cliente_id: p.cliente_id, plano_cache_key: p.plano_cache_key, pauta_id: p.pauta_id, ator_id: p.ator_id } }];
