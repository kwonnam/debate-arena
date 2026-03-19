#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEBATE_ENV_FILE="$ROOT_DIR/.env"
AI_HEDGE_ENV_FILE="/Users/namkwon/dev/MiroFish/ai-hedge-fund/.env"
LOG_DIR="$ROOT_DIR/output/telegram"

mkdir -p "$LOG_DIR"

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      local trimmed="$line"

      trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"
      trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"

      [[ -z "$trimmed" ]] && continue
      [[ "$trimmed" == \#* ]] && continue
      [[ "$trimmed" != *=* ]] && continue

      local key="${trimmed%%=*}"
      local value="${trimmed#*=}"

      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"

      if [[ "$value" == \"*\" && "$value" == *\" ]]; then
        value="${value:1:${#value}-2}"
      elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
        value="${value:1:${#value}-2}"
      fi

      export "$key=$value"
    done < "$env_file"
  fi
}

load_env_file "$AI_HEDGE_ENV_FILE"
load_env_file "$DEBATE_ENV_FILE"

cd "$ROOT_DIR"
exec /opt/homebrew/bin/node "$ROOT_DIR/dist/bin/telegram.js" --timeout "${TELEGRAM_POLL_TIMEOUT:-30}"
