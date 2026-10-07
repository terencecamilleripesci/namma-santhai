#!/usr/bin/env bash
# Back up the trial database + uploaded photos.
#
# A disk failure today ends the business: the only copy of every account,
# listing and photo is one sqlite file on one SD card. This takes a consistent
# snapshot (sqlite .backup, safe while the server is running) plus the media,
# keeps the last 14, and VERIFIES each one by opening it and counting rows -
# an unverified backup is a guess.
set -eu
cd "$(dirname "$0")"
OUT="${NS_BACKUP_DIR:-$PWD/backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="$OUT/$STAMP"
mkdir -p "$DEST"

python3 - "$DEST" <<'PY'
import sqlite3, sys, os
dest = sys.argv[1]
src = sqlite3.connect("data/namma.db")
dst = sqlite3.connect(os.path.join(dest, "namma.db"))
src.backup(dst)                      # consistent even with the server running
dst.close(); src.close()
PY

if [ -d data/uploads ]; then
  tar -czf "$DEST/uploads.tar.gz" -C data uploads
fi
[ -f data/vapid.json ] && cp data/vapid.json "$DEST/" || true

# VERIFY: open the copy and count. A backup you have not read is not a backup.
VERIFY=$(python3 - "$DEST" <<'PY'
import sqlite3, sys, os
p = os.path.join(sys.argv[1], "namma.db")
try:
    c = sqlite3.connect(p)
    u = c.execute("select count(*) from users").fetchone()[0]
    l = c.execute("select count(*) from listings").fetchone()[0]
    assert c.execute("pragma integrity_check").fetchone()[0] == "ok"
    print("ok %d accounts, %d listings" % (u, l))
except Exception as e:
    print("FAILED %s" % e)
PY
)
case "$VERIFY" in
  ok*) echo "backup $STAMP verified: ${VERIFY#ok }" ;;
  *)   echo "BACKUP FAILED VERIFICATION: $VERIFY" >&2; exit 1 ;;
esac

# keep the newest 14
ls -1d "$OUT"/*/ 2>/dev/null | sort | head -n -14 | xargs -r rm -rf
echo "kept $(ls -1d "$OUT"/*/ 2>/dev/null | wc -l) backups in $OUT"
