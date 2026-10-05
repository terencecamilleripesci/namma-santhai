"""Web Push — real notifications while the app is CLOSED.

The in-app poller only runs while a tab is open. This uses the browser's own
push service (FCM on Android Chrome, Apple's on iOS), so the phone wakes the
service worker and shows a notification with the app shut.

Keys: data/vapid.json, generated once, chmod 600, gitignored. The PUBLIC key
is handed to the client; the private key never leaves the Pi.

Platform reality, so nobody is promised something that will not happen:
  * Android Chrome / Edge / Firefox: works with the site in a tab or installed.
  * iOS Safari: requires iOS 16.4+ AND the app ADDED TO THE HOME SCREEN.
    Push to a plain Safari tab is not supported by Apple at all.
  * A subscription dies when the user clears site data or revokes permission;
    the push service then returns 404/410 and we delete it.
"""
import os, json, base64, time

HERE = os.path.dirname(os.path.abspath(__file__))
VAPID_PATH = os.path.join(HERE, "data", "vapid.json")
# pywebpush mis-parses a PEM *string* as DER ("ASN.1 parsing error: invalid
# length") and every push fails. It handles a PEM *file path* correctly, so we
# keep the key on disk and hand over the path.
PEM_PATH = os.path.join(HERE, "data", "vapid_private.pem")
# The VAPID 'sub' claim is the admin contact the PUSH SERVICE can reach - it is
# never shown to users. Two constraints bit here:
#   * py_vapid insists it is a mailto: link (an https:// URL is rejected
#     outright with "Missing 'sub' from claims").
#   * Apple returns 403 for a bogus domain, so the reserved .example TLD fails
#     even though FCM accepted it.
# Override with NS_VAPID_SUBJECT once the client has their own address.
SUBJECT = os.environ.get("NS_VAPID_SUBJECT", "mailto:terencecamilleripesci@gmail.com")

_keys = None
try:
    from pywebpush import webpush, WebPushException
    AVAILABLE = True
except Exception:                                    # noqa: BLE001
    webpush = None
    WebPushException = Exception
    AVAILABLE = False


def keys():
    global _keys
    if _keys is None:
        try:
            with open(VAPID_PATH) as fh:
                _keys = json.load(fh)
        except Exception:                            # noqa: BLE001
            _keys = {}
    return _keys


def public_key():
    return keys().get("public_key", "")


def _ensure_pem_file():
    """Materialise the PEM on disk; pywebpush only parses it reliably by path."""
    if os.path.exists(PEM_PATH):
        return PEM_PATH
    pem = keys().get("pem")
    if not pem:
        return None
    try:
        with open(PEM_PATH, "w") as fh:
            fh.write(pem)
        os.chmod(PEM_PATH, 0o600)
        return PEM_PATH
    except Exception:                                # noqa: BLE001
        return None


def enabled():
    return bool(AVAILABLE and keys().get("pem"))


def send(subscription, title, body, url=None, tag=None):
    """Push one message. Returns (ok, detail).

    'ok' means the PUSH SERVICE accepted it for delivery - it is not a receipt
    that the phone displayed anything. detail 'gone' means the subscription is
    dead and the caller should delete it.
    """
    if not enabled():
        return False, "push not configured"
    payload = json.dumps({"title": title, "body": body,
                          "url": url or "./", "tag": tag or "ns"})
    try:
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=_ensure_pem_file(),
            vapid_claims={"sub": SUBJECT, "exp": int(time.time()) + 12 * 3600},
            ttl=86400,
        )
        return True, "accepted by push service"
    except WebPushException as e:                    # noqa: BLE001
        code = getattr(getattr(e, "response", None), "status_code", None)
        if code in (404, 410):
            return False, "gone"                     # expired/unsubscribed
        return False, "push failed: %s" % code
    except Exception as e:                           # noqa: BLE001
        # Keep the message: "push error: ValueError" hid a PEM parsing bug that
        # silently broke every single push.
        return False, "push error: %s: %s" % (e.__class__.__name__, str(e)[:120])
