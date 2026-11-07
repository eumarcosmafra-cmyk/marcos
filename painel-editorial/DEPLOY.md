# Implantação na VPS — painel editorial MAFRA LABS

O painel roda na mesma VPS do n8n, em um container próprio, e é publicado em **https://editorial.mafraperformancelab.com.br** por um proxy Caddy com certificado Let's Encrypt (`deploy/caddy/`). O container do painel continua escutando só em `127.0.0.1:3100`, o que mantém o acesso por túnel SSH. O n8n não é exposto.

```
Navegador ──túnel SSH──▶ 127.0.0.1:3100 (painel-editorial, Next.js)
                              │  sessão assinada; monta cliente/ator/op_id
                              ▼  rede Docker interna n8n_default
                        http://n8n:5678/webhook/painel-editorial/v1
                        (workflow "Painel editorial - adaptador autenticado (v1)",
                         Header Auth X-Painel-Token, valida operação e escopo)
                              │  Execute Sub-workflow (fixo)          │ leitura sem trava
                              ▼                                       ▼
                        8zHUZGYSA0nPhMWI — Fila, versões      Data Table Z8Fekq9qMO3DRWNA
                        e aprovação editorial                 (confere payload_sha256)
                        (trava, revisão esperada, hash)
                              ▲
                              │ iniciar/concluir etapa
                        Kk56hrmdN3ljNUh0 — Produtor (Pesquisador → Redator → Revisor),
                        executado pelo adaptador depois de responder ao painel ("Retomar produção" / "Solicitar correção")
```

## HTTPS (Caddy)

- **DNS:** registro A `editorial.mafraperformancelab.com.br` → `136.248.117.63`, criado no Plesk (só DNS, sem hospedagem). Não pode haver registro AAAA apontando para outro servidor.
- **Oracle Security List:** entrada TCP 80 (emissão do certificado) e 443.
- **Na VPS:** `~/caddy/` com `docker-compose.yml` e `Caddyfile` de `deploy/caddy/`. O Caddy entra na rede `n8n_default` e repassa só para `painel-editorial:3000`.
- **No painel:** `PAINEL_COOKIE_SECURE=true` no `.env`. Com isso, o login só funciona pelo endereço HTTPS; pelo túnel `http://127.0.0.1:3100` o navegador não guarda a sessão. Os roteiros de validação usam o HTTPS por padrão.
- **Para tirar do ar:** `cd ~/caddy && docker compose down`. O túnel continua funcionando.

## Acesso por túnel (Windows / PowerShell)

1. Abra o túnel (deixe a janela aberta enquanto usa o painel). O mesmo túnel serve o n8n:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\n8n_oracle" -N -L 5678:127.0.0.1:5678 -L 3100:127.0.0.1:3100 ubuntu@136.248.117.63
   ```

2. No navegador: painel em <http://localhost:3100>, n8n em <http://localhost:5678>.

3. Usuário: `marcos`. A senha inicial foi gerada na VPS e **não** circula por chat. Para vê-la uma vez:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\n8n_oracle" ubuntu@136.248.117.63 "cat ~/painel-editorial/segredos/senha-marcos.txt"
   ```

   Para definir a sua própria senha (pedida sem eco):

   ```powershell
   ssh -t -i "$env:USERPROFILE\.ssh\n8n_oracle" ubuntu@136.248.117.63 "cd ~/painel-editorial && ./painelctl.sh definir-senha marcos"
   ```

## Estado da implantação (03/11/2026)

| Item | Valor |
|---|---|
| Painel | container `painel-editorial` no commit `89befee` (o código do painel é igual ao de `4ebcdff`), healthy, `restart: unless-stopped`, `127.0.0.1:3100`, rede `n8n_default` |
| Workflow adaptador | `jDkllWCRNqE3Vwd4`, "Painel editorial - adaptador autenticado (v1)", 19 nós, commit `476d76d`, publicado (versionId `b8de626d-fa47-40a1-bbd6-b2f3d0258efc`), `executionTimeout` 1900 s, projeto `1OqXGCWWyJ96f5xm` |
| Credencial | `lasYxNsNRObc3sg6` — "Painel editorial - token do adaptador" (Header Auth) |
| Produtor `Kk56hrmdN3ljNUh0` | versão `f2b97735…`: só os settings mudaram (guarda execuções com erro e com sucesso, e o progresso), para diagnóstico. Nós intactos. |
| n8n | só em `127.0.0.1:5678`, imagem fixada por digest; 17 workflows ativos |
| Backups | `~/painel-editorial-work/backup/` (bancos com integrity_check e exports anteriores do adaptador e do produtor) |
| Usuários | `marcos` (editor_responsavel, ativo); `leitor_teste` (leitor, **desativado**) |

Resultados da validação: [VALIDACAO.md](./VALIDACAO.md).

## Arquivos na VPS

| Caminho | Conteúdo |
|---|---|
| `~/painel-editorial/docker-compose.yml` | Serviço `painel-editorial` (porta 127.0.0.1:3100, rede `n8n_default`, FS somente leitura, `restart: unless-stopped`, healthcheck da imagem). |
| `~/painel-editorial/.env` (600) | Variáveis do servidor — ver `.env.example`. |
| `~/painel-editorial/segredos/` (700) | Token do adaptador, segredo de sessão e senhas iniciais (600). |
| `~/painel-editorial/src/` | Checkout esparso do repositório (`painel-editorial/`). |
| `~/painel-editorial/painelctl.sh` | Operação: atualizar, reverter, status, definir senha, desativar usuário. |
| `~/painel-editorial/ids.txt` | IDs da credencial e do workflow adaptador no n8n. |

## Atualizar e reverter

```bash
cd ~/painel-editorial && ./painelctl.sh atualizar claude/hopeful-meitner-m9fcqz
```

```bash
cd ~/painel-editorial && ./painelctl.sh reverter
```

```bash
cd ~/painel-editorial && ./painelctl.sh status
```

`atualizar` baixa o código, constrói a imagem `mafra-painel-editorial:<commit>`, guarda a atual como `anterior`, sobe a nova e **reverte sozinho** se o healthcheck não ficar `healthy` em ~60 s.

Remover o painel por completo (não afeta o n8n):

```bash
cd ~/painel-editorial && docker compose down
```

## Adaptador no n8n

- Workflow gerado por `node scripts/montar-adaptador.mjs --credencial-id=<CID> --workflow-id=<WID>` a partir de `n8n/adaptador/*.js` (código dos nós, testado em `tests/adaptador.test.ts`).
- Credencial `Painel editorial - token do adaptador` (Header Auth, cabeçalho `X-Painel-Token`); o mesmo valor está em `N8N_ADAPTADOR_TOKEN` no `.env` do painel.
- Operações aceitas (qualquer outra é recusada):
  - `consultar` (lista), `salvar_edicao`, `decidir`, `preparar_correcao` → subworkflow 8zHUZGYSA0nPhMWI;
  - `retomar_producao` → o adaptador **responde ao painel primeiro** e só então executa o produtor Kk56hrmdN3ljNUh0, aguardando o fim (as etapas levam minutos). O modo "sem aguardar" do n8n não serve aqui: a subexecução nascia vazia e era marcada como sucesso (execução 693, 03/11/2026). Aguardando, uma falha do produtor vira erro do adaptador, que guarda execuções com erro;
  - `executionTimeout` do adaptador: 1900 s. O n8n limita a subexecução ao menor timeout entre ela e quem a chamou, e o produtor precisa de até 1800 s;
  - `ler_trabalho`, `ler_versao`, `ler_resumos` → somente leitura da Data Table, com conferência de `payload_sha256`.
- `preparar_correcao` e `retomar_producao` exigem `autorizar_cobranca: true`, que o painel só envia depois que o editor marca a autorização no diálogo.
- `ler_trabalho` devolve o mesmo recibo de `consultar` (conferido campo a campo com o código da fila), mas **sem ocupar a trava global**. A trava é a mesma que o produtor usa para gravar o resultado de cada agente, e ele não tenta de novo se a encontrar ocupada. Por isso o painel lê e acompanha trabalhos só por `ler_trabalho`.
- Cliente (`altovaletopteam_com_br`) e editores (`marcos_mafra`) permitidos estão fixos no nó "Validar pedido do painel"; o subworkflow ainda confere o cadastro do cliente.
- Para trocar o token: gerar novo valor, atualizar a credencial no n8n e `N8N_ADAPTADOR_TOKEN` no `.env`, depois `docker compose up -d --force-recreate`.
- Publicar ou alterar workflow pelo CLI do n8n só vale após reiniciar o n8n (`docker restart n8n`). Pela interface do n8n, a publicação é imediata.

## Pautas no painel (curadoria de fontes e produção)

Caminho: **Pautas** → pauta → **Buscar fontes** → **Aprovar estas 3 fontes** → **Produzir artigo** → fila.

| Peça | Onde | O que faz |
|---|---|---|
| Planos e pautas | Data Table `I0kHnbGg35Y9RA5Y`, `tipo: plano` (gravados pelo Planejador `5Nv1dKBiFAA7Tn3a`) | Lidos sem trava pelo adaptador (`listar_pautas`), com conferência de hash. |
| Curadoria de fontes | Workflow `MafraFontesPauta` (`n8n/fontes-pauta.workflow.json`, gerado por `scripts/montar-fontes.mjs`) | `propor`: SERP do plano + URLs do editor → Crawl4AI duas vezes (resolve os links `google.com/goto` e confirma o endereço final) → recorte da melhor seção por código, conferido com a mesma função do Pesquisador → 1 chamada ao DeepSeek, que só escolhe 3 entre as páginas coletadas e escreve entidade e limites (se falhar, escolha automática) → grava `tipo: fontes_pauta_proposta`. `aprovar`: grava a proposta como `tipo: fontes_pauta`. |
| Enfileirador | `1Y2tf9mzggbGIpHZ` | Monta o pacote sem IA a partir de plano, fontes aprovadas e acervo, e chama `enfileirar` na fila. `scripts/liberar-producao-enfileirador.mjs` libera o ambiente de produção alterando 4 trechos conferidos; os marcadores do contrato do pacote não mudam. |
| Produção | Painel: `enfileirar_pauta` e depois `retomar_producao` | Pesquisador → Redator → Revisor; a fila acompanha (`?acompanhar=1`). |

Custos mostrados ao editor:
- busca de fontes: 1 chamada ao DeepSeek;
- produção: até 4 chamadas (Pesquisador 1, Redator 1, Revisor 2).

Valores em reais não aparecem, porque a ferramenta não os informa.

Validação no navegador: `scripts/validar-pautas.cjs` (`PRODUZIR=0` para parar depois da aprovação das fontes).

## Correção e retomada (etapas pagas)

- **Solicitar correção** (estado `devolvido`, devolução vigente na versão atual): `preparar_correcao` libera exatamente 3 chamadas novas (Redator 1 + Revisor 2), sem nova pesquisa, e o painel dispara o produtor.
- **Retomar produção** (estados `aguardando_briefing`, `aguardando_redacao` ou `aguardando_revisao` sem reserva): antes de disparar, o painel confere revisão, reserva e limite de chamadas do ciclo (`max_api_ciclo`).
- O diálogo mostra o número máximo de chamadas e o uso já registrado. Valor em reais não aparece porque a fila não o informa.
- Acompanhamento: relê o registro a cada 10 s, sem trava. Uma reserva com mais de 35 min (o limite do produtor é 30 min) é sinalizada como possivelmente órfã. Se o produtor não reservar a etapa em 2 min, o painel avisa e para de acompanhar.
- Registros `teste` com `modo_execucao: simulado` usam respostas preservadas (fixtures), sem IA. Depois de uma correção, o Revisor preservado não confere com o briefing corrigido, e a fila marca `bloqueado_integridade`. Isso é esperado nesse modo.
- Risco que continua: outras operações que pegam a trava (edição, decisão, automações externas) ainda podem coincidir com a gravação de uma etapa. Recomendação para o produtor (fora do painel): tentar de novo `Persistir resultado da etapa N` quando a trava estiver ocupada.

## Usuários

Definidos em `PAINEL_USUARIOS_B64` (JSON em base64 com hashes scrypt). Papéis:

- `editor_responsavel`: lê, edita (cria versão) e decide (aprovar/devolver). Nesta fase, só `marcos` (ator `marcos_mafra`).
- `leitor`: só consulta. O usuário `leitor_teste` foi usado nos testes de recusa e fica desativado após a validação.

## Segurança

- Navegador nunca recebe token do n8n, `service_role` ou payload interno da fila.
- Cookie de sessão httpOnly, `SameSite=Strict`, assinado (HMAC-SHA256), expira em `PAINEL_SESSAO_HORAS`.
- Mutações exigem o cabeçalho `X-Painel-Requisicao` e origem igual ao host.
- CSP restritiva, `X-Frame-Options: DENY`, Markdown sem HTML bruto.
- Desde 02/11/2026 (23:18 UTC) o n8n escuta só em `127.0.0.1:5678` e a imagem está fixada no digest em uso (`docker.n8n.io/n8nio/n8n@sha256:d02752c6…386dfb`). Acesso externo apenas por túnel SSH.
  - Backup do compose anterior: `~/n8n/docker-compose.yml.bak-20261102T231838Z`; banco: `~/painel-editorial-work/backup/n8n-pre-porta-20261102T231838Z.sqlite`.
  - Reverter: `cd ~/n8n && cp -p docker-compose.yml.bak-20261102T231838Z docker-compose.yml && docker compose up -d --pull never n8n`, depois restaurar `~/painel-editorial-work/backup/n8n-files-20261102T231838Z/` em `/home/node/.n8n-files` (`docker cp` + `chown -R node:node`).
  - Atenção: `/home/node/.n8n-files` não está em volume e se perde a cada recriação do container do n8n.
  - Recomendado: remover a regra da porta 5678 na Security List da Oracle.
