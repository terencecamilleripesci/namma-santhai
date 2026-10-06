# Namma Santhai — TEMPORARY trial backend

Real accounts, sessions, listings, photos, admin approval, chat and
notifications, persisted to **one sqlite file**. Built so the company can test a
production-shaped flow — and so it can be switched off and deleted in one move.

> This is a **trial** backend, not production. Single process, no HTTPS of its
> own, OTP in demo mode by default. See "What's still missing" at the bottom.

---

## Start / stop (the only two commands you need)

```bash
bash server/START.sh          # start  (127.0.0.1:8105)
bash server/STOP.sh           # stop - ACCOUNTS AND LISTINGS ARE KEPT
bash server/AUTOSTART.sh on   # keep it running across reboots (currently ON)
bash server/AUTOSTART.sh off  # remove the autostart unit
```

**Accounts persist.** Data lives in `data/namma.db` and survives stop/start,
restarts and reboots. Signing in with the same phone number returns the SAME
account - testers never need to re-register because of a deploy.

Erasing now needs saying so twice, and takes a backup first:

```bash
bash server/STOP.sh --wipe --yes-delete-all-accounts   # backup -> server/backups/
```

A bare `--wipe` is REFUSED. A stray `--wipe` during a deploy is exactly how
testers lost their accounts.

A **user-level** systemd unit (`~/.config/systemd/user/namma-santhai.service`)
keeps it alive across reboots. It is scoped to this project, touches nothing
else on the Pi, and `AUTOSTART.sh off` removes it. To remove the backend
completely: `AUTOSTART.sh off`, then delete the `server/` folder.

Everything it creates lives in `server/data/` (db + uploaded photos). Nothing is
written anywhere else on the Pi.

| | |
|---|---|
| Port | `8105` (nothing else was using it) |
| Binds to | `127.0.0.1` only — not reachable from outside until you expose it |
| Data | `server/data/namma.db` + `server/data/uploads/` |
| Log | `server/server.log` |

### Admin account

**The admin number is NOT written down in this repo, and must never be.**
Sign-in is a phone number with no verification, so a phone number is not a
credential: anyone who reads it can become that user. An admin number WAS
committed here once and had to be revoked - do not reintroduce it.

Admin now needs TWO things: the number must be in `NS_ADMIN_PHONES`, AND the
sign-in must present `NS_ADMIN_SECRET`. Without the secret the account signs in
as a normal user. If no secret is configured, **nobody** gets admin - it fails
closed on purpose.

Put both in `server/admin.env`, which is gitignored:

```
NS_ADMIN_PHONES=<the admin mobile number>
NS_ADMIN_SECRET=<a long random string>
```

Then `bash server/START.sh` (it sources that file if present).

> This is a stop-gap for the trial. The real fix is switching `NS_AUTH_MODE=otp`
> with a real Indian SMS provider - the OTP code is already written and tested.
> See PRODUCTION-AUDIT.md S1.

---

## OTP: demo now, GSM only on your word

`NS_OTP_MODE` controls delivery:

> **Current setting: OTP is OFF.** `NS_AUTH_MODE=open` (the default) means sign
> in is a phone number only - no code, no password, and **nothing can send an
> SMS at all**. The table below applies only with `NS_AUTH_MODE=otp`.

| mode | behaviour |
|---|---|
| `demo` **(default)** | code is returned to the screen, clearly labelled. **No SMS leaves the Pi. No cost.** |
| `gsm` | hands the message to the existing `sms_queue.jsonl` seam |

**GSM is OFF and stays off until you say.** When it is switched on, `sms.py`
enforces these rules and *refuses to send* rather than guess:

- the sending line is chosen **by identity**, never by SIM slot/position
- `NS_GSM_FROM` must equal `NS_GSM_BUSINESS_MSISDN`, or it refuses
- the number is never printed into logs or API responses (masked)
- it logs `queued`, **never** `sent` — handing a message to the queue is not
  proof of delivery, only the sender daemon can observe that

It writes to the queue file and touches nothing else, so your business SMS path
is not modified. To turn it on later (deliberately):

```bash
NS_OTP_MODE=gsm \
NS_SMS_QUEUE=/path/to/sms_queue.jsonl \
NS_GSM_BUSINESS_MSISDN=<business line> \
NS_GSM_FROM=<same business line> \
bash server/START.sh
```

To turn it back off: stop, and start again without those variables.

> Note: trial numbers are Indian (+91). Real SMS to India costs money per
> message. Keep `demo` unless you are deliberately testing delivery.

---

## API

Auth is a bearer token: `Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/request-otp` | `{phone}` 10-digit. 30s cooldown, 8/hour cap. Returns `demo_code` in demo mode |
| POST | `/api/auth/verify` | `{phone, code}` → `{token, user}`. Single-use, 5 min expiry, 5 attempts |
| POST | `/api/auth/logout` | revokes the session |
| GET/PATCH | `/api/me` | own profile, contact consent, alert prefs |
| GET | `/api/users/<id>` | public profile — phone only if consented |
| GET | `/api/listings` | active feed; `?category=&q=&type=&limit=&offset=` |
| GET | `/api/listings/mine` | own listings, every status |
| GET | `/api/listings/<id>` | detail (increments views) |
| POST | `/api/listings` | create → **status `pending`** |
| PATCH | `/api/listings/<id>` | edit (same ID, back to `pending`) or `{status:"sold"}` |
| DELETE | `/api/listings/<id>` | soft delete, owner only |
| GET | `/api/media/<key>` | uploaded photo, immutable key |
| GET | `/api/admin/pending` | **admin only** |
| POST | `/api/admin/listings/<id>/approve` | atomic, 409 on double-tap |
| POST | `/api/admin/listings/<id>/reject` | **reason required** |
| GET/POST | `/api/conversations` | list / open (no self-chat) |
| GET/POST | `/api/conversations/<id>/messages` | participants only |
| GET | `/api/notifications` · POST `/api/notifications/read` | |
| GET | `/api/health` | counts + OTP mode |

Errors are typed JSON (`{"error":{"code","message"}}`) with real HTTP statuses —
never raw HTML, so the client can translate them.

---

## What it enforces (all covered by the test suite, 43/43 passing)

- identity comes from the **session**, never from `request.body.owner_id`
- OTP stored **hashed**, single-use, expiring, attempt- and rate-limited
- phone is **private by default**; exposed only with explicit Call/WhatsApp consent
- ownership checks on edit / delete / mark-sold
- admin role enforced **server-side** — a normal user gets 403 on the queue and on approve
- approve/reject are atomic (`BEGIN IMMEDIATE`) and 409 on a second decision
- edits keep the **same listing ID** and return to `pending`
- pending/rejected/sold listings are **not** in the public feed
- conversations readable only by their two participants; self-chat blocked
- GPS **or** manual location accepted — never both required
- rejection reason is mandatory and travels to the seller as a notification

---

## Live trial URLs (as of 5 Oct 2026)

| | |
|---|---|
| **Give the client this** | `https://terencecamilleripesci.github.io/namma-santhai/?api=https://raspberrypi.silverside-tench.ts.net:8443/nsapi` |
| Backend (public) | `https://raspberrypi.silverside-tench.ts.net:8443/nsapi` |
| Admin sign-in | see `server/admin.env` (not in this repo) |

The `?api=` part matters. Without it the app runs offline on the phone and
nothing is shared between people.

> **Tailscale Funnel only works on ports 443, 8443 and 10000.** Any other port
> will say "Funnel on" in status but silently never serve publicly - that is
> why this sits on a PATH of 8443 (`/nsapi`) rather than its own port. Use
> `funnel --set-path`, never `serve --set-path`, which drops the port to
> tailnet-only and takes live sites down.

Turn public access off:  `tailscale funnel --https=8443 --set-path /nsapi off`

---

## What's still missing before this is production

1. ~~HTTPS + a public URL~~ - done, see above.
2. **Real SMS OTP** — currently demo. See the GSM section.
3. **Backups.** One sqlite file, no replication. `data/` is gitignored.
4. **Rate limiting per IP** (only per-phone today) and abuse/report tooling.
5. **DPDP compliance**: consent record and an account-deletion path.
6. **Image pipeline**: originals are stored as uploaded; no resizing/variants.
7. Single process — fine for a trial, not for load.
