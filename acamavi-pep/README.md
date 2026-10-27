# ACAMAVI – Declaração PEP (coleta temporária)

Formulário público que gera a "Declaração sobre condição de Pessoa Politicamente Exposta – Pessoa Física"
preenchida (sem logos de terceiros, cabeçalho ACAMAVI, sem o item "deve ser apresentado na forma impressa").
A pessoa baixa o PDF, imprime e assina à mão. Os dados ficam salvos para download em lote no painel.

Projeto independente do SEO Analyst: não usa nada de `src/` e fica fora do typecheck da raiz.

## Rotas

- `/` – formulário
- `/declaracao/[id]?t=...` – link pessoal para baixar o PDF de novo (usado pelo aviso "Baixar de novo")
- `/admin` – painel (senha) com lista, ZIP de tudo (PDFs preenchidos + `dados.csv`) e exclusão

## Infra (Vercel)

- Projeto Next.js com Root Directory `acamavi-pep`, região de funções `gru1` (`vercel.json`)
- Blob store **privado** (`access: private`) conectado ao projeto → cria `BLOB_READ_WRITE_TOKEN`.
  Se o store for público, a gravação falha (o código grava sempre como privado).
- Variáveis de ambiente:
  - `ADMIN_PASSWORD` – senha do `/admin`
  - `SESSION_SECRET` – string aleatória longa (assina o cookie do admin)

Teste local sem Vercel: `LOCAL_STORAGE_DIR=./.data ADMIN_PASSWORD=x SESSION_SECRET=y npm run dev`.

## Encerrar a coleta

1. `/admin` → **Baixar tudo (.zip)**
2. Apagar o Blob store e o projeto na Vercel
3. Remover esta pasta do repositório
