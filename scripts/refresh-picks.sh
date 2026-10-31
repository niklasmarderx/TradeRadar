#!/usr/bin/env bash
# Trigger a full scanner run if TradeRadar is running on port 3000.
# Called by crontab; logs to /tmp/traderar-refresh.log.

set -euo pipefail

PORT=3000
LOG=/tmp/traderar-refresh.log
TS=$(date '+%Y-%m-%d %H:%M:%S')

if ! curl -sf "http://localhost:${PORT}/" -o /dev/null 2>/dev/null; then
  echo "[${TS}] TradeRadar not running on :${PORT}, skipping." >> "$LOG"
  exit 0
fi

echo "[${TS}] Triggering full scan…" >> "$LOG"
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST "http://localhost:${PORT}/api/scanner/full" \
  -H "Content-Type: application/json" \
  --max-time 300 2>/dev/null || echo "000")

echo "[${TS}] Scanner responded: ${STATUS}" >> "$LOG"
