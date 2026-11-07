import pg from "pg";
import { PGlite } from "@electric-sql/pglite";

/** Minimal SQL interface so the same code runs on real Postgres and on embedded PGlite. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs `fn` inside a transaction; the callback gets a Db bound to it. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Production: a Postgres connection pool (Neon). */
export function postgresDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const wrap = (c: pg.Pool | pg.PoolClient): Db => ({
    query: async (sql, params) => (await c.query(sql, params as unknown[])).rows,
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client));
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  });
  return wrap(pool);
}

/** Development and tests: Postgres compiled to WebAssembly, in memory or in a folder. */
export async function embeddedDb(dataDir?: string): Promise<Db> {
  const pgl = await PGlite.create(dataDir);
  const wrap = (c: Pick<PGlite, "query">): Db => ({
    query: async (sql, params) => (await c.query(sql, params as unknown[])).rows as never[],
    tx: (fn) => pgl.transaction((t) => fn(wrap(t))),
    close: () => pgl.close(),
  });
  return wrap(pgl);
}

export async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text UNIQUE NOT NULL,
    full_name text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS otp_codes (
    phone text PRIMARY KEY,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS farm_members (
    farm_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id),
    role text NOT NULL,
    PRIMARY KEY (farm_id, user_id)
  )`);
  await db.query("CREATE SEQUENCE IF NOT EXISTS change_seq");
  // Every synced record, stored as the app sends it. `seq` orders changes for incremental pulls.
  await db.query(`CREATE TABLE IF NOT EXISTS records (
    table_name text NOT NULL,
    id text NOT NULL,
    farm_id text NOT NULL,
    payload jsonb NOT NULL,
    seq bigint NOT NULL DEFAULT nextval('change_seq'),
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (table_name, id)
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS records_farm_seq ON records (farm_id, seq)");
  // Device that sent the current version, so its own pull can skip it (it already has it).
  await db.query("ALTER TABLE records ADD COLUMN IF NOT EXISTS origin text");
}
