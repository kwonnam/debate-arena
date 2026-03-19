#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_SRC="$ROOT_DIR/scripts/macos/com.debatearena.telegram-polling.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_DST="$LAUNCH_AGENTS_DIR/com.debatearena.telegram-polling.plist"
LABEL="com.debatearena.telegram-polling"
USER_UID="$(id -u)"

mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$ROOT_DIR/output/telegram"
cp "$PLIST_SRC" "$PLIST_DST"

chmod 644 "$PLIST_DST"
chmod 755 "$ROOT_DIR/scripts/run_telegram_polling.sh"

launchctl bootout "gui/$USER_UID" "$PLIST_DST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$USER_UID" "$PLIST_DST"
launchctl enable "gui/$USER_UID/$LABEL"
launchctl kickstart -k "gui/$USER_UID/$LABEL"

echo "Installed and started $LABEL"
echo "Plist: $PLIST_DST"
echo "Logs: $ROOT_DIR/output/telegram/launchd-out.log, $ROOT_DIR/output/telegram/launchd-err.log"
