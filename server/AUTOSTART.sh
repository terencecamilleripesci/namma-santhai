#!/usr/bin/env bash
# Keep the trial backend running across reboots, via a USER-level systemd unit.
# It touches nothing else on the Pi and is removed with: bash AUTOSTART.sh off
set -eu
cd "$(dirname "$0")"
DIR="$(pwd)"
UNIT="$HOME/.config/systemd/user/namma-santhai.service"

if [ "${1:-on}" = "off" ]; then
  systemctl --user disable --now namma-santhai.service 2>/dev/null || true
  rm -f "$UNIT"; systemctl --user daemon-reload 2>/dev/null || true
  echo "autostart removed (the backend itself is untouched)"
  exit 0
fi

mkdir -p "$(dirname "$UNIT")"
cat > "$UNIT" <<UNITEOF
[Unit]
Description=Namma Santhai trial backend (client project)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$DIR
Environment=NS_PORT=8105
Environment=NS_HOST=127.0.0.1
# admin number + secret come from server/admin.env (gitignored)
EnvironmentFile=-%h/webclients/namma-santhai/server/admin.env
ExecStart=/usr/bin/python3 $DIR/app.py
Restart=always
RestartSec=5
# Keep it off the OOM killer's first choice, without competing with his
# business services for priority.
OOMScoreAdjust=100

[Install]
WantedBy=default.target
UNITEOF

systemctl --user daemon-reload
systemctl --user enable --now namma-santhai.service
loginctl enable-linger "$USER" >/dev/null 2>&1 || true   # survive logout/reboot
sleep 2
systemctl --user is-active namma-santhai.service >/dev/null \
  && echo "autostart ON - survives reboot. Remove with: bash AUTOSTART.sh off" \
  || { echo "FAILED:"; systemctl --user status namma-santhai.service --no-pager | tail -15; }
