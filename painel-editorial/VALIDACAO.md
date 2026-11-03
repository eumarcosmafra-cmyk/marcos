# Validação do painel real — 02/11/2026

Executada na VPS contra o n8n de produção, com navegador real (Playwright 1.63 em container, `scripts/validar-painel-real.cjs`). Mutações somente em registros do ambiente **teste**; o P004 (produção) foi só lido.

## Resultado

| Fase | Resultado |
|---|---|
| Principal (painel em produção, 127.0.0.1:3100) | 33 PASS, 0 FAIL |
| Falha de conexão (painel temporário sem rede do n8n, 127.0.0.1:3101) | 2 PASS |
| Recuperação (painel em produção) | 1 PASS |

### Verificações

- Sem sessão, `/fila` redireciona ao login; senha errada recusada (`LOGIN_RECUSADO`); login de Marcos.
- Fila de produção lista o **P004** lido do n8n (wai kru significado, Pendente de ajustes, v1 · rev. 2, 3 pendências).
- Página do P004: versão do artigo v1, revisão do registro 2; **Aprovação editorial: Pendente**, **Revisão do professor: Não realizada**, **Publicação: Não autorizada**.
- Markdown renderizado (12 negritos, 5 links, 6 itens de lista, 1 tabela); nenhum script do conteúdo executado.
- Três pendências do Revisor exibidas por completo.
- Diálogo de aprovação em produção: botão bloqueado até avaliar cada pendência e escrever justificativa; justificativa começa vazia. **Nada enviado.**
- Recarregar mantém o P004 carregado do n8n; rascunho local não salvo sobrevive ao recarregar.
- Filtro Produção/Teste sem mistura.
- Teste A: edição criou nova versão e revisão; comparação entre versões; versão antiga recusada (409 `VERSAO_DESATUALIZADA` / fila `conflito_de_versao`); devolução com motivo registrada (simulação).
- Teste B: aprovação sem avaliar pendências recusada pela fila (422 `PENDENCIAS_SEM_AVALIACAO` / `pendencias_exigem_decisao_explicita`); aprovação com avaliação explícita registrada como `aprovacao_simulada` (não vira aprovação editorial real).
- Usuário não autorizado (`leitor_teste`): vê o trabalho sem ações; decisão recusada (403 `NAO_AUTORIZADO`); corpo com `ator_id` forjado recusado.
- Adaptador direto: sem token 403; `enfileirar` recusado (`operacao_nao_permitida`); `decidir` com ator não autorizado recusado (`editor_nao_autorizado`).
- Celular (390 px) sem rolagem horizontal; nenhum erro de JavaScript.
- Falha de conexão: erro identificável “Não foi possível conectar ao n8n · `N8N_INDISPONIVEL` · HTTP 502” com botão **Tentar novamente**, sem dados simulados; com o n8n acessível, a fila volta a carregar.

## Integridade

- **P004 idêntico antes e depois** (mesmo sha256 do registro inteiro; revisão 2, v1, `artigo_sha256` 78306d9d…7b39e73, sem decisão).
- Registros de teste alterados pelo roteiro (marcados como simulação, ator `marcos_mafra`):
  - `459247277a8c…`: aguardando_redacao → devolvido, revisão 11 → 13, v3 → v4.
  - `b2f8b6177dfb…`: aguardando_redacao → aprovacao_simulada, revisão 11 → 13, v3 → v4.
- `leitor_teste` desativado ao final (login passa a 401); login de Marcos segue 200.

## Também verificado

- `npm run typecheck`, `npm run lint`, `npm test` (42 testes), `npm run build`.
- Mesmo roteiro, localmente, contra um adaptador simulado que executa o código real dos nós da fila V2 (34/34 + fases de erro).

# Validação de "Solicitar correção / Retomar produção" — 03/11/2026

Executada na VPS contra o n8n de produção. Mutações só no registro **teste** com execução simulada `459247277a8c…` (respostas preservadas, sem IA nem cobrança). P004 e o outro registro de teste ficaram idênticos (conferido por `payload_sha256` antes e depois).

| Etapa | O que mostrou |
|---|---|
| 5 | `preparar_correcao` registrou `correcao_autorizada` (revisão 13 → 14) e o adaptador confirmou o disparo. Mas o produtor não reservou a etapa, e a tela não mostrou a espera (condição de corrida, corrigida em `4ebcdff`). |
| 5-D (leitura) | Disparo confirmado; trava livre; ensaio a seco do código publicado reservaria o Redator. O produtor nunca pediu a trava. |
| 5-E | Com o produtor guardando execuções: a subexecução disparada com `waitForSubWorkflow:false` nascia **vazia** (execução 693, nenhum nó, "sucesso" em 13 ms). |
| 5-F | Adaptador `476d76d`: responde ao painel e executa o produtor aguardando. **7/7 PASS**. Execução 906 do produtor: reservou o Redator (revisão 15, simulado), usou a resposta preservada e gravou o resultado (revisão 16). A trava foi de 184 a 190 e ficou livre. A tela acompanhou até o fim. |

Resultado final no registro de teste: `bloqueado_integridade` já na etapa do Redator ("Cadeia editorial V2: rascunho de outro briefing"). A resposta preservada do Redator não corresponde ao briefing corrigido, e a fila recusa de propósito. Isso é esperado no modo simulado; com agente real, o Redator recebe o briefing corrigido.

**Ainda não validado:** uma correção com agentes reais (chamadas pagas). A primeira correção real em produção será esse teste; com o produtor guardando execuções, uma eventual falha fica registrada.

**Observação:** depois dos testes, o banco do n8n listou execuções do adaptador, da fila e da trava como `running`. O trabalho delas terminou: trava livre, registros gravados. Elas pertencem a workflows que não guardam sucesso. Antes de usar "zero execuções em andamento" como condição para reiniciar o n8n, conferir se essas linhas já têm `deletedAt` preenchido ou `stoppedAt` definido.
