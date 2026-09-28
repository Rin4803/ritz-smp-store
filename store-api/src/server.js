import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { ranks, platformValues } from './config.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const dbPath = process.env.DB_PATH || './data/ritz-store.db';
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || 168);
const bridgeSecret = process.env.RITZ_BRIDGE_SECRET || '';

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE, username TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, platform TEXT NOT NULL DEFAULT 'unknown', current_rank TEXT NOT NULL DEFAULT 'None');
CREATE TABLE IF NOT EXISTS link_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, player_uuid TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, FOREIGN KEY(player_uuid) REFERENCES players(uuid) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, player_uuid TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, FOREIGN KEY(player_uuid) REFERENCES players(uuid) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS wallet_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, player_uuid TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, reference TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL, FOREIGN KEY(player_uuid) REFERENCES players(uuid) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price_thb INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL, benefits_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, player_uuid TEXT NOT NULL, product_id TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT, failure_reason TEXT, FOREIGN KEY(player_uuid) REFERENCES players(uuid), FOREIGN KEY(product_id) REFERENCES products(id));
CREATE TABLE IF NOT EXISTS delivery_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL UNIQUE, player_uuid TEXT NOT NULL, command TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'queued', last_error TEXT, updated_at TEXT NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
`);

for (const r of ranks) {
  db.prepare(`INSERT INTO products (id,name,category,price_thb,description,benefits_json,sort_order) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,price_thb=excluded.price_thb,description=excluded.description,benefits_json=excluded.benefits_json,sort_order=excluded.sort_order`).run(r.id, r.name, 'rank', r.price, `ยศ ${r.name} สำหรับ RitzSMP`, JSON.stringify(r.benefits), ranks.indexOf(r));
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '32kb' }));

const now = () => new Date().toISOString();
const addHours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const randomCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

function bridgeAuth(req, res, next) {
  if (!bridgeSecret || req.get('x-ritz-bridge-secret') !== bridgeSecret) return res.status(401).json({ error: 'bridge_unauthorized' });
  next();
}

function auth(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'login_required' });
  const row = db.prepare(`SELECT s.*, p.username, p.uuid, p.platform, p.current_rank FROM sessions s JOIN players p ON p.uuid=s.player_uuid WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`).get(hash(token), now());
  if (!row) return res.status(401).json({ error: 'session_expired' });
  req.player = row;
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'ritzsmp-store-api', time: now() }));

app.get('/api/products', (_req, res) => {
  const products = db.prepare(`SELECT id,name,category,price_thb AS price,description,benefits_json FROM products WHERE active=1 ORDER BY sort_order`).all().map(p => ({ ...p, benefits: JSON.parse(p.benefits_json) }));
  res.json({ products });
});

// Called by the Minecraft server/plugin when a player joins. This is what makes
// the rule "must have played RitzSMP before" enforceable: a web-only name is not enough.
app.post('/bridge/player-seen', bridgeAuth, (req, res) => {
  const { uuid, username, platform = 'unknown' } = req.body || {};
  if (!uuid || !username || !platformValues.has(platform)) return res.status(400).json({ error: 'invalid_player' });
  const timestamp = now();
  db.prepare(`INSERT INTO players(uuid,username,first_seen_at,last_seen_at,platform) VALUES(?,?,?,?,?) ON CONFLICT(uuid) DO UPDATE SET username=excluded.username,last_seen_at=excluded.last_seen_at,platform=excluded.platform`).run(uuid, username, timestamp, timestamp, platform);
  res.json({ ok: true, player: { uuid, username, platform } });
});

// The plugin issues this code in-game after confirming the player exists in RitzSMP.
app.post('/bridge/link-code', bridgeAuth, (req, res) => {
  const { uuid } = req.body || {};
  const player = db.prepare('SELECT uuid,username FROM players WHERE uuid=?').get(uuid);
  if (!player) return res.status(404).json({ error: 'player_not_seen_on_server' });
  const code = randomCode();
  db.prepare('INSERT INTO link_codes(code,player_uuid,expires_at) VALUES(?,?,?)').run(code, uuid, addHours(0.1667));
  res.json({ code, expiresAt: addHours(0.1667), username: player.username });
});

app.post('/api/auth/link', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const row = db.prepare(`SELECT l.*,p.username,p.uuid,p.platform,p.current_rank FROM link_codes l JOIN players p ON p.uuid=l.player_uuid WHERE l.code=? AND l.used_at IS NULL AND l.expires_at>?`).get(code, now());
  if (!row) return res.status(400).json({ error: 'invalid_or_expired_code' });
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('UPDATE link_codes SET used_at=? WHERE id=?').run(now(), row.id);
  db.prepare('INSERT INTO sessions(token_hash,player_uuid,created_at,expires_at) VALUES(?,?,?,?)').run(hash(token), row.uuid, now(), addHours(sessionTtlHours));
  res.json({ token, expiresAt: addHours(sessionTtlHours), player: { uuid: row.uuid, username: row.username, platform: row.platform, rank: row.current_rank } });
});

app.get('/api/me', auth, (req, res) => {
  const wallet = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type IN ('credit','refund','adjustment') THEN amount ELSE -amount END),0) AS balance FROM wallet_ledger WHERE player_uuid=?`).get(req.player.uuid).balance;
  const orders = db.prepare(`SELECT o.id,o.amount,o.status,o.created_at,o.delivered_at,p.name AS product FROM orders o JOIN products p ON p.id=o.product_id WHERE o.player_uuid=? ORDER BY o.created_at DESC LIMIT 20`).all(req.player.uuid);
  res.json({ player: { uuid:req.player.uuid, username:req.player.username, platform:req.player.platform, rank:req.player.current_rank }, wallet, orders });
});

app.post('/api/logout', auth, (req, res) => {
  const token = req.get('authorization').replace(/^Bearer\s+/i, '');
  db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').run(now(), hash(token));
  res.json({ ok: true });
});

// Purchase intentionally stays server-side. The browser never decides its own price or player UUID.
app.post('/api/orders', auth, (req, res) => {
  const productId = String(req.body?.productId || '');
  const product = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(productId);
  if (!product) return res.status(404).json({ error: 'product_not_found' });
  const balance = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type IN ('credit','refund','adjustment') THEN amount ELSE -amount END),0) AS balance FROM wallet_ledger WHERE player_uuid=?`).get(req.player.uuid).balance;
  if (balance < product.price_thb) return res.status(400).json({ error: 'insufficient_wallet', balance, required: product.price_thb });
  const orderId = `RZ-${nanoid(10).toUpperCase()}`;
  const created = now();
  const command = `ritzstore deliver ${req.player.uuid} ${product.id} ${orderId}`;
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO orders(id,player_uuid,product_id,amount,status,created_at) VALUES(?,?,?,?,?,?)').run(orderId, req.player.uuid, product.id, product.price_thb, 'pending', created);
    db.prepare(`INSERT INTO wallet_ledger(player_uuid,type,amount,reference,note,created_at) VALUES(?,?,?,?,?,?)`).run(req.player.uuid,'debit',product.price_thb,orderId,`ซื้อ ${product.name}`,created);
    db.prepare('INSERT INTO delivery_queue(order_id,player_uuid,command,updated_at) VALUES(?,?,?,?)').run(orderId,req.player.uuid,command,created);
  });
  tx();
  res.status(201).json({ order: { id: orderId, product: product.name, amount: product.price_thb, status:'pending', createdAt:created } });
});

// Minecraft-side worker calls this to fetch pending deliveries for the verified player.
app.get('/bridge/delivery', bridgeAuth, (req, res) => {
  const rows = db.prepare(`SELECT id,order_id,player_uuid,command,attempts FROM delivery_queue WHERE status='queued' ORDER BY id LIMIT 50`).all();
  res.json({ deliveries: rows });
});

app.post('/bridge/delivery/:orderId', bridgeAuth, (req, res) => {
  const order = db.prepare('SELECT id,player_uuid,status FROM orders WHERE id=?').get(req.params.orderId);
  if (!order) return res.status(404).json({ error:'order_not_found' });
  if (order.status === 'delivered') return res.json({ ok:true, status:'delivered' });
  const success = req.body?.success === true;
  const timestamp = now();
  if (success) {
    const tx = db.transaction(() => {
      db.prepare(`UPDATE orders SET status='delivered',delivered_at=? WHERE id=?`).run(timestamp, order.id);
      db.prepare(`UPDATE delivery_queue SET status='sent',attempts=attempts+1,updated_at=? WHERE order_id=?`).run(timestamp, order.id);
    });
    tx();
  } else {
    db.prepare(`UPDATE delivery_queue SET status='queued',attempts=attempts+1,last_error=?,updated_at=? WHERE order_id=?`).run(String(req.body?.error || 'delivery_failed'),timestamp,order.id);
    db.prepare(`UPDATE orders SET status='processing',failure_reason=? WHERE id=?`).run(String(req.body?.error || 'delivery_failed'),order.id);
  }
  res.json({ ok:true, status:success?'delivered':'queued' });
});

app.listen(port, () => console.log(`RitzSMP Store API listening on :${port}`));
