import type { SQLiteDatabase } from "expo-sqlite";
import { APPEND_ONLY, SYNC_TABLES, type SyncChange, type SyncTable } from "@trazagro/shared";
import { randomUUID } from "expo-crypto";
import { api } from "../lib/api";

/** Local columns per synced table. Payload keys are camelCase versions of these. */
const COLUMNS: Record<SyncTable, string[]> = {
  farms: ["id", "name", "municipality", "department", "hectares", "ica_registration", "created_at", "updated_at"],
  lots: ["id", "farm_id", "name", "purpose"],
  animals: ["id", "farm_id", "lot_id", "tag_visual", "rfid", "name", "sex", "breed", "birth_date", "origin", "mother_id", "father_id", "sire_note", "status", "created_at", "updated_at"],
  products: ["id", "farm_id", "name", "kind", "unit", "stock", "withdrawal_milk_days", "withdrawal_meat_days", "expires_on"],
  events: ["id", "farm_id", "animal_id", "type", "date", "product_id", "dose", "quantity", "weight_kg", "weight_method", "calf_id", "notes", "created_by", "created_at"],
  movements: ["id", "farm_id", "kind", "category", "amount", "date", "description", "animal_id", "receipt_uri", "created_at"],
  milk: ["id", "farm_id", "date", "session", "animal_id", "liters", "created_at"],
};

const camel = (col: string) => col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Writes a record received from the server. Append-only rows are kept as first received. */
async function applyChange(db: SQLiteDatabase, c: SyncChange) {
  const cols = COLUMNS[c.table];
  const values = cols.map((col) => {
    const v = c.payload[camel(col)];
    return v === undefined ? null : (v as string | number | null);
  });
  const conflict = APPEND_ONLY.has(c.table)
    ? "DO NOTHING"
    : `DO UPDATE SET ${cols.filter((x) => x !== "id").map((x) => `${x} = excluded.${x}`).join(", ")}`;
  await db.runAsync(
    `INSERT INTO ${c.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT(id) ${conflict}`,
    ...values,
  );
}

async function getState(db: SQLiteDatabase, key: string) {
  return (await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = ?", key))?.value;
}

async function setState(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync("INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  rejected: { id: string; reason: string }[];
}

let running: Promise<SyncResult> | null = null;

/** Uploads the outbox, then downloads everything new. Safe to call often; concurrent calls share one run. */
export function runSync(db: SQLiteDatabase, token: string): Promise<SyncResult> {
  running ??= doSync(db, token).finally(() => { running = null; });
  return running;
}

/**
 * This install's id, sent with every sync so the server doesn't return the phone's own changes. It lives in
 * sync_state, which sign-out clears: after signing in again the phone gets a new id and re-downloads everything.
 */
async function deviceId(db: SQLiteDatabase): Promise<string> {
  const saved = await getState(db, "device");
  if (saved) return saved;
  const id = randomUUID();
  await setState(db, "device", id);
  return id;
}

async function doSync(db: SQLiteDatabase, token: string): Promise<SyncResult> {
  const device = await deviceId(db);
  const result: SyncResult = { pushed: 0, pulled: 0, rejected: [] };

  // 1. Push: newest payload per record, in outbox order. Rejected rows stay in the outbox (shown to the
  // person and retried next run); `after` skips past them within this run.
  let after = 0;
  for (;;) {
    const rows = await db.getAllAsync<{ seq: number; table_name: string; record_id: string; payload: string }>(
      "SELECT seq, table_name, record_id, payload FROM sync_outbox WHERE seq > ? ORDER BY seq LIMIT 300",
      after,
    );
    if (!rows.length) break;
    const latest = new Map<string, SyncChange>();
    for (const r of rows) {
      if (!SYNC_TABLES.includes(r.table_name as SyncTable)) continue;
      latest.set(`${r.table_name}:${r.record_id}`, { table: r.table_name as SyncTable, id: r.record_id, payload: JSON.parse(r.payload) });
    }
    const res = await api.push(token, [...latest.values()], device);
    const maxSeq = rows[rows.length - 1]!.seq;
    const accepted = new Set(res.accepted);
    await db.withTransactionAsync(async () => {
      for (const r of rows) if (accepted.has(r.record_id)) await db.runAsync("DELETE FROM sync_outbox WHERE seq = ?", r.seq);
    });
    result.pushed += res.accepted.length;
    result.rejected.push(...res.rejected);
    after = maxSeq;
    if (rows.length < 300) break;
  }

  // Rejections are kept so the person can see them in Cuenta and decide to discard them.
  await setState(db, "rejected", JSON.stringify(result.rejected));

  // 2. Roles per farm (used to hide what a role can't do). A farm the person just joined has records
  // older than our cursor, so a new farm means pulling everything again (inserts are idempotent).
  const mine = await api.myFarms(token);
  const known = new Set<string>(JSON.parse((await getState(db, "farms")) ?? "[]"));
  for (const f of mine) await db.runAsync("INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", `role:${f.farmId}`, f.role);
  if (mine.some((f) => !known.has(f.farmId))) await setState(db, "cursor", "0");
  await setState(db, "farms", JSON.stringify(mine.map((f) => f.farmId)));

  // Farms the person no longer belongs to (removed from the team) leave this phone, unless they still
  // have unsent changes (a farm created here is only on the server after its push is accepted).
  const member = new Set(mine.map((f) => f.farmId));
  const local = await db.getAllAsync<{ id: string }>("SELECT id FROM farms WHERE is_demo = 0");
  for (const { id } of local) {
    if (member.has(id)) continue;
    const pending = await db.getFirstAsync("SELECT 1 FROM sync_outbox WHERE payload LIKE ? LIMIT 1", `%${id}%`);
    if (!pending) await removeFarmData(db, id);
  }

  // 3. Pull: page through everything after the saved cursor. The server orders by change, so an edited
  // animal can arrive after its own events, even on a later page: foreign keys are checked off while
  // applying (PRAGMA can't change inside a transaction) and each page is applied parents first.
  let cursor = Number((await getState(db, "cursor")) ?? 0);
  await db.execAsync("PRAGMA foreign_keys = OFF");
  try {
    for (;;) {
      const page = await api.pull(token, cursor, device);
      const ordered = [...page.changes].sort((a, b) => SYNC_TABLES.indexOf(a.table) - SYNC_TABLES.indexOf(b.table));
      await db.withTransactionAsync(async () => {
        for (const c of ordered) await applyChange(db, c);
        await setState(db, "cursor", String(page.cursor));
      });
      result.pulled += page.changes.length;
      cursor = page.cursor;
      if (!page.more) break;
    }
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON");
  }

  await setState(db, "last_sync", new Date().toISOString());
  return result;
}

export interface SyncStatus {
  pending: number;
  lastSync?: string;
  /** Changes the server refused on the last sync, still waiting in the outbox. */
  rejected: { id: string; reason: string }[];
}

export async function syncStatus(db: SQLiteDatabase): Promise<SyncStatus> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(DISTINCT table_name || record_id) AS n FROM sync_outbox");
  const rejected: SyncStatus["rejected"] = JSON.parse((await getState(db, "rejected")) ?? "[]");
  const waiting = new Set((await db.getAllAsync<{ record_id: string }>("SELECT DISTINCT record_id FROM sync_outbox")).map((r) => r.record_id));
  return { pending: row?.n ?? 0, lastSync: await getState(db, "last_sync"), rejected: rejected.filter((r) => waiting.has(r.id)) };
}

/** Drops refused changes from the outbox. The local copy stays; the server keeps its own version. */
export async function discardRejected(db: SQLiteDatabase, ids: string[]) {
  await db.withTransactionAsync(async () => {
    for (const id of ids) await db.runAsync("DELETE FROM sync_outbox WHERE record_id = ?", id);
    await setState(db, "rejected", "[]");
  });
}


/** Deletes one farm and everything recorded on it from this phone (not from the server). */
async function removeFarmData(db: SQLiteDatabase, farmId: string) {
  await db.withTransactionAsync(async () => {
    for (const t of ["milk", "events", "movements", "products", "animals", "lots"]) await db.runAsync(`DELETE FROM ${t} WHERE farm_id = ?`, farmId);
    await db.runAsync("DELETE FROM farms WHERE id = ?", farmId);
    await db.runAsync("DELETE FROM prefs WHERE key = ?", `role:${farmId}`);
  });
}

/**
 * Sign-out on a shared phone: removes every real (non-demo) farm and its records, the outbox and the
 * sync state, so the next person who logs in neither sees nor uploads the previous account's data.
 */
export async function clearAccountData(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    const real = "(SELECT id FROM farms WHERE is_demo = 0)";
    for (const t of ["milk", "events", "movements", "products", "animals", "lots"]) {
      await db.runAsync(`DELETE FROM ${t} WHERE farm_id IN ${real}`);
    }
    await db.runAsync("DELETE FROM farms WHERE is_demo = 0");
    await db.runAsync("DELETE FROM prefs WHERE key LIKE 'role:%' OR key = 'current_farm'");
    await db.runAsync("DELETE FROM sync_outbox");
    await db.runAsync("DELETE FROM sync_state");
  });
}
