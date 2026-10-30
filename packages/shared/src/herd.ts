import type { Animal, AnimalEvent, MilkRecord, Movement, Product } from "./domain";
import { addDays, categoryOf, daysBetween, monthsBetween, weightSummary, withdrawalFor, type Category } from "./rules";
import { WEIGH_EVERY_DAYS } from "./farm";

// ---------------------------------------------------------------- reproduction

/** Average bovine gestation used for the expected calving date. */
export const GESTATION_DAYS = 283;
/** A pregnancy check makes sense from this many days after service. */
export const CHECK_AFTER_DAYS = 45;
/** Dry the cow this many days before the expected calving. */
export const DRY_OFF_DAYS = 60;

export type ReproState = "vacia" | "servida" | "prenada" | "parida";

export interface ReproStatus {
  state: ReproState;
  lastCalving?: string;
  lastService?: string;
  /** For "servida": when to check pregnancy. */
  checkOn?: string;
  /** For "prenada": expected calving and dry-off dates. */
  expectedCalving?: string;
  dryOffOn?: string;
  dried?: boolean;
  /** Days since the last calving without a confirmed pregnancy (días abiertos). */
  openDays?: number;
}

const byDate = (a: AnimalEvent, b: AnimalEvent) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date));

/** Where a female stands in her reproductive cycle, from her own events. */
export function reproStatus(events: AnimalEvent[], today: string): ReproStatus {
  const ev = events.filter((e) => ["parto", "servicio", "diagnostico", "secado"].includes(e.type)).sort(byDate);
  const lastCalving = [...ev].reverse().find((e) => e.type === "parto")?.date;
  const after = ev.filter((e) => !lastCalving || e.date >= lastCalving);
  const service = [...after].reverse().find((e) => e.type === "servicio");
  const openDays = lastCalving ? daysBetween(lastCalving, today) : undefined;
  if (!service || service.date < (lastCalving ?? "")) {
    return { state: lastCalving ? "parida" : "vacia", lastCalving, openDays };
  }
  const check = [...after].reverse().find((e) => e.type === "diagnostico" && e.date >= service.date);
  if (!check) return { state: "servida", lastCalving, lastService: service.date, checkOn: addDays(service.date, CHECK_AFTER_DAYS), openDays };
  if (check.notes !== "preñada") return { state: "vacia", lastCalving, lastService: service.date, openDays };
  const expectedCalving = addDays(service.date, GESTATION_DAYS);
  return {
    state: "prenada", lastCalving, lastService: service.date, expectedCalving,
    dryOffOn: addDays(expectedCalving, -DRY_OFF_DAYS), dried: after.some((e) => e.type === "secado" && e.date >= service.date),
  };
}

export const REPRO_LABEL: Record<ReproState, string> = { vacia: "Vacía", servida: "Servida", prenada: "Preñada", parida: "Recién parida" };

// ---------------------------------------------------------------- agenda

export interface AgendaItem {
  id: string;
  date: string;
  title: string;
  detail: string;
  animalId?: string;
  productId?: string;
  kind: "reproduccion" | "salud" | "pesaje" | "inventario";
}

/** Revaccinate when the last vaccine is older than this. */
export const REVACCINATE_DAYS = 180;

/** Everything due between `today - 30` and `today + days`, oldest first (overdue items lead). */
export function agenda(animals: Animal[], events: AnimalEvent[], products: Product[], today: string, days = 30): AgendaItem[] {
  const until = addDays(today, days);
  const from = addDays(today, -30);
  const out: AgendaItem[] = [];
  const add = (item: AgendaItem) => { if (item.date >= from && item.date <= until) out.push(item); };
  const byAnimal = new Map<string, AnimalEvent[]>();
  for (const e of events) byAnimal.set(e.animalId, [...(byAnimal.get(e.animalId) ?? []), e]);

  for (const a of animals) {
    if (a.status !== "activo") continue;
    const ev = byAnimal.get(a.id) ?? [];
    const label = a.name ? `${a.name} #${a.tagVisual ?? ""}`.trim() : `#${a.tagVisual ?? "sin arete"}`;
    if (a.sex === "hembra" && monthsBetween(a.birthDate, today) >= 15) {
      const r = reproStatus(ev, today);
      if (r.state === "servida") add({ id: `diag:${a.id}`, date: r.checkOn!, title: `Palpar a ${label}`, detail: "Confirmar si quedó preñada", animalId: a.id, kind: "reproduccion" });
      if (r.state === "prenada") {
        add({ id: `parto:${a.id}`, date: r.expectedCalving!, title: `Parto esperado de ${label}`, detail: "Tener lista la maternidad", animalId: a.id, kind: "reproduccion" });
        if (!r.dried) add({ id: `secado:${a.id}`, date: r.dryOffOn!, title: `Secar a ${label}`, detail: "60 días antes del parto", animalId: a.id, kind: "reproduccion" });
      }
    }
    const lastVaccine = ev.filter((e) => e.type === "vacuna").map((e) => e.date).sort().pop();
    if (lastVaccine) add({ id: `vacuna:${a.id}`, date: addDays(lastVaccine, REVACCINATE_DAYS), title: `Revacunar a ${label}`, detail: "Han pasado 6 meses de la última vacuna", animalId: a.id, kind: "salud" });
    const w = weightSummary(ev);
    if (w.lastDate) add({ id: `peso:${a.id}`, date: addDays(w.lastDate, WEIGH_EVERY_DAYS), title: `Pesar a ${label}`, detail: "Para seguir su ganancia de peso", animalId: a.id, kind: "pesaje" });
    const wd = withdrawalFor(ev, products);
    const end = [wd.milkUntil, wd.meatUntil].filter((d): d is string => !!d && d >= today).sort().pop();
    if (end) add({ id: `retiro:${a.id}`, date: end, title: `Termina el retiro de ${label}`, detail: "Desde ese día puede venderse su leche y su carne", animalId: a.id, kind: "salud" });
  }
  for (const p of products) {
    if (p.expiresOn) add({ id: `vence:${p.id}`, date: p.expiresOn, title: `Vence ${p.name}`, detail: `Quedan ${p.stock} ${p.unit}`, productId: p.id, kind: "inventario" });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.title.localeCompare(y.title));
}

// ---------------------------------------------------------------- milk

export interface MilkDay {
  date: string;
  liters: number;
}

/** Liters per day: per-cow records are added up; a tank record for a day replaces nothing, it adds. */
export function milkByDay(records: MilkRecord[], from: string, to: string): MilkDay[] {
  const map = new Map<string, number>();
  for (let d = from; d <= to; d = addDays(d, 1)) map.set(d, 0);
  for (const r of records) if (map.has(r.date)) map.set(r.date, map.get(r.date)! + r.liters);
  return [...map].map(([date, liters]) => ({ date, liters: Math.round(liters * 10) / 10 }));
}

// ---------------------------------------------------------------- metrics

export interface HerdMetrics {
  active: number;
  byCategory: Partial<Record<Category, number>>;
  births: number;
  deaths: number;
  /** Births per 100 breeding females in the period. */
  birthRate?: number;
  /** Deaths per 100 animals in the period. */
  mortality?: number;
  /** Average daily gain over animals with two weighings, kg/day. */
  avgDailyGain?: number;
  /** Average days between consecutive calvings. */
  calvingInterval?: number;
  income: number;
  expenses: number;
  /** Net result per active animal per month in the period. */
  netPerAnimalMonth?: number;
  milkLiters: number;
}

/** Herd indicators for the last `months` months. */
export function herdMetrics(animals: Animal[], events: AnimalEvent[], movements: Movement[], milk: MilkRecord[], today: string, months = 12): HerdMetrics {
  const from = addDays(today, -Math.round(months * 30.4));
  const inPeriod = (d: string) => d >= from && d <= today;
  const byAnimal = new Map<string, AnimalEvent[]>();
  for (const e of events) byAnimal.set(e.animalId, [...(byAnimal.get(e.animalId) ?? []), e]);

  const active = animals.filter((a) => a.status === "activo");
  const byCategory: Partial<Record<Category, number>> = {};
  for (const a of active) {
    const c = categoryOf(a.sex, a.birthDate, (byAnimal.get(a.id) ?? []).filter((e) => e.type === "parto").length, today);
    byCategory[c] = (byCategory[c] ?? 0) + 1;
  }
  const births = events.filter((e) => e.type === "parto" && inPeriod(e.date)).length;
  const exits = events.filter((e) => e.type === "baja" && inPeriod(e.date));
  const deaths = exits.filter((e) => animals.find((a) => a.id === e.animalId && (a.status === "muerto" || a.status === "perdido"))).length;
  const breeders = animals.filter((a) => a.sex === "hembra" && monthsBetween(a.birthDate, today) >= 24 && (a.status === "activo" || exits.some((e) => e.animalId === a.id))).length;

  const gains = active.map((a) => weightSummary(byAnimal.get(a.id) ?? []).dailyGainKg).filter((g): g is number => g !== undefined);
  const intervals: number[] = [];
  for (const ev of byAnimal.values()) {
    const calvings = ev.filter((e) => e.type === "parto").map((e) => e.date).sort();
    for (let i = 1; i < calvings.length; i++) intervals.push(daysBetween(calvings[i - 1]!, calvings[i]!));
  }
  const income = movements.filter((m) => m.kind === "ingreso" && inPeriod(m.date)).reduce((n, m) => n + m.amount, 0);
  const expenses = movements.filter((m) => m.kind === "gasto" && inPeriod(m.date)).reduce((n, m) => n + m.amount, 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
  const round = (x: number | undefined, d = 1) => (x === undefined ? undefined : Math.round(x * 10 ** d) / 10 ** d);

  return {
    active: active.length,
    byCategory,
    births,
    deaths,
    birthRate: breeders ? round((births / breeders) * 100, 0) : undefined,
    mortality: active.length + deaths ? round((deaths / (active.length + deaths)) * 100) : undefined,
    avgDailyGain: round(avg(gains), 2),
    calvingInterval: round(avg(intervals), 0),
    income,
    expenses,
    netPerAnimalMonth: active.length ? Math.round((income - expenses) / active.length / months) : undefined,
    milkLiters: Math.round(milk.filter((r) => inPeriod(r.date)).reduce((n, r) => n + r.liters, 0)),
  };
}
