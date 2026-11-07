// Nó Code "Validar pedido do painel" (modo: executar uma vez para todos os itens).
// Recebe o corpo do Webhook { operacao, entrada } já autenticado por cabeçalho e
// decide a rota. Só passam as operações e os campos que o painel precisa.
// Cliente, editor e workflow de destino são fixos aqui: o chamador não escolhe.
// Rotas: 'recusa' | 'leitura' (lista de resumos) | 'leitura_trabalho' (um trabalho,
// sem trava) | 'fila' (subworkflow 8zHU) | 'producao' (produtor Kk56, sem aguardar).
const CLIENTES_PERMITIDOS = ['altovaletopteam_com_br'];
const EDITORES_PERMITIDOS = ['marcos_mafra'];
const AMBIENTES = ['producao', 'teste'];
const CAMPOS = {
  consultar: ['cliente_id', 'ambiente', 'job_key', 'cursor'],
  salvar_edicao: ['cliente_id', 'ambiente', 'job_key', 'op_id', 'revisao_esperada', 'artigo_sha256', 'markdown', 'ator_id'],
  decidir: ['cliente_id', 'ambiente', 'job_key', 'op_id', 'revisao_esperada', 'artigo_sha256', 'decisao', 'motivos', 'confirmo_revisao_editorial', 'pendencias_sha256', 'justificativa_pendencias', 'ator_id'],
  preparar_correcao: ['cliente_id', 'ambiente', 'job_key', 'op_id', 'revisao_esperada', 'artigo_sha256', 'autorizar_cobranca', 'ator_id'],
  retomar_producao: ['cliente_id', 'ambiente', 'job_key', 'revisao_esperada', 'autorizar_cobranca', 'ator_id'],
  ler_trabalho: ['cliente_id', 'ambiente', 'job_key'],
  ler_versao: ['cliente_id', 'ambiente', 'job_key', 'numero'],
  ler_resumos: ['cliente_id', 'ambiente'],
};
const OBRIGATORIOS = {
  consultar: ['cliente_id', 'ambiente'],
  salvar_edicao: ['cliente_id', 'ambiente', 'job_key', 'op_id', 'revisao_esperada', 'artigo_sha256', 'markdown', 'ator_id'],
  decidir: ['cliente_id', 'ambiente', 'job_key', 'op_id', 'revisao_esperada', 'artigo_sha256', 'decisao', 'confirmo_revisao_editorial', 'ator_id'],
  preparar_correcao: ['cliente_id', 'ambiente', 'job_key', 'op_id', 'revisao_esperada', 'artigo_sha256', 'autorizar_cobranca', 'ator_id'],
  retomar_producao: ['cliente_id', 'ambiente', 'job_key', 'revisao_esperada', 'autorizar_cobranca', 'ator_id'],
  ler_trabalho: ['cliente_id', 'ambiente', 'job_key'],
  ler_versao: ['cliente_id', 'ambiente', 'job_key', 'numero'],
  ler_resumos: ['cliente_id', 'ambiente'],
};
const MUTACOES = ['salvar_edicao', 'decidir', 'preparar_correcao'];
const ROTA = { ler_resumos: 'leitura', ler_trabalho: 'leitura_trabalho', ler_versao: 'leitura_trabalho', retomar_producao: 'producao' };

function recusa(codigo, mensagem) {
  return [{ json: { rota: 'recusa', http_status: 400, resposta: { ok: false, erro: { codigo, mensagem } } } }];
}
const hex64 = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const inteiroPositivo = (v) => Number.isSafeInteger(v) && v >= 1;

const itens = $input.all();
if (itens.length !== 1) return recusa('pedido_multiplo', 'Envie um pedido por chamada.');
const corpo = itens[0].json.body;
if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return recusa('corpo_invalido', 'Corpo ausente ou inválido.');
const extras = Object.keys(corpo).filter((k) => !['operacao', 'entrada'].includes(k));
if (extras.length) return recusa('campo_nao_permitido', 'Campos fora do envelope: ' + extras.join(', '));
const operacao = corpo.operacao;
if (!Object.prototype.hasOwnProperty.call(CAMPOS, operacao)) return recusa('operacao_nao_permitida', 'Operação não liberada para o painel.');
const e = corpo.entrada;
if (!e || typeof e !== 'object' || Array.isArray(e)) return recusa('entrada_invalida', 'Entrada ausente.');
const naoPermitidos = Object.keys(e).filter((k) => !CAMPOS[operacao].includes(k));
if (naoPermitidos.length) return recusa('campo_nao_permitido', 'Campos não permitidos: ' + naoPermitidos.join(', '));
const faltando = OBRIGATORIOS[operacao].filter((k) => e[k] === undefined || e[k] === null || e[k] === '');
if (faltando.length) return recusa('campo_obrigatorio', 'Campos obrigatórios ausentes: ' + faltando.join(', '));

if (!CLIENTES_PERMITIDOS.includes(e.cliente_id)) return recusa('cliente_nao_permitido', 'Cliente fora do escopo do painel.');
if (!AMBIENTES.includes(e.ambiente)) return recusa('ambiente_invalido', 'Ambiente inválido.');
if (e.job_key !== undefined && !hex64(e.job_key)) return recusa('chave_invalida', 'job_key inválida.');
if (e.cursor !== undefined && !(Number.isSafeInteger(e.cursor) && e.cursor >= 0)) return recusa('cursor_invalido', 'Cursor inválido.');
if (e.numero !== undefined && !inteiroPositivo(e.numero)) return recusa('versao_invalida', 'Número de versão inválido.');

if (MUTACOES.includes(operacao)) {
  if (!EDITORES_PERMITIDOS.includes(e.ator_id)) return recusa('editor_nao_autorizado', 'Ator não autorizado a editar ou decidir.');
  if (typeof e.op_id !== 'string' || !/^painel:[a-z0-9_]+:[A-Za-z0-9-]{8,80}$/.test(e.op_id) || !e.op_id.startsWith('painel:' + e.ator_id + ':')) {
    return recusa('op_id_invalido', 'op_id fora do formato do painel.');
  }
  if (!inteiroPositivo(e.revisao_esperada)) return recusa('revisao_invalida', 'revisao_esperada inválida.');
  if (!hex64(e.artigo_sha256)) return recusa('hash_invalido', 'artigo_sha256 inválido.');
}
if (operacao === 'preparar_correcao' || operacao === 'retomar_producao') {
  // Etapas de agente podem gerar cobrança: só seguem com autorização explícita do editor.
  if (e.autorizar_cobranca !== true) return recusa('cobranca_nao_autorizada', 'Autorização explícita de chamadas pagas ausente.');
}
if (operacao === 'retomar_producao') {
  if (!EDITORES_PERMITIDOS.includes(e.ator_id)) return recusa('editor_nao_autorizado', 'Ator não autorizado a iniciar etapas.');
  if (!inteiroPositivo(e.revisao_esperada)) return recusa('revisao_invalida', 'revisao_esperada inválida.');
}
if (operacao === 'salvar_edicao') {
  if (typeof e.markdown !== 'string' || e.markdown.length < 200 || e.markdown.length > 800000) return recusa('markdown_invalido', 'O artigo precisa ter entre 200 e 800000 caracteres.');
}
if (operacao === 'decidir') {
  if (!['aprovar', 'devolver'].includes(e.decisao)) return recusa('decisao_invalida', 'Decisão deve ser aprovar ou devolver.');
  if (e.confirmo_revisao_editorial !== true) return recusa('confirmacao_ausente', 'Confirmação de revisão editorial ausente.');
  if (e.motivos !== undefined && !(Array.isArray(e.motivos) && e.motivos.length <= 20 && e.motivos.every((t) => typeof t === 'string' && t.trim().length >= 5 && t.length <= 3000))) {
    return recusa('motivos_invalidos', 'Motivos inválidos.');
  }
  if (e.decisao === 'devolver' && !(Array.isArray(e.motivos) && e.motivos.length > 0)) return recusa('devolucao_sem_motivos', 'Devolução exige ao menos um motivo.');
  if (e.pendencias_sha256 !== undefined && !hex64(e.pendencias_sha256)) return recusa('hash_invalido', 'pendencias_sha256 inválido.');
  if (e.justificativa_pendencias !== undefined && !(typeof e.justificativa_pendencias === 'string' && e.justificativa_pendencias.length <= 3000)) {
    return recusa('justificativa_invalida', 'Justificativa inválida.');
  }
}

const pedido = { operacao };
for (const k of CAMPOS[operacao]) if (e[k] !== undefined) pedido[k] = e[k];
return [{ json: { rota: ROTA[operacao] || 'fila', operacao, pedido } }];
