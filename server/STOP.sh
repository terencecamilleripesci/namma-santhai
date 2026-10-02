#!/usr/bin/env bash
# Stop the temporary trial backend. Data is KEPT (data/namma.db).
# To wipe everything too:   bash STOP.sh --wipe
set -u
cd "$(dirname "$0")"

if [ -f server.pid ]; then
  PID="$(cat server.pid)"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    sleep 1
    kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null
    echo "stopped pid $PID"
  else
    echo "not running (stale pid file)"
  fi
  rm -f server.pid
else
  pkill -f "python3 app.py" 2>/dev/null && echo "stopped by name" || echo "not running"
fi

if [ "${1:-}" = "--wipe" ]; then
  rm -rf data
  echo "data wiped (accounts, listings, photos, messages all gone)"
else
  echo "data kept at $(pwd)/data/namma.db  (use --wipe to delete)"
fi
