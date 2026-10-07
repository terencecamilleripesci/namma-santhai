#!/usr/bin/env bash
# Is the trial actually serving? Checks the LOCAL app and the PUBLIC URL, and
# restarts the service if the app is down.
#
# "systemctl says active" is not the same as "users can use it" - a wedged
# process stays active. This asks the API the same question a phone would.
set -u
cd "$(dirname "$0")"
PUB="${NS_PUBLIC_URL:-https://raspberrypi.silverside-tench.ts.net:8443/nsapi}"
LOCAL="http://127.0.0.1:${NS_PORT:-8105}"
STAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG="logs/health.log"; mkdir -p logs

local_ok=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$LOCAL/api/health" || echo 000)
pub_ok=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$PUB/api/health" || echo 000)

if [ "$local_ok" != "200" ]; then
  echo "$STAMP LOCAL DOWN ($local_ok) - restarting" >> "$LOG"
  systemctl --user restart namma-santhai.service
  sleep 5
  local_ok=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$LOCAL/api/health" || echo 000)
  echo "$STAMP after restart: $local_ok" >> "$LOG"
fi

# errors since boot, straight from the app
errs=$(curl -s --max-time 10 "$LOCAL/api/health" \
       | python3 -c "import sys,json;print(json.load(sys.stdin).get('errors',0))" 2>/dev/null || echo "?")

echo "$STAMP local=$local_ok public=$pub_ok errors=$errs" >> "$LOG"
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

if [ "$local_ok" = "200" ]; then
  echo "OK  local=$local_ok public=$pub_ok errors=$errs"
  # A public failure with a healthy local app means the tunnel is the problem,
  # not the app. Say which, because they need different fixes.
  [ "$pub_ok" != "200" ] && echo "WARNING: app is healthy but the PUBLIC URL is not reachable - check the funnel"
  exit 0
fi
echo "FAILED local=$local_ok public=$pub_ok"
exit 1
