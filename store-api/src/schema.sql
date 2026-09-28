PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown' CHECK(platform IN ('java','bedrock','unknown')),
  current_rank TEXT NOT NULL DEFAULT 'None'
);

CREATE TABLE IF NOT EXISTS link_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  player_uuid TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY(player_uuid) REFERENCES players(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  player_uuid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY(player_uuid) REFERENCES players(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_uuid TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('credit','debit','refund','adjustment')),
  amount INTEGER NOT NULL,
  reference TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(player_uuid) REFERENCES players(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_thb INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  benefits_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  player_uuid TEXT NOT NULL,
  product_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','processing','delivered','failed','refunded')),
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  failure_reason TEXT,
  FOREIGN KEY(player_uuid) REFERENCES players(uuid),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS delivery_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  player_uuid TEXT NOT NULL,
  command TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed')),
  last_error TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_player ON orders(player_uuid);
CREATE INDEX IF NOT EXISTS idx_ledger_player ON wallet_ledger(player_uuid);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_queue(status);
