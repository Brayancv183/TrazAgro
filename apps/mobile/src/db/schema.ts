import type { SQLiteDatabase } from "expo-sqlite";
import { seedDemo, seedDemoV5 } from "./seed";

const DATABASE_VERSION = 6;

/** Runs before the app renders (SQLiteProvider onInit). Each block upgrades one version. */
export async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE farms (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  municipality TEXT NOT NULL,
  department TEXT NOT NULL,
  hectares REAL,
  ica_registration TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE lots (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  purpose TEXT
);
CREATE TABLE animals (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  lot_id TEXT REFERENCES lots(id),
  tag_visual TEXT,
  rfid TEXT,
  name TEXT,
  sex TEXT NOT NULL CHECK (sex IN ('hembra','macho')),
  breed TEXT,
  birth_date TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('nacido','comprado')),
  mother_id TEXT REFERENCES animals(id),
  father_id TEXT REFERENCES animals(id),
  sire_note TEXT,
  status TEXT NOT NULL DEFAULT 'activo',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX animals_tag ON animals(farm_id, tag_visual) WHERE tag_visual IS NOT NULL;
CREATE UNIQUE INDEX animals_rfid ON animals(farm_id, rfid) WHERE rfid IS NOT NULL;
CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock REAL NOT NULL DEFAULT 0,
  withdrawal_milk_days INTEGER NOT NULL DEFAULT 0,
  withdrawal_meat_days INTEGER NOT NULL DEFAULT 0,
  expires_on TEXT
);
CREATE TABLE events (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  animal_id TEXT NOT NULL REFERENCES animals(id),
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  dose TEXT,
  weight_kg REAL,
  weight_method TEXT,
  calf_id TEXT REFERENCES animals(id),
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX events_animal ON events(animal_id, date);
CREATE TABLE movements (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  kind TEXT NOT NULL CHECK (kind IN ('ingreso','gasto')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  animal_id TEXT REFERENCES animals(id),
  receipt_uri TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE sync_outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);
    await seedDemo(db);
    version = 1;
  }

  if (version === 1) {
    // Product use per event, so stock = purchased stock − SUM(quantity) and offline uses never clash.
    await db.execAsync("ALTER TABLE events ADD COLUMN quantity REAL;");
    version = 2;
  }

  if (version === 2) {
    // Sync bookkeeping: pull cursor and last successful sync time.
    await db.execAsync("CREATE TABLE sync_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
    version = 3;
  }

  if (version === 3) {
    // Two phones offline can tag different animals with the same number; the server keeps both. A unique
    // index here made that pull fail forever, so duplicates are allowed and shown as an alert instead.
    await db.execAsync(`
DROP INDEX IF EXISTS animals_tag;
DROP INDEX IF EXISTS animals_rfid;
CREATE INDEX animals_tag ON animals(farm_id, tag_visual);
CREATE INDEX animals_rfid ON animals(farm_id, rfid);
CREATE TABLE IF NOT EXISTS prefs (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`);
    version = 4;
  }

  if (version === 4) {
    // Milk production (per cow or the whole tank), synced append-only like events.
    await db.execAsync(`
CREATE TABLE milk (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  date TEXT NOT NULL,
  session TEXT NOT NULL,
  animal_id TEXT REFERENCES animals(id),
  liters REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX milk_farm ON milk(farm_id, date);
`);
    await seedDemoV5(db);
    version = 5;
  }

  if (version === 5) {
    // Demo farms were seeded "today", so animals added to them never showed up as ICA arrivals.
    await db.execAsync(`
UPDATE animals SET created_at = strftime('%Y-%m-%dT12:00:00.000Z', 'now', '-400 days')
  WHERE farm_id IN (SELECT id FROM farms WHERE is_demo = 1) AND created_at = (SELECT created_at FROM farms f WHERE f.id = animals.farm_id);
UPDATE farms SET created_at = strftime('%Y-%m-%dT12:00:00.000Z', 'now', '-400 days') WHERE is_demo = 1;
`);
    version = 6;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
