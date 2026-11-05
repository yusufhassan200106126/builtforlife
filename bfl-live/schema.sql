-- Built For Life: database tables (Cloudflare D1)
-- Run once:  npx wrangler d1 execute bfl --remote --file=schema.sql

-- Every piece of app data (sign-ups, payments, workouts, check-ins, messages,
-- food logs, Jory's exercise library and templates) is one row here.
CREATE TABLE IF NOT EXISTS records (
  coll    TEXT NOT NULL,             -- leads, orders, events, workouts, checkins, messages, food, library, templates, settings
  id      TEXT NOT NULL,
  owner   TEXT,                      -- the client (lead id) it belongs to; NULL = coach-only / shared
  email   TEXT,                      -- leads only, lower case, for logging in
  d       TEXT,                      -- a date for trimming old rows from the coach's load
  data    TEXT,                      -- the JSON record (photos are stored in R2, not here)
  seq     INTEGER NOT NULL,          -- change number, used for live updates
  deleted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER,
  PRIMARY KEY (coll, id)
);
CREATE INDEX IF NOT EXISTS rec_seq   ON records(seq);
CREATE INDEX IF NOT EXISTS rec_owner ON records(owner, seq);
CREATE INDEX IF NOT EXISTS rec_email ON records(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, role TEXT NOT NULL, email TEXT NOT NULL,
  lead TEXT, leads TEXT, created INTEGER, expires INTEGER
);
CREATE TABLE IF NOT EXISTS codes (
  email TEXT NOT NULL, role TEXT NOT NULL, hash TEXT NOT NULL,
  expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, role)
);
CREATE TABLE IF NOT EXISTS typing (who TEXT NOT NULL, lead TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (who, lead));
CREATE TABLE IF NOT EXISTS ratelimit (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lead_tokens (lead TEXT PRIMARY KEY, token TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL);
-- checkouts that have been started but not paid yet (they only become orders once Stripe confirms)
CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY, session TEXT, data TEXT NOT NULL, created INTEGER);
CREATE INDEX IF NOT EXISTS pending_session ON pending(session);
-- when each client last had the portal open (for "stopped responding" and email alerts)
CREATE TABLE IF NOT EXISTS presence (lead TEXT PRIMARY KEY, at INTEGER NOT NULL);
-- phones / browsers that turned on notifications
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, role TEXT, email TEXT, lead TEXT, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created INTEGER);
CREATE INDEX IF NOT EXISTS push_lead ON push_subs(lead);
-- keys the site makes for itself (push notifications)
CREATE TABLE IF NOT EXISTS secrets (k TEXT PRIMARY KEY, v TEXT NOT NULL);
