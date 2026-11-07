// Nó "Entregar aprovação".
const base = $('Conferir plano').first().json;
return [{ json: { ok: true, modo: 'aprovar', fontes_cache_key: base.fontes_cache_key, status: 'aprovada' } }];
