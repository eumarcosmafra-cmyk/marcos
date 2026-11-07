// Nó "Entregar recusa".
const r = $input.first().json || {};
return [{ json: { ok: false, codigo: String(r.codigo || 'recusado'), mensagem: String(r.mensagem || r.codigo || 'recusado') } }];
