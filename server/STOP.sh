#!/usr/bin/env bash
# Stop the trial backend. ACCOUNTS AND LISTINGS ARE KEPT.
#
# Data lives in data/namma.db and survives stop/start and reboots. Signing in
# with the same phone number returns the SAME account - nothing is lost by
# restarting, only by deliberately erasing.
#
# To erase everything you must say so explicitly:
#     bash STOP.sh --wipe --yes-delete-all-accounts
# Anything less refuses, because a stray --wipe during a deploy is how real
# testers lost their accounts.
set -u
cd "$(dirname "$0")"

if [ -f server.pid ]; then
  PID="$(cat server.pid)"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null; sleep 1
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
  if [ "${2:-}" != "--yes-delete-all-accounts" ]; then
    echo
    echo "REFUSED to wipe. That would delete every account, listing and photo."
    echo "If you really mean it:"
    echo "    bash STOP.sh --wipe --yes-delete-all-accounts"
    exit 1
  fi
  STAMP=$(date +%Y%m%d-%H%M%S)
  if [ -d data ]; then
    mkdir -p backups && cp -a data "backups/data-$STAMP"
    echo "backup taken: $(pwd)/backups/data-$STAMP"
  fi
  rm -rf data
  echo "data wiped (a backup was kept above)"
else
  N=$(python3 - <<'PY' 2>/dev/null || echo "?"
import sqlite3,os
p=os.path.join(os.path.dirname(os.path.abspath("x")),"data","namma.db")
try:
    c=sqlite3.connect(p)
    print("%d accounts, %d listings" % (
        c.execute("select count(*) from users").fetchone()[0],
        c.execute("select count(*) from listings").fetchone()[0]))
except Exception: print("?")
PY
)
  echo "data KEPT: $N  ($(pwd)/data/namma.db)"
fi
