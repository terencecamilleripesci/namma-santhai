"""Namma Santhai — temporary trial backend: schema + helpers.

Everything lives in ONE sqlite file (data/namma.db) and ONE uploads dir,
both inside this folder, so the whole backend can be deleted in one move.
"""
import os, sqlite3, secrets, time, hashlib

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
UPLOADS = os.path.join(DATA, "uploads")
DB_PATH = os.path.join(DATA, "namma.db")

os.makedirs(UPLOADS, exist_ok=True)

SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  name TEXT DEFAULT '',
  photo TEXT,
  district TEXT DEFAULT '',
  village TEXT DEFAULT '',
  locality TEXT DEFAULT '',
  lat REAL, lon REAL,
  lang TEXT DEFAULT 'en',
  allow_call INTEGER NOT NULL DEFAULT 0,
  allow_whatsapp INTEGER NOT NULL DEFAULT 0,
  alert_cats TEXT DEFAULT 'goat',
  alert_radius INTEGER DEFAULT 25,
  role TEXT NOT NULL DEFAULT 'user',       -- user | admin
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- OTP is stored HASHED, never plaintext.
CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL,
  send_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'sale',        -- sale | wanted
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'total',
  qty INTEGER DEFAULT 1,
  specs TEXT DEFAULT '{}',
  district TEXT DEFAULT '', village TEXT DEFAULT '', locality TEXT DEFAULT '',
  lat REAL, lon REAL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending|active|rejected|sold|deleted
  reject_reason TEXT DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  approved_at INTEGER,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_listings_feed ON listings(status, category, created_at);
CREATE INDEX IF NOT EXISTS ix_listings_owner ON listings(owner_id, status);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'photo',
  ord INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(listing_id) REFERENCES listings(id)
);
CREATE INDEX IF NOT EXISTS ix_media_listing ON media(listing_id, ord);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  FOREIGN KEY(conv_id) REFERENCES conversations(id)
);
CREATE INDEX IF NOT EXISTS ix_messages_conv ON messages(conv_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,                        -- approved|rejected|message|nearby
  listing_id INTEGER, conv_id INTEGER,
  payload TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications(user_id, read_at, created_at);

CREATE TABLE IF NOT EXISTS approval_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  listing_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  sub TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_push_user ON push_subs(user_id);

-- Trust & safety. A marketplace without a way to report a listing or block a
-- person is not shippable: it is a Play policy requirement for user content,
-- and on a livestock market where advance-payment fraud is the number one scam
-- it is the only lever a victim has.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  listing_id INTEGER,
  reported_user_id INTEGER,
  reason TEXT NOT NULL,                      -- scam|fake|offensive|sold|other
  detail TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',       -- open|actioned|dismissed
  reviewed_by INTEGER, reviewed_at INTEGER, outcome TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(reporter_id, listing_id)            -- one report per person per ad
);
CREATE INDEX IF NOT EXISTS ix_reports_status ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- outbound OTP log: proves what we ATTEMPTED and what actually happened.
CREATE TABLE IF NOT EXISTS sms_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  mode TEXT NOT NULL,                        -- demo | gsm
  result TEXT NOT NULL,                      -- queued | sent | failed | shown_on_screen
  detail TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
"""


def now():
    return int(time.time())


def connect():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def init():
    con = connect()
    con.executescript(SCHEMA)
    con.commit()
    con.close()


def hash_code(phone, code):
    """OTP is never stored in plaintext."""
    return hashlib.sha256((phone + "|" + str(code)).encode()).hexdigest()


def new_token():
    return secrets.token_urlsafe(32)


def row_to_dict(r):
    return dict(r) if r is not None else None
