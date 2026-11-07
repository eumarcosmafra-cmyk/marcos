// Nó "Conferir proposta" (modo aprovar): só uma proposta "pronta", da mesma versão da pauta, vira fontes_pauta.
try {
  const base = $('Conferir plano').first().json;
  const req = $('Validar pedido').first().json.request;
  const rows = $input.all().map((i) => i.json).filter((r) => r && r.id);
  const prop = fLerLinha(rows, base.fontes_cache_key, 'fontes_pauta_proposta', req.cliente_id, 'proposta_nao_encontrada');
  fEnsure(prop.status === 'pronta' && prop.fontes, 'proposta_sem_tres_fontes');
  fEnsure(prop.pauta_sha256 === base.pauta_sha256 && prop.fontes.pauta_sha256 === base.pauta_sha256 && prop.fontes.keyword === base.pauta.keyword, 'proposta_de_outra_versao_da_pauta');
  fEnsure(Array.isArray(prop.fontes.documentos) && prop.fontes.documentos.length === 3, 'proposta_sem_tres_fontes');
  const agora = new Date().toISOString();
  const texto = JSON.stringify(prop.fontes);
  return [{
    json: {
      ok: true,
      tipo: 'fontes_pauta',
      cache_key: base.fontes_cache_key,
      cliente_id: req.cliente_id,
      site_url: base.plano.site_url,
      site_snapshot: base.plano.site_snapshot,
      payload_json: texto,
      payload_sha256: sha256(texto),
      consultado_em: agora,
      atualizado_em: agora,
    },
  }];
} catch (e) {
  return [{ json: fRecusa(e, 'proposta_invalida') }];
}
