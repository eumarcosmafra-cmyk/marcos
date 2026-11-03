// Nó Code "Encaminhar pedido ao produtor": entrega ao produtor Kk56hrmdN3ljNUh0
// exatamente os campos que ele aceita (o validador dele recusa qualquer outro).
// A autorização de cobrança só chega aqui se o editor a deu explicitamente no painel.
const p = $input.first().json.pedido;
return [{
  json: {
    cliente_id: p.cliente_id,
    ambiente: p.ambiente,
    job_key: p.job_key,
    revisao_esperada: p.revisao_esperada,
    ator_id: p.ator_id,
    autorizar_cobranca: p.autorizar_cobranca === true,
  },
}];
