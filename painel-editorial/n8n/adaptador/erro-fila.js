// Nó Code "Formatar falha da fila" — saída de erro do subworkflow (exceção não tratada).
const e = ($input.first() && $input.first().json) || {};
const bruto = e.error && typeof e.error === 'object' ? e.error.message || e.error.description : e.error || e.message;
const mensagem = String(bruto || 'O subworkflow da fila falhou.').slice(0, 700);
const codigo = /^[a-z_]{3,60}$/.test(mensagem) ? mensagem : 'falha_do_subworkflow';
return [{ json: { http_status: 200, resposta: { ok: false, erro: { codigo, mensagem } } } }];
