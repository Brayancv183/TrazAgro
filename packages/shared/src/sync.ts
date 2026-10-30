/** Wire format shared by the app and the server for offline sync. See docs/MODELO_DATOS.md. */

export const SYNC_TABLES = ["farms", "lots", "animals", "products", "events", "movements", "milk"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Tables whose rows are never edited after creation; the server keeps the first copy it receives. */
export const APPEND_ONLY: ReadonlySet<SyncTable> = new Set(["events", "movements", "milk"]);

export interface SyncChange {
  table: SyncTable;
  id: string;
  /** The full record in camelCase, as in domain.ts. Must carry `farmId` except for farms. */
  payload: Record<string, unknown>;
}

export interface PushRequest {
  changes: SyncChange[];
}

export interface PushResponse {
  /** Changes stored or already present (safe to drop from the outbox). */
  accepted: string[];
  /** Changes the server refused, with the reason; they stay in the outbox for a person to look at. */
  rejected: { id: string; reason: string }[];
}

export interface PullResponse {
  changes: SyncChange[];
  /** Pass back as `since` on the next pull. */
  cursor: number;
  /** True when there are more changes after this page. */
  more: boolean;
}

export interface OtpRequestResponse {
  ok: true;
  /** Only in development, when no SMS provider is configured. */
  devCode?: string;
}

export interface SessionUser {
  id: string;
  phone: string;
  fullName?: string;
}

export interface OtpVerifyResponse {
  token: string;
  user: SessionUser;
}

/** Last-write-wins: the incoming copy replaces the stored one only when it is strictly newer. */
export function isNewer(incoming: Record<string, unknown>, stored: Record<string, unknown> | undefined): boolean {
  if (!stored) return true;
  const a = String(incoming.updatedAt ?? incoming.createdAt ?? "");
  const b = String(stored.updatedAt ?? stored.createdAt ?? "");
  return a > b;
}
