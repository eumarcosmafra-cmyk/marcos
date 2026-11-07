// Nó "Entregar proposta": recibo curto (o painel lê a proposta completa pela leitura de pautas).
const base = $('Conferir plano').first().json;
const p = JSON.parse($('Montar proposta').first().json.payload_json);
return [{ json: { ok: true, modo: 'propor', fontes_cache_key: base.fontes_cache_key, status: p.status, motivo: p.motivo, chamadas_ia: p.selecao.chamadas_ia } }];
