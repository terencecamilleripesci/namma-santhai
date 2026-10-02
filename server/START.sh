#!/usr/bin/env bash
# Start the TEMPORARY Namma Santhai trial backend.
# Nothing here survives a reboot. No systemd, no cron. Stop with STOP.sh
set -u
cd "$(dirname "$0")"

PORT="${NS_PORT:-8105}"
export NS_PORT="$PORT"
export NS_HOST="${NS_HOST:-127.0.0.1}"

# ---- OTP MODE -------------------------------------------------------------
# demo = code shown on screen, NO SMS leaves this machine.  <-- default
# gsm  = hand to the existing sms_queue seam (ONLY when explicitly enabled)
export NS_OTP_MODE="${NS_OTP_MODE:-demo}"

# Admin accounts: comma separated 10-digit numbers that get role=admin on signup.
# Signing in with one of these grants the approval queue. Role is enforced
# server-side, so a normal user cannot reach it by URL or API.
export NS_ADMIN_PHONES="${NS_ADMIN_PHONES:-9843575561}"

if [ -f server.pid ] && kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "already running (pid $(cat server.pid)) on port $PORT"
  exit 0
fi

nohup python3 app.py > server.log 2>&1 &
echo $! > server.pid
sleep 1.5

if kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "namma-santhai backend started"
  echo "  pid    : $(cat server.pid)"
  echo "  listen : $NS_HOST:$PORT"
  echo "  otp    : $NS_OTP_MODE"
  echo "  data   : $(pwd)/data/namma.db"
  echo "  stop   : bash $(pwd)/STOP.sh"
else
  echo "FAILED to start - see $(pwd)/server.log"; tail -20 server.log; exit 1
fi
