#!/usr/bin/env bash
# Operação do painel editorial na VPS.
#   ./painelctl.sh atualizar [ref]     baixa o código (branch/tag/commit), gera a imagem e sobe; reverte sozinho se o healthcheck falhar
#   ./painelctl.sh reverter            volta para a imagem anterior
#   ./painelctl.sh status              estado do container e healthcheck
#   ./painelctl.sh definir-senha USR   define a senha de um usuário (pede sem eco) e reinicia
#   ./painelctl.sh desativar USR       desativa um usuário e reinicia
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/src"
REPO="https://github.com/eumarcosmafra-cmyk/marcos.git"
IMG="mafra-painel-editorial"
cd "$DIR"

saude() {
  for _ in $(seq 1 30); do
    st="$(docker inspect -f '{{.State.Health.Status}}' painel-editorial 2>/dev/null || echo ausente)"
    [ "$st" = "healthy" ] && return 0
    sleep 2
  done
  return 1
}

case "${1:-}" in
  atualizar)
    REF="${2:-claude/hopeful-meitner-m9fcqz}"
    if [ ! -d "$SRC/.git" ]; then
      git clone --filter=blob:none --no-checkout "$REPO" "$SRC"
      git -C "$SRC" sparse-checkout set painel-editorial
    fi
    git -C "$SRC" fetch --depth 50 origin "$REF"
    git -C "$SRC" checkout -q --detach FETCH_HEAD
    COMMIT="$(git -C "$SRC" rev-parse --short=12 HEAD)"
    echo "Construindo $IMG:$COMMIT"
    docker build --build-arg GIT_COMMIT="$COMMIT" -t "$IMG:$COMMIT" "$SRC/painel-editorial"
    if docker image inspect "$IMG:atual" >/dev/null 2>&1; then docker tag "$IMG:atual" "$IMG:anterior"; fi
    docker tag "$IMG:$COMMIT" "$IMG:atual"
    docker compose up -d
    if saude; then echo "OK: $IMG:$COMMIT saudável"; else
      echo "Healthcheck falhou; revertendo" >&2
      if docker image inspect "$IMG:anterior" >/dev/null 2>&1; then docker tag "$IMG:anterior" "$IMG:atual"; docker compose up -d; fi
      exit 1
    fi
    ;;
  reverter)
    docker image inspect "$IMG:anterior" >/dev/null 2>&1 || { echo "Sem imagem anterior" >&2; exit 1; }
    docker tag "$IMG:atual" "$IMG:revertida-$(date +%s)"
    docker tag "$IMG:anterior" "$IMG:atual"
    docker compose up -d
    saude && echo "Revertido para a imagem anterior"
    ;;
  status)
    docker ps --filter name=painel-editorial --format '{{.Names}}  {{.Image}}  {{.Status}}'
    curl -fsS http://127.0.0.1:3100/api/health && echo
    ;;
  definir-senha|desativar)
    USR="${2:?informe o usuário}"
    if [ "$1" = "definir-senha" ]; then
      read -r -s -p "Nova senha para $USR (mín. 12 caracteres): " P1; echo
      read -r -s -p "Repita: " P2; echo
      [ "$P1" = "$P2" ] || { echo "As senhas não conferem" >&2; exit 1; }
      HASH="$(printf '%s' "$P1" | docker run --rm -i --entrypoint node "$IMG:atual" scripts/hash-senha.mjs)"
      unset P1 P2
    else HASH=""; fi
    umask 077
    python3 - "$DIR/.env" "$USR" "$HASH" <<'PY'
import base64, json, sys
env, usr, h = sys.argv[1], sys.argv[2], sys.argv[3]
linhas = open(env).read().splitlines()
idx = next(i for i, l in enumerate(linhas) if l.startswith("PAINEL_USUARIOS_B64="))
users = json.loads(base64.b64decode(linhas[idx].split("=", 1)[1] or "W10=").decode())
u = next((x for x in users if x["usuario"] == usr), None)
if u is None: sys.exit(f"Usuário {usr} não existe no .env")
if h: u["senha_hash"] = h; u["ativo"] = True
else: u["ativo"] = False
linhas[idx] = "PAINEL_USUARIOS_B64=" + base64.b64encode(json.dumps(users, separators=(",", ":")).encode()).decode()
open(env, "w").write("\n".join(linhas) + "\n")
PY
    docker compose up -d --force-recreate
    saude && echo "Usuário $USR atualizado"
    ;;
  *)
    sed -n '2,8p' "$0"; exit 1 ;;
esac
