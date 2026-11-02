# Implantação na VPS — painel editorial MAFRA LABS

O painel roda na mesma VPS do n8n, em um container próprio. Não há domínio nem HTTPS configurados na VPS; por isso o painel **não** abre porta pública: escuta só em `127.0.0.1:3100` e é acessado por túnel SSH.

```
Navegador ──túnel SSH──▶ 127.0.0.1:3100 (painel-editorial, Next.js)
                              │  sessão assinada; monta cliente/ator/op_id
                              ▼  rede Docker interna n8n_default
                        http://n8n:5678/webhook/painel-editorial/v1
                        (workflow "Painel editorial - adaptador autenticado (v1)",
                         Header Auth X-Painel-Token, valida operação e escopo)
                              │  Execute Sub-workflow (fixo)
                              ▼
                        8zHUZGYSA0nPhMWI — Fila, versões e aprovação editorial
                        (Data Table Z8Fekq9qMO3DRWNA, trava, revisão esperada, hash)
```

## Acesso (Windows / PowerShell)

1. Abra o túnel (deixe a janela aberta enquanto usa o painel):

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\n8n_oracle" -N -L 3100:127.0.0.1:3100 ubuntu@136.248.117.63
   ```

2. No navegador: <http://localhost:3100>

3. Usuário: `marcos`. A senha inicial foi gerada na VPS e **não** circula por chat. Para vê-la uma vez:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\n8n_oracle" ubuntu@136.248.117.63 "cat ~/painel-editorial/segredos/senha-marcos.txt"
   ```

   Para definir a sua própria senha (pedida sem eco):

   ```powershell
   ssh -t -i "$env:USERPROFILE\.ssh\n8n_oracle" ubuntu@136.248.117.63 "cd ~/painel-editorial && ./painelctl.sh definir-senha marcos"
   ```

## Estado da implantação (02/11/2026)

| Item | Valor |
|---|---|
| Commit implantado | `0bc50f187a7e02616d8cf27c319756c1c3106f01` (imagem `mafra-painel-editorial:0bc50f187a7e`) |
| Container | `painel-editorial`, healthy, `restart: unless-stopped`, `127.0.0.1:3100`, rede `n8n_default` |
| Workflow adaptador | `jDkllWCRNqE3Vwd4` — "Painel editorial - adaptador autenticado (v1)", publicado (versionId `4211196c-e8bd-407d-97ff-3258639c0e60`), projeto `1OqXGCWWyJ96f5xm` |
| Credencial | `lasYxNsNRObc3sg6` — "Painel editorial - token do adaptador" (Header Auth) |
| n8n | reiniciado uma vez (~5 s) para registrar o webhook; workflows ativos 16 → 17 |
| Backup do n8n antes da mudança | `~/painel-editorial-work/backup/n8n-20261102T152856Z.sqlite` (integrity_check ok) |
| Usuários | `marcos` (editor_responsavel, ativo); `leitor_teste` (leitor, **desativado** após os testes) |

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
- Operações aceitas: `consultar`, `salvar_edicao`, `decidir` (repassadas ao subworkflow 8zHUZGYSA0nPhMWI) e as leituras `ler_resumos` e `ler_versao` (somente leitura da Data Table, com conferência de `payload_sha256`). Qualquer outra é recusada.
- Cliente (`altovaletopteam_com_br`) e editores (`marcos_mafra`) permitidos estão fixos no nó "Validar pedido do painel"; o subworkflow ainda confere o cadastro do cliente.
- Para trocar o token: gerar novo valor, atualizar a credencial no n8n e `N8N_ADAPTADOR_TOKEN` no `.env`, depois `docker compose up -d --force-recreate`.
- Publicar ou alterar workflow pelo CLI do n8n só vale após reiniciar o n8n (`docker restart n8n`). Pela interface do n8n, a publicação é imediata.

## Usuários

Definidos em `PAINEL_USUARIOS_B64` (JSON em base64 com hashes scrypt). Papéis:

- `editor_responsavel`: lê, edita (cria versão) e decide (aprovar/devolver). Nesta fase, só `marcos` (ator `marcos_mafra`).
- `leitor`: só consulta. O usuário `leitor_teste` foi usado nos testes de recusa e fica desativado após a validação.

## Segurança

- Navegador nunca recebe token do n8n, `service_role` ou payload interno da fila.
- Cookie de sessão httpOnly, `SameSite=Strict`, assinado (HMAC-SHA256), expira em `PAINEL_SESSAO_HORAS`.
- Mutações exigem o cabeçalho `X-Painel-Requisicao` e origem igual ao host.
- CSP restritiva, `X-Frame-Options: DENY`, Markdown sem HTML bruto.
- Pendência conhecida, fora do escopo do painel: a porta 5678 do n8n está publicada em todas as interfaces, sem TLS. O adaptador exige token, mas o editor do n8n continua exposto se a Security List da Oracle liberar a porta.
