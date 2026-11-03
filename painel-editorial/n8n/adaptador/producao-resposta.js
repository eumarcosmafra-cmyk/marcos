// Nó Code "Formatar início da produção": o produtor foi disparado sem aguardar
// (as etapas de agente podem levar minutos). Isto confirma só o disparo; o
// resultado de cada etapa fica no registro da fila e é lido por `ler_trabalho`.
const p = $('Encaminhar pedido ao produtor').first().json;
return [{ json: { http_status: 200, resposta: { ok: true, resultado: { producao_iniciada: true, job_key: p.job_key, revisao_esperada: p.revisao_esperada } } } }];
