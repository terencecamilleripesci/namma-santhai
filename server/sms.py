"""OTP delivery for the Namma Santhai trial backend.

TWO MODES, selected by NS_OTP_MODE:

  demo  (DEFAULT)  -> the code is returned to the screen. No SMS leaves the Pi.
  gsm              -> hand the message to the EXISTING sms_queue.jsonl seam.

GSM IS OFF BY DEFAULT AND MUST STAY OFF UNTIL TERENCE SAYS OTHERWISE.

Hard rules baked in below, because getting these wrong costs real money /
exposes a private line:

  * The phone has TWO SIMs and one of them is PRIVATE. Business messages may
    ONLY leave from the business line. We therefore select the SIM *by
    identity* (NS_GSM_FROM must match NS_GSM_BUSINESS_MSISDN) and REFUSE to
    send if it is absent. We never choose a SIM "by position/slot" - that is
    exactly how a private line gets used by accident.
  * We never print the business number into logs or API responses.
  * Queuing is NOT proof of delivery. We log 'queued', never 'sent', because
    only the sender daemon can observe the real result.
  * These are INDIAN +91 numbers for a trial. Sending real international SMS
    costs money per message - keep gsm off unless deliberately testing.
"""
import os, json, time

MODE = os.environ.get("NS_OTP_MODE", "demo").strip().lower()
# Third mode: "gsmtest" -> our OWN queue in server/data/, drained by hand via
# gsm_test.py. Allowlist-only, dry-run by default. Never touches the business
# queue or the business agent. See gsm_test.py for the three guards.
try:
    import gsm_test as GSMTEST
except Exception:                                    # noqa: BLE001
    GSMTEST = None

# Path of the existing queue seam. Only used when MODE == "gsm".
SMS_QUEUE = os.environ.get("NS_SMS_QUEUE", "").strip()
# The business line. Must be set explicitly to enable gsm.
BUSINESS = os.environ.get("NS_GSM_BUSINESS_MSISDN", "").strip()
FROM = os.environ.get("NS_GSM_FROM", "").strip()


class SmsRefused(Exception):
    pass


def _mask(num):
    """Never reveal a full number in logs/responses."""
    if not num:
        return "(unset)"
    return "*" * max(0, len(num) - 3) + num[-3:]


def deliver(phone_e164, code):
    """Return (result, detail). result in: shown_on_screen | queued | failed.

    NEVER returns 'sent' - nothing here can observe real delivery.
    """
    if MODE == "demo":
        # Code goes back to the caller and is shown on screen, clearly labelled.
        return "shown_on_screen", "demo mode - no SMS sent"

    if MODE == "gsmtest":
        # SEPARATE test lane: our own queue file, drained by hand.
        if GSMTEST is None:
            raise SmsRefused("gsm_test module unavailable - refusing to send")
        if not GSMTEST.allowed(phone_e164):
            # Blocked here too, not just at drain time, so the API never even
            # queues a message to a number that is not an approved test handset.
            raise SmsRefused("number is not on the GSM test allowlist")
        GSMTEST.enqueue(phone_e164,
                        "Namma Santhai: your code is %s. Do not share it." % code)
        return "queued", ("queued to the trial's own SMS lane - run "
                          "`python3 server/gsm_test.py drain` to send")

    if MODE != "gsm":
        return "failed", "unknown NS_OTP_MODE=%s" % MODE

    # ---- gsm mode: refuse loudly rather than guess ----
    if not SMS_QUEUE:
        raise SmsRefused("NS_SMS_QUEUE not configured - refusing to send")
    if not BUSINESS:
        raise SmsRefused("NS_GSM_BUSINESS_MSISDN not set - refusing to send")
    if not FROM:
        raise SmsRefused("NS_GSM_FROM not set - refusing to send")
    if FROM != BUSINESS:
        # The whole point: identity must match, never slot/position.
        raise SmsRefused(
            "sender line %s does not match the business line %s - refusing"
            % (_mask(FROM), _mask(BUSINESS))
        )
    if not os.path.exists(os.path.dirname(SMS_QUEUE) or "."):
        raise SmsRefused("sms queue directory missing - refusing to send")

    body = "Namma Santhai: your code is %s. Do not share it." % code
    rec = {
        "to": phone_e164,
        "from_identity": FROM,     # identity, NOT a slot index
        "body": body,
        "source": "namma-santhai-trial",
        "queued_at": int(time.time()),
    }
    try:
        with open(SMS_QUEUE, "a") as fh:
            fh.write(json.dumps(rec) + "\n")
            fh.flush()
            os.fsync(fh.fileno())
    except Exception as e:                      # noqa: BLE001
        return "failed", "queue write failed: %s" % e.__class__.__name__

    # Queued != delivered. Say exactly that.
    return "queued", "handed to sms_queue (delivery NOT confirmed)"


def status():
    out = {
        "mode": MODE,
        "gsm_enabled": MODE == "gsm",
        "gsm_ready": bool(MODE == "gsm" and SMS_QUEUE and BUSINESS and FROM and FROM == BUSINESS),
        "queue_configured": bool(SMS_QUEUE),
        "from_line": _mask(FROM) if FROM else "(unset)",
        "business_queue_touched": False,      # this trial never opens it
    }
    if MODE == "gsmtest" and GSMTEST is not None:
        s = GSMTEST.status()
        out["gsm_test"] = {"live": s["live"], "allowlist_size": s["allowlist_size"],
                           "cap_per_run": s["cap_per_run"], "counts": s["counts"]}
    return out
