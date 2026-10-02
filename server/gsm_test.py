"""Namma Santhai — SEPARATE GSM test lane.

PURPOSE
    Let the trial send a real OTP text, for TESTING, without going anywhere near
    the LuxuryLifts business SMS path.

HOW IT STAYS OUT OF THE WAY OF THE BUSINESS
    * Its own queue file, inside this client folder:  server/data/ns_sms_queue.jsonl
      The business queue (Cosmo/data/sms_queue.jsonl) is NEVER opened, read or
      written by this module.
    * Its own drainer (`python3 gsm_test.py drain`), run by hand. It does not
      touch, start, stop or race the business agent.
    * It REUSES apps/netfailover/s9sms.send_sms unmodified. That function already
      picks the SIM by matching the business number and REFUSES if that SIM is
      absent, and it confirms against content://sms/sent rather than believing the
      binder's empty Parcel. Re-implementing that would be how the private SIM
      leaks, so we import it instead of copying it.

THE THREE GUARDS (all must pass or nothing is sent)
    1. ALLOWLIST - NS_GSM_TEST_ALLOW must list the exact destination numbers.
       An empty allowlist means "send to nobody". A real customer number can
       never be texted by this trial, by construction.
    2. DRY RUN by default - NS_GSM_TEST_LIVE=1 is required to actually transmit.
    3. CAP - at most NS_GSM_TEST_MAX messages per run window, so a loop or a
       retry storm cannot run up an international bill.

COST / NUMBER WARNING (read before enabling)
    The handset's business SIM is a MALTESE line. Trial users are INDIAN (+91),
    so every test message is an international SMS with a real per-message cost,
    and it would display the Maltese business number to the recipient. That is
    why this is allowlist-only and meant for texting your own handset to prove
    the path - not for onboarding real Indian users.
"""
import os, sys, json, time, re

HERE = os.path.dirname(os.path.abspath(__file__))
QUEUE = os.path.join(HERE, "data", "ns_sms_queue.jsonl")
SENT_LOG = os.path.join(HERE, "data", "ns_sms_sent.jsonl")
S9_PATH = os.environ.get("NS_S9SMS_DIR", "/home/foxhound/apps/netfailover")

LIVE = os.environ.get("NS_GSM_TEST_LIVE", "0") == "1"
MAX_PER_RUN = int(os.environ.get("NS_GSM_TEST_MAX", "5"))
ALLOW = [re.sub(r"\D", "", n) for n in
         os.environ.get("NS_GSM_TEST_ALLOW", "").split(",") if n.strip()]


def _digits(n):
    return re.sub(r"\D", "", n or "")


def allowed(to):
    """Allowlist match on the last 8 digits (country-code agnostic)."""
    d = _digits(to)
    if not d or not ALLOW:
        return False
    return any(d[-8:] == a[-8:] for a in ALLOW if a)


def enqueue(to, body):
    """Called by the API. Writing to the queue is NOT sending."""
    os.makedirs(os.path.dirname(QUEUE), exist_ok=True)
    rec = {"to": to, "body": body, "queued_at": int(time.time()), "state": "queued"}
    with open(QUEUE, "a") as fh:
        fh.write(json.dumps(rec) + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    return rec


def _load():
    if not os.path.exists(QUEUE):
        return []
    out = []
    with open(QUEUE) as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except Exception:
                    pass
    return out


def _rewrite(rows):
    tmp = QUEUE + ".tmp"
    with open(tmp, "w") as fh:
        for r in rows:
            fh.write(json.dumps(r) + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, QUEUE)


def _log(rec):
    with open(SENT_LOG, "a") as fh:
        fh.write(json.dumps(rec) + "\n")


def drain():
    """Process the trial queue. Prints exactly what happened to each message."""
    rows = _load()
    pending = [r for r in rows if r.get("state") == "queued"]
    if not pending:
        print("nothing queued")
        return 0

    print("mode   : %s" % ("LIVE - will really transmit" if LIVE else "DRY RUN - nothing sent"))
    print("allow  : %s" % (", ".join("…" + a[-4:] for a in ALLOW) if ALLOW else "(empty - blocks everything)"))
    print("cap    : %d per run" % MAX_PER_RUN)
    print("queued : %d" % len(pending))
    print("-" * 56)

    send_sms = None
    if LIVE:
        sys.path.insert(0, S9_PATH)
        try:
            from s9sms import send_sms as _s, device_ready, active_sub_id   # noqa
        except Exception as e:                       # noqa: BLE001
            print("REFUSED: cannot import s9sms (%s)" % e)
            return 2
        if not device_ready():
            print("REFUSED: phone not reachable over adb - nothing sent")
            return 2
        if active_sub_id() is None:
            # The whole point of the identity match. Never fall back to "any SIM".
            print("REFUSED: business SIM not present - refusing to send from another line")
            return 2
        send_sms = _s

    done = 0
    for r in rows:
        if r.get("state") != "queued":
            continue
        to = r.get("to", "")
        if not allowed(to):
            r["state"] = "blocked"
            r["detail"] = "not in NS_GSM_TEST_ALLOW"
            print("BLOCKED  %s  (not on the test allowlist)" % _mask(to))
            continue
        if done >= MAX_PER_RUN:
            print("CAP REACHED - %d left queued for the next run" % (
                len([x for x in rows if x.get("state") == "queued"])))
            break
        if not LIVE:
            print("DRYRUN   %s  would send: %s" % (_mask(to), r.get("body", "")[:48]))
            r["state"] = "dryrun"
            done += 1
            continue
        ok = send_sms(to, r.get("body", ""))
        # send_sms returns True only when the message appears in content://sms/sent.
        # That is a real device state change, but still NOT a delivery receipt.
        r["state"] = "filed_in_sent_box" if ok else "failed"
        r["detail"] = ("confirmed in the handset's sent box (not a delivery receipt)"
                       if ok else "refused or not confirmed - NOT sent")
        r["done_at"] = int(time.time())
        _log(dict(r))
        print("%-8s %s  %s" % ("SENT?" if ok else "FAILED", _mask(to), r["detail"]))
        done += 1

    _rewrite(rows)
    return 0


def _mask(n):
    d = _digits(n)
    return ("…" + d[-4:]) if len(d) >= 4 else "(?)"


def status():
    rows = _load()
    by = {}
    for r in rows:
        by[r.get("state", "?")] = by.get(r.get("state", "?"), 0) + 1
    return {"queue_file": QUEUE, "live": LIVE, "allowlist_size": len(ALLOW),
            "cap_per_run": MAX_PER_RUN, "counts": by}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "drain":
        sys.exit(drain())
    if cmd == "test":                       # queue one message to yourself
        if len(sys.argv) < 3:
            print("usage: gsm_test.py test <number>")
            sys.exit(64)
        enqueue(sys.argv[2], "Namma Santhai test: your code is 123456. Do not share it.")
        print("queued. now run:  python3 gsm_test.py drain")
        sys.exit(0)
    print(json.dumps(status(), indent=2))
