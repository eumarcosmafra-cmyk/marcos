// Nó Code "Encaminhar ao enfileirador": exatamente os campos que o 1Y2tf9mzggbGIpHZ aceita.
// confirmo_pauta: true, porque a pauta só chega aqui depois de o editor aprovar as fontes e autorizar a produção.
const p = $input.first().json.pedido;
return [{ json: { cliente_id: p.cliente_id, ambiente: p.ambiente, plano_cache_key: p.plano_cache_key, pauta_id: p.pauta_id, ator_id: p.ator_id, op_id: p.op_id, confirmo_pauta: true } }];
