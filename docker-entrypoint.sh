#!/bin/sh
# Стартуем как root: Railway монтирует Volume на точку, принадлежащую root.
# Выдаём права пользователю node на каталог памяти, затем роняем привилегии.
set -e

VAULT="${OBSIDIAN_VAULT_PATH:-/data/vault}"
# Родительский каталог тома (например /data) и сам каталог vault
PARENT="$(dirname "$VAULT")"

mkdir -p "$VAULT" 2>/dev/null || true
# chown только если каталог существует и мы root; ошибки не фатальны
chown -R node:node "$PARENT" 2>/dev/null || true

# Роняем привилегии до node и запускаем приложение
exec su node -c 'node dist/index.js'
