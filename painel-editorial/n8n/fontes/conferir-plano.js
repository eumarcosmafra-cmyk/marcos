// Nó "Conferir plano": confere a integridade do plano gravado pelo Planejador e localiza a pauta.
try {
  const req = $('Validar pedido').first().json.request;
  const rows = $input.all().map((i) => i.json).filter((r) => r && r.id);
  const plano = fLerLinha(rows, req.plano_cache_key, 'plano', req.cliente_id, 'plano_nao_encontrado');
  fEnsure(typeof plano.plano_original_json === 'string' && sha256(plano.plano_original_json) === plano.plano_sha256, 'plano_alterado');
  const achadas = (plano.pautas || []).filter((x) => x && x.id === req.pauta_id);
  fEnsure(achadas.length === 1, 'pauta_nao_encontrada');
  const pauta = achadas[0];
  const pautaSha = fHash(pauta);
  fEnsure(plano.pautas_sha256 && plano.pautas_sha256[pauta.id] === pautaSha, 'plano_alterado');
  fEnsure(pauta.acao !== 'adiar' && pauta.status !== 'adiada', 'pauta_adiada');
  return [{
    json: {
      ok: true,
      modo: req.modo,
      plano: { cache_key: req.plano_cache_key, site_url: plano.site_url, site_snapshot: plano.site_snapshot || '', plano_sha256: plano.plano_sha256 },
      pauta,
      pauta_sha256: pautaSha,
      fontes_cache_key: 'fontes:' + req.cliente_id + ':' + pauta.id + ':' + pautaSha,
    },
  }];
} catch (e) {
  return [{ json: fRecusa(e, 'plano_invalido') }];
}
