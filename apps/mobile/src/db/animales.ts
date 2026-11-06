import type { SQLiteDatabase } from "expo-sqlite";
import {
  addDays, agenda, categoryOf, farmAlerts, inWithdrawal, reproStatus, todayDay, weightSummary, withdrawalFor,
  type Animal, type AnimalEvent, type Category, type Farm, type Lot, type ReproStatus, type Withdrawal,
} from "@trazagro/shared";
import { getFarm, listAllAnimals, listFarmEvents, listLots, listMilk, listProducts } from "./repo";
import { listPhotos, type Photo } from "./photos";

export type RowTone = "warn" | "danger" | "info";

/** One animal of the herd list with everything its row, the filters and the quick sheet need. */
export interface HerdRow {
  a: Animal;
  category: Category;
  lot?: Lot;
  /** "Lote 1" from "Lote 1 · Ordeño". */
  lotShort?: string;
  events: AnimalEvent[];
  w: Withdrawal;
  retiro: { milk: boolean; meat: boolean };
  births: number;
  repro?: ReproStatus;
  vaccineDue: boolean;
  weighDue: boolean;
  milkAvg?: number;
  weightKg?: number;
  photo?: Photo;
  /** The one pill shown at the right of the row: the most urgent thing about this animal. */
  alert?: { label: string; tone: RowTone };
}

export const shortLot = (l?: Lot) => l?.name.split(" · ")[0];

/** Active animals of a farm with their status flags, sorted by ear tag. */
export async function loadHerd(db: SQLiteDatabase, farmId: string): Promise<{ farm: Farm | null; rows: HerdRow[]; lots: Lot[] }> {
  const today = todayDay();
  const [farm, all, events, products, lots, milk, photos] = await Promise.all([
    getFarm(db, farmId), listAllAnimals(db, farmId), listFarmEvents(db, farmId), listProducts(db, farmId), listLots(db, farmId),
    listMilk(db, farmId, addDays(today, -6)), listPhotos(db, farmId),
  ]);
  const active = all.filter((a) => a.status === "activo").sort((x, y) => (x.tagVisual ?? x.name ?? "").localeCompare(y.tagVisual ?? y.name ?? ""));
  const byAnimal = new Map<string, AnimalEvent[]>();
  for (const e of events) byAnimal.set(e.animalId, [...(byAnimal.get(e.animalId) ?? []), e]);
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const alerts = farmAlerts(all, events, products, [], today);
  const duplicated = new Set(alerts.filter((x) => x.id.startsWith("duplicado:")).flatMap((x) => {
    const code = x.id.slice("duplicado:".length);
    return active.filter((a) => a.tagVisual === code || a.rfid?.replace(/\s/g, "") === code).map((a) => a.id);
  }));
  const weigh = new Set(alerts.filter((x) => x.id.startsWith("pesaje:")).map((x) => x.animalId));
  const vaccine = new Set(agenda(all, events, products, today).filter((x) => x.id.startsWith("vacuna:") && x.date <= today).map((x) => x.animalId));
  const firstPhoto = new Map<string, Photo>();
  for (const p of photos) if (p.animalId && !firstPhoto.has(p.animalId)) firstPhoto.set(p.animalId, p);

  const rows = active.map((a): HerdRow => {
    const ev = byAnimal.get(a.id) ?? [];
    const births = ev.filter((e) => e.type === "parto").length;
    const w = withdrawalFor(ev, products);
    const retiro = inWithdrawal(w, today);
    const repro = a.sex === "hembra" && births + ev.filter((e) => e.type === "servicio").length > 0 ? reproStatus(ev, today) : undefined;
    const mine = milk.filter((m) => m.animalId === a.id);
    const days = new Set(mine.map((m) => m.date)).size;
    const lot = a.lotId ? lotById.get(a.lotId) : undefined;
    const row: HerdRow = {
      a, category: categoryOf(a.sex, a.birthDate, births, today), lot, lotShort: shortLot(lot), events: ev, w, retiro, births, repro,
      vaccineDue: vaccine.has(a.id), weighDue: weigh.has(a.id),
      milkAvg: days ? mine.reduce((n, m) => n + m.liters, 0) / days : undefined, weightKg: weightSummary(ev).lastKg, photo: firstPhoto.get(a.id),
    };
    row.alert =
      duplicated.has(a.id) ? { label: "Arete repetido", tone: "danger" } :
      retiro.meat || retiro.milk ? { label: "Días de espera", tone: "warn" } :
      !a.tagVisual ? { label: "Sin arete", tone: "warn" } :
      row.vaccineDue ? { label: "Vacunar", tone: "warn" } :
      row.weighDue ? { label: "Pesar", tone: "warn" } :
      repro?.state === "prenada" ? { label: "Preñada", tone: "info" } : undefined;
    return row;
  });
  return { farm, rows, lots };
}

/** Records still waiting in the sync outbox (saved only on this phone). */
export async function pendingRecordIds(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ record_id: string }>("SELECT DISTINCT record_id FROM sync_outbox");
  return new Set(rows.map((r) => r.record_id));
}

/** Active animals of a farm (for the "Ahora tienes N animales" / "Animales activos: N" lines). */
export async function countActive(db: SQLiteDatabase, farmId: string, lotId?: string): Promise<number> {
  const r = lotId
    ? await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM animals WHERE farm_id = ? AND status = 'activo' AND lot_id = ?", farmId, lotId)
    : await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM animals WHERE farm_id = ? AND status = 'activo'", farmId);
  return r?.n ?? 0;
}
