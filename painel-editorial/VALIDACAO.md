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
