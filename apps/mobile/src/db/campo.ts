import type { SQLiteDatabase } from "expo-sqlite";
import { addDays, daysBetween, type Animal, type AnimalEvent, type Product } from "@trazagro/shared";
import { getPref, setPref } from "./repo";

// ---------------------------------------------------------------- withdrawal periods (Días de espera)

export interface WaitItem {
  animal: Animal;
  milk: boolean;
  meat: boolean;
  milkUntil?: string;
  meatUntil?: string;
  /** The application that sets the latest end date. */
  product?: string;
  applied: string;
  /** Last restricted day (the later of milk and meat). */
  until: string;
  daysLeft: number;
  /** 0..100: how much of the withdrawal has already passed. */
  pct: number;
}

const APPLIED: readonly AnimalEvent["type"][] = ["vacuna", "tratamiento", "desparasitacion"];

/**
 * Active animals that still can't sell milk or meat, with the product and day that caused it and how far
 * along the waiting period is. Same rule as `withdrawalFor` (latest end date per product), with its source.
 */
export function waitingList(animals: Animal[], events: AnimalEvent[], products: Product[], today: string): WaitItem[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: WaitItem[] = [];
  for (const a of animals) {
    if (a.status !== "activo") continue;
    let milkUntil: string | undefined, meatUntil: string | undefined;
    let src: { until: string; applied: string; product: string } | undefined;
    for (const e of events) {
      if (e.animalId !== a.id || !APPLIED.includes(e.type) || !e.productId) continue;
      const p = byId.get(e.productId);
      if (!p) continue;
      const m = p.withdrawalMilkDays > 0 ? addDays(e.date, p.withdrawalMilkDays) : undefined;
      const c = p.withdrawalMeatDays > 0 ? addDays(e.date, p.withdrawalMeatDays) : undefined;
      if (m && (!milkUntil || m > milkUntil)) milkUntil = m;
      if (c && (!meatUntil || c > meatUntil)) meatUntil = c;
      const end = [m, c].filter((d): d is string => !!d).sort().pop();
      if (end && (!src || end > src.until)) src = { until: end, applied: e.date, product: p.name };
    }
    const milk = !!milkUntil && today <= milkUntil;
    const meat = !!meatUntil && today <= meatUntil;
    if (!milk && !meat) continue;
    const until = [milk ? milkUntil : undefined, meat ? meatUntil : undefined].filter((d): d is string => !!d).sort().pop()!;
    const applied = src?.applied ?? today;
    const total = Math.max(1, daysBetween(applied, until));
    const pct = Math.min(100, Math.max(4, Math.round((daysBetween(applied, today) / total) * 100)));
    out.push({ animal: a, milk, meat, milkUntil, meatUntil, product: src?.product, applied, until, daysLeft: daysBetween(today, until), pct });
  }
  return out.sort((x, y) => x.until.localeCompare(y.until));
}

// ---------------------------------------------------------------- alerts read on this phone

const readKey = (farmId: string) => `alertas_leidas:${farmId}`;

/** Ids of the alerts the person already marked as read on this phone. */
export async function readAlertIds(db: SQLiteDatabase, farmId: string): Promise<Set<string>> {
  try {
    return new Set(JSON.parse((await getPref(db, readKey(farmId))) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Marks these alerts as read (an alert that comes back with the same id stays read). */
export async function markAlertsRead(db: SQLiteDatabase, farmId: string, ids: string[]): Promise<void> {
  const cur = await readAlertIds(db, farmId);
  for (const id of ids) cur.add(id);
  await setPref(db, readKey(farmId), JSON.stringify([...cur].slice(-500)));
}
