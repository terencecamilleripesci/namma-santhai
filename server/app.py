"""Namma Santhai — TEMPORARY trial backend.

Real accounts, real sessions, real listings, real admin approval, real chat,
persisted to sqlite so the company can test a production-shaped flow.

Deliberately NOT production: single process, no HTTPS of its own (put it
behind Tailscale Funnel), demo OTP by default. Easy to stop and delete.

Run:  bash server/START.sh      Stop:  bash server/STOP.sh
"""
import os, re, json, time, base64, secrets, random, sqlite3, logging, traceback
from logging.handlers import RotatingFileHandler
from functools import wraps
from flask import Flask, request, jsonify, g, send_from_directory, make_response

import db as D
import sms as SMS
import push as PUSH

app = Flask(__name__, static_folder=None)
# Without this a single POST can stream unlimited bytes into memory and take the
# whole Pi down. Photos are base64 in JSON, which inflates ~33%, so the cap sits
# above the 4 MB per-image limit with room for a few images per request.
app.config["MAX_CONTENT_LENGTH"] = 24 * 1024 * 1024

# ---------------------------------------------------------------- logging
# Previously a 500 vanished into the systemd journal with no stack trace, so a
# broken route could fail for every user and nobody would know. Errors now go
# to a rotating file with the request that caused them.
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
_h = RotatingFileHandler(os.path.join(LOG_DIR, "errors.log"),
                         maxBytes=2 * 1024 * 1024, backupCount=5)
_h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
_h.setLevel(logging.WARNING)
app.logger.addHandler(_h)
app.logger.setLevel(logging.INFO)

# Counters so /api/health can show whether anything is going wrong at all.
STATS = {"started_at": int(time.time()), "requests": 0, "errors": 0, "rate_limited": 0}


@app.errorhandler(Exception)
def unhandled(e):
    """Never leak a stack trace to a user; always keep one for us."""
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    STATS["errors"] += 1
    app.logger.error("UNHANDLED %s %s\n%s", request.method, request.path,
                     traceback.format_exc())
    return err("server_error", "Something went wrong. Please try again.", 500)

OTP_TTL = 5 * 60          # code valid 5 minutes
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN = 30  # seconds
SESSION_TTL = 30 * 24 * 3600
MAX_UPLOAD = 4 * 1024 * 1024
PHONE_RE = re.compile(r"^[6-9]\d{9}$")        # Indian mobile
ADMIN_PHONES = [p.strip() for p in os.environ.get("NS_ADMIN_PHONES", "").split(",") if p.strip()]

# AUTH MODE
#   open (DEFAULT) -> no OTP at all. Enter a number, get an account+session.
#                     This is a TRIAL so the client can test accounts, listings,
#                     approvals and chat without waiting for codes. It proves
#                     nothing about owning the number - production must use otp.
#   otp            -> the full code flow (kept intact, see request_otp/verify).
AUTH_MODE = os.environ.get("NS_AUTH_MODE", "open").strip().lower()

# ADMIN SECOND FACTOR.
# Sign-in is a phone number with no verification, so a phone number is NOT a
# credential - anyone who learns it can become that user. An admin number was
# also committed to a PUBLIC repo, which made admin takeover a copy-paste away.
# Admin now additionally requires this secret, supplied at sign-in. Without it
# the account signs in as a NORMAL user, even if the number is on the list.
ADMIN_SECRET = os.environ.get("NS_ADMIN_SECRET", "").strip()

# MODERATION
#   post  (DEFAULT) -> a new ad goes LIVE immediately; admins moderate after the
#                      fact and can still reject/remove it. This is how real
#                      marketplaces work: holding every ad behind a human for
#                      hours kills listing volume, and sellers think it broke.
#   pre             -> every ad waits in the approval queue before anyone sees it.
MODERATION = os.environ.get("NS_MODERATION", "post").strip().lower()
NEW_STATUS = "pending" if MODERATION == "pre" else "active"

# Browsers calling this from GitHub Pages need CORS.
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "NS_ALLOWED_ORIGINS",
    "https://terencecamilleripesci.github.io,http://localhost:8012,http://127.0.0.1:8012"
).split(",") if o.strip()]


# ------------------------------------------------------------------ CORS
@app.after_request
def cors(resp):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        resp.headers["Access-Control-Max-Age"] = "600"
    return resp


@app.route("/api/<path:_any>", methods=["OPTIONS"])
def preflight(_any):
    return make_response("", 204)


# ---------------------------------------------------------------- rate limit
# In-process and therefore reset by a restart - honest about what it is. It
# stops scripted abuse of signin/post/message, which is the realistic threat
# here; a real deployment wants this in front of the app (nginx/Cloudflare).
_HITS = {}
# Indian mobile users sit behind carrier-grade NAT: a whole town can share one
# IP. A tight per-IP cap on signin would lock out real farmers, so the per-IP
# limits are generous and the SENSITIVE one (the admin key) is tight.
_RATES = {
    "/api/auth/signin":        (60, 600),    # CGNAT-friendly
    "/api/listings":           (30, 600),
    "/api/conversations":      (40, 600),
    "/api/push/test":          (5, 600),
    "/api/admin/elevate":      (5, 900),     # brute-forcing the admin key
}


def _client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    return (fwd.split(",")[0].strip() if fwd else request.remote_addr) or "?"


MAX_BODY = 24 * 1024 * 1024


@app.before_request
def count_request():
    if request.path.startswith("/api/"):
        STATS["requests"] += 1
    return None


@app.before_request
def body_cap():
    """Enforce the size cap ourselves.

    MAX_CONTENT_LENGTH alone was not enough: behind the tunnel the request
    arrives re-chunked with no Content-Length, so Werkzeug has nothing to check
    and a 26 MB body sailed through. Check the header when it is there, and
    otherwise read the stream with a hard ceiling.
    """
    if request.method in ("GET", "OPTIONS", "HEAD"):
        return None
    cl = request.content_length
    if cl is not None and cl > MAX_BODY:
        return err("too_large", "That upload is too large", 413)
    if cl is None and request.path.startswith("/api/"):
        try:
            data = request.get_data(cache=True, as_text=False)
        except Exception:                                # noqa: BLE001
            return err("too_large", "That upload is too large", 413)
        if len(data) > MAX_BODY:
            return err("too_large", "That upload is too large", 413)
    return None


@app.before_request
def rate_limit():
    if request.method in ("GET", "OPTIONS"):
        return None
    rule = None
    for path, cfg in _RATES.items():
        if request.path == path or request.path.startswith(path + "/"):
            rule = cfg
            break
    if not rule:
        return None
    cap, window = rule
    key = (_client_ip(), request.path)
    now = time.time()
    hits = [h for h in _HITS.get(key, []) if now - h < window]
    if len(hits) >= cap:
        hits.append(now); _HITS[key] = hits
        STATS["rate_limited"] += 1
        return err("rate_limited", "Too many requests. Please wait and try again.", 429)
    hits.append(now)
    _HITS[key] = hits
    if len(_HITS) > 5000:                       # keep the table bounded
        for k in [k for k, v in _HITS.items() if not any(now - h < 3600 for h in v)]:
            _HITS.pop(k, None)
    return None


@app.errorhandler(413)
def too_large(_e):
    return err("too_large", "That upload is too large", 413)


def err(code, msg, http=400):
    """Typed JSON errors with stable codes - never raw HTML."""
    return jsonify({"error": {"code": code, "message": msg}}), http


@app.errorhandler(404)
def nf(_e):
    return err("not_found", "Not found", 404)


@app.errorhandler(500)
def ise(_e):
    return err("server_error", "Server error", 500)


# ------------------------------------------------------------------ auth
def current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    tok = auth[7:].strip()
    con = D.connect()
    row = con.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id "
        "WHERE s.token=? AND s.expires_at>?", (tok, D.now())).fetchone()
    if row:
        con.execute("UPDATE users SET last_seen=? WHERE id=?", (D.now(), row["id"]))
        con.commit()
    con.close()
    return D.row_to_dict(row)


def require_auth(fn):
    @wraps(fn)
    def inner(*a, **kw):
        u = current_user()
        if not u:
            return err("unauthorized", "Sign in again", 401)
        if u.get("status") == "suspended":
            return err("suspended", "This account has been suspended", 403)
        g.user = u
        return fn(*a, **kw)
    return inner


def require_admin(fn):
    @wraps(fn)
    def inner(*a, **kw):
        u = current_user()
        if not u:
            return err("unauthorized", "Sign in again", 401)
        if u.get("role") != "admin":
            return err("forbidden", "Admin only", 403)   # server-enforced, not a hidden button
        g.user = u
        return fn(*a, **kw)
    return inner


# ------------------------------------------------------------------ OTP
@app.post("/api/auth/request-otp")
def request_otp():
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    if not PHONE_RE.match(phone):
        return err("bad_phone", "Enter a valid 10-digit Indian mobile number")

    con = D.connect()
    row = con.execute("SELECT * FROM otps WHERE phone=?", (phone,)).fetchone()
    now = D.now()
    if row and now - row["sent_at"] < OTP_RESEND_COOLDOWN:
        con.close()
        return err("cooldown", "Please wait before requesting another code", 429)
    if row and row["send_count"] >= 8 and now - row["sent_at"] < 3600:
        con.close()
        return err("rate_limited", "Too many codes requested. Try later.", 429)

    code = "%06d" % random.randint(0, 999999)
    con.execute(
        "INSERT INTO otps(phone,code_hash,expires_at,attempts,sent_at,send_count) "
        "VALUES(?,?,?,0,?,1) ON CONFLICT(phone) DO UPDATE SET "
        "code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, "
        "sent_at=excluded.sent_at, send_count=otps.send_count+1",
        (phone, D.hash_code(phone, code), now + OTP_TTL, now))
    con.commit()

    try:
        result, detail = SMS.deliver("+91" + phone, code)
    except SMS.SmsRefused as e:
        con.execute("INSERT INTO sms_log(phone,mode,result,detail,created_at) VALUES(?,?,?,?,?)",
                    (phone, SMS.MODE, "failed", "refused: %s" % e, now))
        con.commit(); con.close()
        return err("sms_refused", "Could not send the code: %s" % e, 503)

    con.execute("INSERT INTO sms_log(phone,mode,result,detail,created_at) VALUES(?,?,?,?,?)",
                (phone, SMS.MODE, result, detail, now))
    con.commit(); con.close()

    out = {"ok": True, "mode": SMS.MODE, "delivery": result, "detail": detail,
           "resend_after": OTP_RESEND_COOLDOWN}
    if SMS.MODE == "demo":
        # Clearly a simulation - the client labels it DEMO on screen.
        out["demo_code"] = code
    return jsonify(out)


@app.post("/api/auth/verify")
def verify_otp():
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    code = str(data.get("code", "")).strip()
    if not PHONE_RE.match(phone):
        return err("bad_phone", "Invalid number")

    con = D.connect()
    row = con.execute("SELECT * FROM otps WHERE phone=?", (phone,)).fetchone()
    if not row:
        con.close(); return err("no_otp", "Request a code first")
    if D.now() > row["expires_at"]:
        con.close(); return err("expired", "Code expired. Request a new one.")
    if row["attempts"] >= OTP_MAX_ATTEMPTS:
        con.close(); return err("too_many", "Too many attempts. Request a new code.", 429)
    if D.hash_code(phone, code) != row["code_hash"]:
        con.execute("UPDATE otps SET attempts=attempts+1 WHERE phone=?", (phone,))
        con.commit(); con.close()
        return err("bad_code", "Incorrect code")

    con.execute("DELETE FROM otps WHERE phone=?", (phone,))      # single use
    u = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
    now = D.now()
    if not u:
        role = "user"
        cur = con.execute(
            "INSERT INTO users(phone,phone_verified,role,created_at,last_seen,locality) "
            "VALUES(?,?,?,?,?,?)", (phone, 1, role, now, now, ""))
        uid = cur.lastrowid
    else:
        uid = u["id"]
        con.execute("UPDATE users SET phone_verified=1,last_seen=? WHERE id=?", (now, uid))

    tok = D.new_token()
    con.execute("INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES(?,?,?,?)",
                (tok, uid, now, now + SESSION_TTL))
    con.commit()
    user = D.row_to_dict(con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    con.close()
    return jsonify({"token": tok, "user": public_user(user, self_view=True)})


def admin_ok(secret):
    """No secret configured -> nobody can hold admin. Fail closed, not open."""
    if not ADMIN_SECRET:
        return False
    return bool(secret) and secrets.compare_digest(str(secret), ADMIN_SECRET)


def issue_session(con, phone, name=None, admin_secret=None):
    """Create-or-fetch the user and hand back a session token."""
    now = D.now()
    u = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
    if not u:
        role = "admin" if (phone in ADMIN_PHONES and admin_ok(admin_secret)) else "user"
        cur = con.execute(
            "INSERT INTO users(phone,phone_verified,name,role,created_at,last_seen,locality) "
            "VALUES(?,?,?,?,?,?,?)",
            (phone, 0 if AUTH_MODE == "open" else 1, (name or "")[:80], role, now, now, ""))
        uid = cur.lastrowid
    else:
        uid = u["id"]
        # Presenting the secret at sign-in promotes. NOT presenting it does not
        # demote: a plain sign-in silently wiping the only administrator is how
        # the admin account was lost. Stepping down is explicit
        # (POST /api/admin/step-down), and a number removed from ADMIN_PHONES
        # is still demoted here.
        if phone in ADMIN_PHONES and admin_ok(admin_secret):
            if u["role"] != "admin":
                con.execute("UPDATE users SET role='admin' WHERE id=?", (uid,))
        elif phone not in ADMIN_PHONES and u["role"] == "admin":
            con.execute("UPDATE users SET role='user' WHERE id=?", (uid,))
        if name and not (u["name"] or "").strip():
            con.execute("UPDATE users SET name=? WHERE id=?", ((name or "")[:80], uid))
        con.execute("UPDATE users SET last_seen=? WHERE id=?", (now, uid))
    tok = D.new_token()
    con.execute("INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES(?,?,?,?)",
                (tok, uid, now, now + SESSION_TTL))
    con.commit()
    user = D.row_to_dict(con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    return tok, user


@app.post("/api/auth/signin")
def signin():
    """One-step sign in - NO OTP. Enabled when NS_AUTH_MODE=open (the default).

    Deliberately does NOT mark the number verified: nothing here proves the
    tester owns it. The UI labels the account accordingly.
    """
    if AUTH_MODE != "open":
        return err("otp_required", "This server requires OTP sign in", 400)
    d = request.get_json(silent=True) or {}
    phone = re.sub(r"\D", "", str(d.get("phone", "")))
    name = str(d.get("name", "")).strip()
    if not PHONE_RE.match(phone):
        return err("bad_phone", "Enter a valid 10-digit Indian mobile number")
    con = D.connect()
    tok, user = issue_session(con, phone, name, d.get("admin_secret"))
    con.close()
    return jsonify({"token": tok, "user": public_user(user, self_view=True),
                    "verified": False, "auth_mode": "open"})


@app.post("/api/admin/elevate")
@require_auth
def admin_elevate():
    """Raise the CURRENT session to admin by presenting the admin secret.

    Admin needs two things - a number on NS_ADMIN_PHONES and the secret - but
    the app had no way to supply the secret, so after the second factor landed
    the admin simply could not become admin again. This is that missing door.
    Deliberately does NOT accept a phone number: it only elevates the account
    you are already signed in as.
    """
    secret = (request.get_json(silent=True) or {}).get("secret", "")
    u = g.user
    if u["phone"] not in ADMIN_PHONES:
        # Same answer either way - do not confirm which numbers are admins.
        return err("not_admin", "This account cannot be an administrator", 403)
    if not admin_ok(secret):
        return err("bad_secret", "Incorrect admin key", 403)
    con = D.connect()
    con.execute("UPDATE users SET role='admin' WHERE id=?", (u["id"],))
    con.commit()
    row = D.row_to_dict(con.execute("SELECT * FROM users WHERE id=?", (u["id"],)).fetchone())
    con.close()
    return jsonify({"ok": True, "user": public_user(row, self_view=True)})


@app.post("/api/admin/step-down")
@require_auth
def admin_step_down():
    con = D.connect()
    con.execute("UPDATE users SET role='user' WHERE id=?", (g.user["id"],))
    con.commit(); con.close()
    return jsonify({"ok": True})


@app.post("/api/auth/logout")
@require_auth
def logout():
    tok = request.headers.get("Authorization", "")[7:].strip()
    con = D.connect(); con.execute("DELETE FROM sessions WHERE token=?", (tok,))
    con.commit(); con.close()
    return jsonify({"ok": True})


# ------------------------------------------------------------------ users
def public_user(u, self_view=False):
    """Phone is PRIVATE by default. Only exposed with explicit consent."""
    if not u:
        return None
    out = {"id": u["id"], "name": u["name"] or "", "photo": u["photo"],
           "locality": u["locality"] or "", "role": u["role"],
           "verified": bool(u["phone_verified"]), "member_since": u["created_at"],
           "last_seen": u["last_seen"],
           "allow_call": bool(u["allow_call"]), "allow_whatsapp": bool(u["allow_whatsapp"])}
    if self_view:
        out.update({"phone": u["phone"], "district": u["district"], "village": u["village"],
                    "lang": u["lang"], "alert_cats": (u["alert_cats"] or "").split(","),
                    "alert_radius": u["alert_radius"]})
    elif u["allow_call"] or u["allow_whatsapp"]:
        out["phone"] = "+91" + u["phone"]      # consented contact only
    return out


@app.get("/api/me")
@require_auth
def me():
    return jsonify({"user": public_user(g.user, self_view=True)})


@app.patch("/api/me")
@require_auth
def update_me():
    d = request.get_json(silent=True) or {}
    fields, vals = [], []
    for k, col in [("name", "name"), ("district", "district"), ("village", "village"),
                   ("locality", "locality"), ("lang", "lang"), ("photo", "photo")]:
        if k in d:
            fields.append(col + "=?"); vals.append(str(d[k])[:120])
    for k, col in [("allow_call", "allow_call"), ("allow_whatsapp", "allow_whatsapp")]:
        if k in d:
            fields.append(col + "=?"); vals.append(1 if d[k] else 0)
    if "alert_cats" in d and isinstance(d["alert_cats"], list):
        fields.append("alert_cats=?"); vals.append(",".join(d["alert_cats"])[:200])
    if "alert_radius" in d:
        fields.append("alert_radius=?"); vals.append(int(d["alert_radius"]))
    if not fields:
        return jsonify({"ok": True})
    vals.append(g.user["id"])
    con = D.connect()
    con.execute("UPDATE users SET " + ",".join(fields) + " WHERE id=?", vals)
    con.commit()
    u = D.row_to_dict(con.execute("SELECT * FROM users WHERE id=?", (g.user["id"],)).fetchone())
    con.close()
    return jsonify({"user": public_user(u, self_view=True)})


@app.get("/api/users/<int:uid>")
def public_profile(uid):
    # Was unauthenticated, so one scripted loop over ids harvested every
    # consenting seller's mobile number. Require a session; the number is still
    # only returned when that seller opted in to Call/WhatsApp.
    viewer = current_user()
    if not viewer:
        return err("unauthorized", "Sign in to view seller profiles", 401)
    con = D.connect()
    u = con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not u:
        con.close(); return err("not_found", "No such user", 404)
    ads = con.execute(
        "SELECT * FROM listings WHERE owner_id=? AND status='active' ORDER BY created_at DESC",
        (uid,)).fetchall()
    out = {"user": public_user(D.row_to_dict(u)),
           "listings": [listing_json(con, r) for r in ads]}
    con.close()
    return jsonify(out)


# ------------------------------------------------------------------ listings
def listing_json(con, r, viewer=None):
    _keys = [m["key"] for m in
             con.execute("SELECT key FROM media WHERE listing_id=? ORDER BY ord", (r["id"],))]
    photos = ["/api/media/" + k for k in _keys]
    thumbs = ["/api/media/" + k + "?size=thumb" for k in _keys]
    owner = con.execute("SELECT * FROM users WHERE id=?", (r["owner_id"],)).fetchone()
    try:
        specs = json.loads(r["specs"] or "{}")
    except Exception:
        specs = {}
    return {
        "id": r["id"], "type": r["type"], "category": r["category"], "title": r["title"],
        "desc": r["description"], "price": r["price"], "unit": r["unit"], "qty": r["qty"],
        "specs": specs, "status": r["status"], "reject_reason": r["reject_reason"],
        "views": r["views"], "created_at": r["created_at"],
        "loc": {"district": r["district"], "village": r["village"],
                "locality": r["locality"], "lat": r["lat"], "lon": r["lon"]},
        "photos": photos, "thumbs": thumbs,
        "owner": public_user(D.row_to_dict(owner)),
    }


@app.get("/api/listings")
def list_listings():
    cat = request.args.get("category", "").strip()
    q = request.args.get("q", "").strip()
    typ = request.args.get("type", "").strip()
    # limit=-1 or a huge offset used to dump the whole table: min() alone does
    # not stop a NEGATIVE limit, and SQLite treats LIMIT -1 as "no limit".
    def _int(name, default, lo, hi):
        try: v = int(request.args.get(name, default))
        except (TypeError, ValueError): v = default
        return max(lo, min(v, hi))
    limit = _int("limit", 50, 1, 100)
    offset = _int("offset", 0, 0, 10000)
    sql = "SELECT * FROM listings WHERE status='active'"
    args = []
    if cat and cat != "all":
        sql += " AND category=?"; args.append(cat)
    if typ:
        sql += " AND type=?"; args.append(typ)
    if q:
        sql += " AND (title LIKE ? OR description LIKE ?)"
        args += ["%" + q + "%", "%" + q + "%"]
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    args += [limit, offset]
    con = D.connect()
    rows = con.execute(sql, args).fetchall()
    viewer = current_user()
    hidden = blocked_ids(con, viewer["id"]) if viewer else set()
    out = [listing_json(con, r) for r in rows if r["owner_id"] not in hidden]
    con.close()
    return jsonify({"listings": out})


@app.get("/api/listings/mine")
@require_auth
def my_listings():
    con = D.connect()
    rows = con.execute(
        "SELECT * FROM listings WHERE owner_id=? AND status!='deleted' ORDER BY created_at DESC",
        (g.user["id"],)).fetchall()
    out = [listing_json(con, r) for r in rows]
    con.close()
    return jsonify({"listings": out})


@app.get("/api/listings/<int:lid>")
def get_listing(lid):
    con = D.connect()
    r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    if not r or r["status"] == "deleted":
        con.close(); return err("not_found", "Listing not found", 404)
    con.execute("UPDATE listings SET views=views+1 WHERE id=?", (lid,))
    con.commit()
    r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    out = listing_json(con, r)
    con.close()
    return jsonify({"listing": out})


def validate_listing(d, is_wanted):
    errs = {}
    if not str(d.get("title", "")).strip():
        errs["title"] = "required"
    try:
        if int(d.get("price", 0)) <= 0:
            errs["price"] = "required"
    except Exception:
        errs["price"] = "invalid"
    if not str(d.get("desc", "")).strip():
        errs["desc"] = "required"
    if not str(d.get("category", "")).strip():
        errs["category"] = "required"
    loc = d.get("loc") or {}
    has_gps = loc.get("lat") is not None and loc.get("lon") is not None
    has_manual = str(loc.get("district", "")).strip() and str(loc.get("village", "")).strip()
    if not (has_gps or has_manual):
        errs["loc"] = "gps_or_manual_required"      # never require BOTH
    if not is_wanted and not (d.get("photos") or []):
        errs["photos"] = "at_least_one"
    return errs


MAX_DIM = 1600          # stored longest edge
THUMB_DIM = 480         # what the feed actually loads
JPEG_Q = 82


def _process_image(raw):
    """Decode, re-encode, and return (full_jpeg, thumb_jpeg) or (None, None).

    Re-encoding is the security control, not a nicety:
      * it PROVES the bytes are really an image. Previously we trusted the
        data-URL's declared type, so anything could be stored and then served
        back from our own origin.
      * it DROPS ALL METADATA, including EXIF GPS. Phone photos carry the
        coordinates the picture was taken at - publishing a farmer's home
        location alongside their livestock is a safety problem, not a privacy
        footnote.
      * it applies EXIF orientation first, so portrait photos stop arriving
        sideways.
    """
    from io import BytesIO
    try:
        from PIL import Image, ImageOps
    except Exception:                                    # noqa: BLE001
        return None, None
    try:
        im = Image.open(BytesIO(raw))
        im.verify()                                      # structural check
        im = Image.open(BytesIO(raw))                    # verify() exhausts it
        im = ImageOps.exif_transpose(im)                 # honour rotation
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")

        full = im.copy()
        full.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
        fb = BytesIO()
        full.save(fb, "JPEG", quality=JPEG_Q, optimize=True)

        th = im.copy()
        th.thumbnail((THUMB_DIM, THUMB_DIM), Image.LANCZOS)
        tb = BytesIO()
        th.save(tb, "JPEG", quality=78, optimize=True)
        return fb.getvalue(), tb.getvalue()
    except Exception:                                    # noqa: BLE001
        return None, None                                # not a real image


def save_photos(con, listing_id, owner_id, photos):
    """photos: data: URLs, or /api/media/<key> paths for images already stored."""
    con.execute("DELETE FROM media WHERE listing_id=?", (listing_id,))
    for i, p in enumerate(photos[:6]):
        p = str(p)
        if p.startswith("/api/media/"):
            key = p.rsplit("/", 1)[-1].split("?")[0]
            if not re.match(r"^[A-Za-z0-9_.-]+$", key):
                continue
            con.execute("INSERT INTO media(listing_id,owner_id,key,kind,ord,created_at) "
                        "VALUES(?,?,?,'photo',?,?)", (listing_id, owner_id, key, i, D.now()))
            continue
        m = re.match(r"^data:image/[A-Za-z0-9.+-]+;base64,(.+)$", p, re.I)
        if not m:
            continue
        try:
            raw = base64.b64decode(m.group(1), validate=True)
        except Exception:                                # noqa: BLE001
            continue
        if len(raw) > MAX_UPLOAD:
            continue
        full, thumb = _process_image(raw)
        if not full:
            continue                                     # rejected: not an image
        key = "%d_%s.jpg" % (listing_id, secrets.token_hex(6))   # immutable key
        with open(os.path.join(D.UPLOADS, key), "wb") as fh:
            fh.write(full)
        with open(os.path.join(D.UPLOADS, _thumb_key(key)), "wb") as fh:
            fh.write(thumb)
        con.execute("INSERT INTO media(listing_id,owner_id,key,kind,ord,created_at) "
                    "VALUES(?,?,?,'photo',?,?)", (listing_id, owner_id, key, i, D.now()))


def _thumb_key(key):
    base, _, ext = key.rpartition(".")
    return "%s_t.%s" % (base or key, ext or "jpg")


@app.post("/api/listings")
@require_auth
def create_listing():
    d = request.get_json(silent=True) or {}
    is_wanted = d.get("type") == "wanted"
    errs = validate_listing(d, is_wanted)
    if errs:
        return jsonify({"error": {"code": "validation", "message": "Check the fields",
                                  "fields": errs}}), 422
    loc = d.get("loc") or {}
    now = D.now()
    con = D.connect()
    cur = con.execute(
        "INSERT INTO listings(owner_id,type,category,title,description,price,unit,qty,specs,"
        "district,village,locality,lat,lon,status,created_at,updated_at,approved_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (g.user["id"], "wanted" if is_wanted else "sale", str(d["category"])[:40],
         str(d["title"])[:140], str(d.get("desc", ""))[:4000], int(d["price"]),
         str(d.get("unit", "total"))[:10], int(d.get("qty", 1) or 1),
         json.dumps(d.get("specs") or {})[:2000],
         str(loc.get("district", ""))[:80], str(loc.get("village", ""))[:80],
         str(loc.get("locality", ""))[:160], loc.get("lat"), loc.get("lon"),
         NEW_STATUS, now, now, now if NEW_STATUS == "active" else None))
    lid = cur.lastrowid
    save_photos(con, lid, g.user["id"], d.get("photos") or [])
    if NEW_STATUS == "active":
        notify_new_listing(con, lid, g.user["id"], str(d["category"]), str(d["title"]))
    con.commit()
    r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    out = listing_json(con, r)
    con.close()
    return jsonify({"listing": out}), 201


@app.patch("/api/listings/<int:lid>")
@require_auth
def edit_listing(lid):
    d = request.get_json(silent=True) or {}
    con = D.connect()
    r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    if not r:
        con.close(); return err("not_found", "Listing not found", 404)
    if r["owner_id"] != g.user["id"]:
        con.close(); return err("forbidden", "Not your listing", 403)   # ownership check

    if "status" in d and d["status"] in ("sold", "deleted"):
        con.execute("UPDATE listings SET status=?,updated_at=? WHERE id=?",
                    (d["status"], D.now(), lid))
        con.commit(); con.close()
        return jsonify({"ok": True, "status": d["status"]})

    is_wanted = d.get("type", r["type"]) == "wanted"
    merged = {"title": d.get("title", r["title"]), "price": d.get("price", r["price"]),
              "desc": d.get("desc", r["description"]), "category": d.get("category", r["category"]),
              "loc": d.get("loc") or {"district": r["district"], "village": r["village"],
                                      "lat": r["lat"], "lon": r["lon"]},
              "photos": d.get("photos", ["x"])}
    errs = validate_listing(merged, is_wanted)
    if errs:
        con.close()
        return jsonify({"error": {"code": "validation", "message": "Check the fields",
                                  "fields": errs}}), 422
    loc = merged["loc"]
    # Edits go back to pending for re-review. Same row, SAME ID.
    con.execute(
        "UPDATE listings SET type=?,category=?,title=?,description=?,price=?,unit=?,qty=?,"
        "specs=?,district=?,village=?,locality=?,lat=?,lon=?,status=?,reject_reason='',"
        "updated_at=? WHERE id=?",
        ("wanted" if is_wanted else "sale", str(merged["category"])[:40], str(merged["title"])[:140],
         str(merged["desc"])[:4000], int(merged["price"]), str(d.get("unit", r["unit"]))[:10],
         int(d.get("qty", r["qty"]) or 1), json.dumps(d.get("specs") or {})[:2000],
         str(loc.get("district", ""))[:80], str(loc.get("village", ""))[:80],
         str(loc.get("locality", ""))[:160], loc.get("lat"), loc.get("lon"),
         NEW_STATUS, D.now(), lid))
    if "photos" in d:
        save_photos(con, lid, g.user["id"], d.get("photos") or [])
    con.commit()
    r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    out = listing_json(con, r)
    con.close()
    return jsonify({"listing": out})


@app.delete("/api/listings/<int:lid>")
@require_auth
def delete_listing(lid):
    con = D.connect()
    r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    if not r:
        con.close(); return err("not_found", "Listing not found", 404)
    if r["owner_id"] != g.user["id"]:
        con.close(); return err("forbidden", "Not your listing", 403)
    con.execute("UPDATE listings SET status='deleted',updated_at=? WHERE id=?", (D.now(), lid))
    con.commit(); con.close()
    return jsonify({"ok": True})


@app.get("/api/media/<key>")
def media(key):
    if not re.match(r"^[A-Za-z0-9_.-]+$", key) or ".." in key:
        return err("bad_key", "Bad key", 400)
    # ?size=thumb serves the small copy - the feed should never pull full-size
    # photos over a 2G connection.
    if request.args.get("size") == "thumb":
        tk = _thumb_key(key)
        if os.path.exists(os.path.join(D.UPLOADS, tk)):
            key = tk
    resp = send_from_directory(D.UPLOADS, key)
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    # Everything we store is re-encoded JPEG; say so and forbid sniffing, so a
    # stored file can never be interpreted as script on our own origin.
    resp.headers["Content-Type"] = "image/jpeg"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Content-Disposition"] = "inline"
    return resp


# ------------------------------------------------------- trust & safety
REPORT_REASONS = ("scam", "fake", "offensive", "sold", "other")


@app.post("/api/listings/<int:lid>/report")
@require_auth
def report_listing(lid):
    d = request.get_json(silent=True) or {}
    reason = str(d.get("reason", "")).strip().lower()
    if reason not in REPORT_REASONS:
        return err("bad_reason", "Choose a reason")
    con = D.connect()
    li = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    if not li:
        con.close(); return err("not_found", "Listing not found", 404)
    if li["owner_id"] == g.user["id"]:
        con.close(); return err("own_listing", "That is your own listing", 400)
    try:
        con.execute(
            "INSERT INTO reports(reporter_id,listing_id,reported_user_id,reason,detail,created_at) "
            "VALUES(?,?,?,?,?,?)",
            (g.user["id"], lid, li["owner_id"], reason,
             str(d.get("detail", ""))[:1000], D.now()))
        con.commit()
    except sqlite3.IntegrityError:
        con.close()
        return jsonify({"ok": True, "already": True})   # idempotent, not an error
    con.close()
    return jsonify({"ok": True})


@app.post("/api/users/<int:uid>/block")
@require_auth
def block_user(uid):
    if uid == g.user["id"]:
        return err("self_block", "You cannot block yourself", 400)
    con = D.connect()
    con.execute("INSERT OR IGNORE INTO blocks(blocker_id,blocked_id,created_at) VALUES(?,?,?)",
                (g.user["id"], uid, D.now()))
    con.commit(); con.close()
    return jsonify({"ok": True})


@app.delete("/api/users/<int:uid>/block")
@require_auth
def unblock_user(uid):
    con = D.connect()
    con.execute("DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?", (g.user["id"], uid))
    con.commit(); con.close()
    return jsonify({"ok": True})


def blocked_ids(con, uid):
    """Who this viewer has blocked, AND who has blocked them - blocking must
    cut both ways or the blocked party can still reach the person."""
    rows = con.execute(
        "SELECT blocked_id AS o FROM blocks WHERE blocker_id=? "
        "UNION SELECT blocker_id AS o FROM blocks WHERE blocked_id=?", (uid, uid))
    return {r["o"] for r in rows}


@app.get("/api/admin/reports")
@require_admin
def admin_reports():
    con = D.connect()
    rows = con.execute(
        "SELECT r.*, l.title AS listing_title, u.name AS reporter_name "
        "FROM reports r LEFT JOIN listings l ON l.id=r.listing_id "
        "LEFT JOIN users u ON u.id=r.reporter_id "
        "WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 100").fetchall()
    out = [{"id": r["id"], "listing_id": r["listing_id"], "listing": r["listing_title"],
            "reason": r["reason"], "detail": r["detail"], "at": r["created_at"],
            "reporter": r["reporter_name"] or ("user %s" % r["reporter_id"])} for r in rows]
    con.close()
    return jsonify({"reports": out})


@app.post("/api/admin/reports/<int:rid>/resolve")
@require_admin
def resolve_report(rid):
    d = request.get_json(silent=True) or {}
    action = str(d.get("action", "")).lower()      # remove | suspend | dismiss
    if action not in ("remove", "suspend", "dismiss"):
        return err("bad_action", "Unknown action")
    con = D.connect()
    rep = con.execute("SELECT * FROM reports WHERE id=?", (rid,)).fetchone()
    if not rep:
        con.close(); return err("not_found", "Report not found", 404)
    if action == "remove" and rep["listing_id"]:
        con.execute("UPDATE listings SET status='rejected',reject_reason=?,updated_at=? WHERE id=?",
                    ("Removed after a report: " + rep["reason"], D.now(), rep["listing_id"]))
        notify(con, rep["reported_user_id"], "rejected", listing_id=rep["listing_id"],
               payload={"reason": "Removed after a report"})
    if action == "suspend" and rep["reported_user_id"]:
        con.execute("UPDATE users SET status='suspended' WHERE id=?", (rep["reported_user_id"],))
        con.execute("DELETE FROM sessions WHERE user_id=?", (rep["reported_user_id"],))
        con.execute("UPDATE listings SET status='rejected',updated_at=? WHERE owner_id=? AND status='active'",
                    (D.now(), rep["reported_user_id"]))
    con.execute("UPDATE reports SET status=?,reviewed_by=?,reviewed_at=?,outcome=? WHERE id=?",
                ("dismissed" if action == "dismiss" else "actioned",
                 g.user["id"], D.now(), action, rid))
    con.commit(); con.close()
    return jsonify({"ok": True, "action": action})


# ------------------------------------------------------------------ admin
@app.get("/api/admin/pending")
@require_admin
def admin_pending():
    con = D.connect()
    if MODERATION == "pre":
        rows = con.execute(
            "SELECT * FROM listings WHERE status='pending' ORDER BY created_at").fetchall()
    else:
        # post-moderation: ads are already live, so the queue is a review list
        rows = con.execute(
            "SELECT * FROM listings WHERE status IN ('pending','active') "
            "ORDER BY created_at DESC LIMIT 50").fetchall()
    out = [listing_json(con, r) for r in rows]
    con.close()
    return jsonify({"listings": out})


def notify_new_listing(con, lid, owner_id, category, title):
    """Alert everyone who asked for this category - except the person posting."""
    rows = con.execute(
        "SELECT id, alert_cats FROM users WHERE id!=? AND status='active'", (owner_id,)
    ).fetchall()
    for u in rows:
        cats = [c for c in (u["alert_cats"] or "").split(",") if c]
        if category in cats:
            notify(con, u["id"], "nearby", listing_id=lid,
                   payload={"title": title, "category": category})


def push_to_user(user_id, title, body, url="./", tag=None):
    """Fan a push out to every device this user has registered."""
    if not PUSH.enabled():
        return 0
    con = D.connect()
    rows = con.execute("SELECT endpoint, sub FROM push_subs WHERE user_id=?", (user_id,)).fetchall()
    sent = 0
    for r in rows:
        try:
            sub = json.loads(r["sub"])
        except Exception:
            continue
        ok, detail = PUSH.send(sub, title, body, url, tag)
        if ok:
            sent += 1
        elif detail == "gone":
            # Dead subscription: drop it rather than retrying it forever.
            con.execute("DELETE FROM push_subs WHERE endpoint=?", (r["endpoint"],))
    con.commit(); con.close()
    return sent


def notify(con, user_id, typ, listing_id=None, conv_id=None, payload=None):
    con.execute("INSERT INTO notifications(user_id,type,listing_id,conv_id,payload,created_at) "
                "VALUES(?,?,?,?,?,?)",
                (user_id, typ, listing_id, conv_id, json.dumps(payload or {}), D.now()))
    p = payload or {}
    title = {"message": "New message", "approved": "Ad approved",
             "rejected": "Ad rejected"}.get(typ, "New near you")
    body = p.get("preview") or p.get("title") or p.get("reason") or ""
    try:
        push_to_user(user_id, title, body, "./", tag=typ)
    except Exception:                                # never let push break the write
        pass


@app.post("/api/admin/listings/<int:lid>/approve")
@require_admin
def approve(lid):
    con = D.connect()
    try:
        con.execute("BEGIN IMMEDIATE")
        r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
        if not r:
            con.rollback(); con.close(); return err("not_found", "Listing not found", 404)
        if r["status"] not in ("pending", "active"):
            con.rollback(); con.close()
            return err("already_decided", "Already decided", 409)   # guards double-tap
        if r["status"] == "active" and MODERATION == "pre":
            con.rollback(); con.close()
            return err("already_decided", "Already decided", 409)
        con.execute("UPDATE listings SET status='active',approved_at=?,updated_at=? WHERE id=?",
                    (D.now(), D.now(), lid))
        con.execute("INSERT INTO approval_audit(admin_id,listing_id,decision,reason,created_at) "
                    "VALUES(?,?,'approve','',?)", (g.user["id"], lid, D.now()))
        notify(con, r["owner_id"], "approved", listing_id=lid, payload={"title": r["title"]})
        if MODERATION == "pre":
            notify_new_listing(con, lid, r["owner_id"], r["category"], r["title"])
        con.commit()
    except sqlite3.OperationalError:
        con.rollback(); con.close(); return err("busy", "Try again", 409)
    con.close()
    return jsonify({"ok": True, "status": "active"})


@app.post("/api/admin/listings/<int:lid>/reject")
@require_admin
def reject(lid):
    reason = str((request.get_json(silent=True) or {}).get("reason", "")).strip()
    if not reason:
        return err("reason_required", "A rejection reason is required")
    con = D.connect()
    try:
        con.execute("BEGIN IMMEDIATE")
        r = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
        if not r:
            con.rollback(); con.close(); return err("not_found", "Listing not found", 404)
        if r["status"] not in ("pending", "active"):
            con.rollback(); con.close(); return err("already_decided", "Already decided", 409)
        con.execute("UPDATE listings SET status='rejected',reject_reason=?,updated_at=? WHERE id=?",
                    (reason[:500], D.now(), lid))
        con.execute("INSERT INTO approval_audit(admin_id,listing_id,decision,reason,created_at) "
                    "VALUES(?,?,'reject',?,?)", (g.user["id"], lid, reason[:500], D.now()))
        notify(con, r["owner_id"], "rejected", listing_id=lid,
               payload={"title": r["title"], "reason": reason[:500]})
        con.commit()
    except sqlite3.OperationalError:
        con.rollback(); con.close(); return err("busy", "Try again", 409)
    con.close()
    return jsonify({"ok": True, "status": "rejected"})


# ------------------------------------------------------------------ chat
@app.get("/api/conversations")
@require_auth
def conversations():
    uid = g.user["id"]
    con = D.connect()
    rows = con.execute(
        "SELECT * FROM conversations WHERE buyer_id=? OR seller_id=? ORDER BY created_at DESC",
        (uid, uid)).fetchall()
    out = []
    for c in rows:
        other_id = c["seller_id"] if c["buyer_id"] == uid else c["buyer_id"]
        other = con.execute("SELECT * FROM users WHERE id=?", (other_id,)).fetchone()
        last = con.execute(
            "SELECT * FROM messages WHERE conv_id=? ORDER BY created_at DESC LIMIT 1",
            (c["id"],)).fetchone()
        unread = con.execute(
            "SELECT COUNT(*) n FROM messages WHERE conv_id=? AND sender_id!=? AND read_at IS NULL",
            (c["id"], uid)).fetchone()["n"]
        li = con.execute("SELECT * FROM listings WHERE id=?", (c["listing_id"],)).fetchone()
        out.append({
            "id": c["id"], "listing_id": c["listing_id"],
            "listing": {"title": li["title"], "price": li["price"]} if li else None,
            "other": public_user(D.row_to_dict(other)),          # always the COUNTERPART
            "last": {"body": last["body"], "at": last["created_at"],
                     "mine": last["sender_id"] == uid} if last else None,
            "unread": unread})
    con.close()
    return jsonify({"conversations": out})


@app.post("/api/conversations")
@require_auth
def open_conversation():
    d = request.get_json(silent=True) or {}
    lid = int(d.get("listing_id", 0))
    con = D.connect()
    li = con.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    if not li:
        con.close(); return err("not_found", "Listing not found", 404)
    if li["owner_id"] == g.user["id"]:
        con.close(); return err("self_chat", "That is your own listing", 400)  # no self-chat
    row = con.execute("SELECT * FROM conversations WHERE listing_id=? AND buyer_id=?",
                      (lid, g.user["id"])).fetchone()
    if row:
        cid = row["id"]
    else:
        cur = con.execute(
            "INSERT INTO conversations(listing_id,buyer_id,seller_id,created_at) VALUES(?,?,?,?)",
            (lid, g.user["id"], li["owner_id"], D.now()))
        cid = cur.lastrowid
        con.commit()
    con.close()
    return jsonify({"conversation_id": cid})


def conv_guard(con, cid, uid):
    c = con.execute("SELECT * FROM conversations WHERE id=?", (cid,)).fetchone()
    if not c:
        return None, err("not_found", "Conversation not found", 404)
    if uid not in (c["buyer_id"], c["seller_id"]):
        return None, err("forbidden", "Not your conversation", 403)   # participants only
    return c, None


@app.get("/api/conversations/<int:cid>/messages")
@require_auth
def get_messages(cid):
    uid = g.user["id"]
    con = D.connect()
    c, e = conv_guard(con, cid, uid)
    if e:
        con.close(); return e
    rows = con.execute("SELECT * FROM messages WHERE conv_id=? ORDER BY created_at", (cid,)).fetchall()
    con.execute("UPDATE messages SET read_at=? WHERE conv_id=? AND sender_id!=? AND read_at IS NULL",
                (D.now(), cid, uid))
    con.commit()
    other_id = c["seller_id"] if c["buyer_id"] == uid else c["buyer_id"]
    other = con.execute("SELECT * FROM users WHERE id=?", (other_id,)).fetchone()
    li = con.execute("SELECT * FROM listings WHERE id=?", (c["listing_id"],)).fetchone()
    out = {"messages": [{"id": m["id"], "body": m["body"], "at": m["created_at"],
                         "mine": m["sender_id"] == uid} for m in rows],
           "other": public_user(D.row_to_dict(other)),
           "listing": {"id": li["id"], "title": li["title"], "price": li["price"]} if li else None}
    con.close()
    return jsonify(out)


@app.post("/api/conversations/<int:cid>/messages")
@require_auth
def send_message(cid):
    body = str((request.get_json(silent=True) or {}).get("body", "")).strip()
    if not body:
        return err("empty", "Message is empty")
    uid = g.user["id"]
    con = D.connect()
    c, e = conv_guard(con, cid, uid)
    if e:
        con.close(); return e
    con.execute("INSERT INTO messages(conv_id,sender_id,body,created_at) VALUES(?,?,?,?)",
                (cid, uid, body[:2000], D.now()))
    other_id = c["seller_id"] if c["buyer_id"] == uid else c["buyer_id"]
    notify(con, other_id, "message", conv_id=cid, payload={"preview": body[:60]})
    con.commit(); con.close()
    return jsonify({"ok": True})


# ------------------------------------------------------------------ notifications
@app.get("/api/notifications")
@require_auth
def notifications():
    con = D.connect()
    rows = con.execute(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 60",
        (g.user["id"],)).fetchall()
    out = []
    for n in rows:
        try:
            payload = json.loads(n["payload"] or "{}")
        except Exception:
            payload = {}
        out.append({"id": n["id"], "type": n["type"], "listing_id": n["listing_id"],
                    "conv_id": n["conv_id"], "payload": payload,
                    "at": n["created_at"], "unread": n["read_at"] is None})
    con.close()
    return jsonify({"notifications": out})


@app.post("/api/notifications/read")
@require_auth
def mark_read():
    con = D.connect()
    con.execute("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL",
                (D.now(), g.user["id"]))
    con.commit(); con.close()
    return jsonify({"ok": True})


# ------------------------------------------------------------------ ops
@app.get("/api/push/key")
def push_key():
    return jsonify({"key": PUSH.public_key(), "enabled": PUSH.enabled()})


@app.post("/api/push/subscribe")
@require_auth
def push_subscribe():
    sub = request.get_json(silent=True) or {}
    ep = sub.get("endpoint")
    if not ep:
        return err("bad_subscription", "Missing endpoint")
    con = D.connect()
    con.execute(
        "INSERT INTO push_subs(user_id,endpoint,sub,created_at) VALUES(?,?,?,?) "
        "ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, sub=excluded.sub",
        (g.user["id"], ep, json.dumps(sub), D.now()))
    con.commit(); con.close()
    return jsonify({"ok": True})


@app.post("/api/push/unsubscribe")
@require_auth
def push_unsubscribe():
    ep = (request.get_json(silent=True) or {}).get("endpoint", "")
    con = D.connect()
    con.execute("DELETE FROM push_subs WHERE endpoint=? AND user_id=?", (ep, g.user["id"]))
    con.commit(); con.close()
    return jsonify({"ok": True})


@app.post("/api/push/test")
@require_auth
def push_test():
    n = push_to_user(g.user["id"], "Namma Santhai", "Push is working on this device.", "./")
    return jsonify({"ok": n > 0, "sent_to_devices": n,
                    "note": "accepted by the push service; not a delivery receipt"})


@app.delete("/api/me")
@require_auth
def delete_me():
    """Really delete the account and everything attached to it (DPDP erasure).

    Previously the UI offered 'Delete my account' and the server had no such
    route - it only cleared localStorage, so the account and all its data
    stayed on the server. That is a lie told to the user and a legal problem.
    """
    uid = g.user["id"]
    con = D.connect()
    try:
        con.execute("BEGIN IMMEDIATE")
        # remove uploaded files from disk, not just their rows
        for m in con.execute("SELECT key FROM media WHERE owner_id=?", (uid,)).fetchall():
            for k in (m["key"], _thumb_key(m["key"])):
                try:
                    os.remove(os.path.join(D.UPLOADS, k))
                except OSError:
                    pass
        convs = [r["id"] for r in con.execute(
            "SELECT id FROM conversations WHERE buyer_id=? OR seller_id=?", (uid, uid))]
        if convs:
            qs = ",".join("?" * len(convs))
            con.execute("DELETE FROM messages WHERE conv_id IN (%s)" % qs, convs)
            con.execute("DELETE FROM conversations WHERE id IN (%s)" % qs, convs)
        con.execute("DELETE FROM messages WHERE sender_id=?", (uid,))
        con.execute("DELETE FROM media WHERE owner_id=?", (uid,))
        con.execute("DELETE FROM listings WHERE owner_id=?", (uid,))
        con.execute("DELETE FROM notifications WHERE user_id=?", (uid,))
        con.execute("DELETE FROM push_subs WHERE user_id=?", (uid,))
        con.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
        con.execute("DELETE FROM otps WHERE phone=?", (g.user["phone"],))
        con.execute("DELETE FROM users WHERE id=?", (uid,))
        con.commit()
    except Exception:                                    # noqa: BLE001
        con.rollback(); con.close()
        return err("delete_failed", "Could not delete the account", 500)
    con.close()
    return jsonify({"ok": True, "deleted": True})


@app.get("/api/me/export")
@require_auth
def export_me():
    """DPDP access right: hand the user everything held about them."""
    uid = g.user["id"]
    con = D.connect()
    out = {"account": public_user(g.user, self_view=True), "listings": [], "messages": [], "notifications": []}
    for r in con.execute("SELECT * FROM listings WHERE owner_id=?", (uid,)):
        out["listings"].append(listing_json(con, r))
    for m in con.execute(
        "SELECT m.body, m.created_at FROM messages m WHERE m.sender_id=? ORDER BY m.created_at", (uid,)):
        out["messages"].append({"body": m["body"], "at": m["created_at"]})
    for n in con.execute("SELECT type,payload,created_at FROM notifications WHERE user_id=?", (uid,)):
        out["notifications"].append({"type": n["type"], "payload": n["payload"], "at": n["created_at"]})
    con.close()
    return jsonify(out)


@app.get("/api/health")
def health():
    con = D.connect()
    counts = {t: con.execute("SELECT COUNT(*) n FROM " + t).fetchone()["n"]
              for t in ("users", "listings", "messages", "notifications")}
    con.close()
    up = int(time.time()) - STATS["started_at"]
    return jsonify({"ok": True, "trial": True, "counts": counts,
                    "uptime_s": up,
                    "requests": STATS["requests"],
                    "errors": STATS["errors"],
                    "rate_limited": STATS["rate_limited"],
                    "auth_mode": AUTH_MODE, "moderation": MODERATION,
                    "admin_secret_set": bool(ADMIN_SECRET),
                    "otp_required": AUTH_MODE != "open",
                    # With auth_mode=open nothing can send an SMS at all.
                    "sms": {"disabled": True} if AUTH_MODE == "open" else SMS.status()})


if __name__ == "__main__":
    D.init()
    port = int(os.environ.get("NS_PORT", "8105"))
    host = os.environ.get("NS_HOST", "127.0.0.1")
    app.run(host=host, port=port, threaded=True)
