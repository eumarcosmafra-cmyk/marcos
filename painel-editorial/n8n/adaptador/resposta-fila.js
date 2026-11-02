// Nó Code "Formatar resposta da fila" — saída normal do subworkflow 8zHUZGYSA0nPhMWI.
const itens = $input.all();
if (itens.length !== 1) {
  return [{ json: { http_status: 200, resposta: { ok: false, erro: { codigo: 'resposta_inesperada_da_fila', mensagem: 'A fila devolveu ' + itens.length + ' itens.' } } } }];
}
const r = itens[0].json || {};
if (r.ok === false) {
  return [{ json: { http_status: 200, resposta: { ok: false, erro: { codigo: String(r.codigo || 'erro_da_fila'), mensagem: String(r.mensagem || r.codigo || 'A fila recusou a operação.').slice(0, 700) } } } }];
}
return [{ json: { http_status: 200, resposta: { ok: true, resultado: r } } }];
