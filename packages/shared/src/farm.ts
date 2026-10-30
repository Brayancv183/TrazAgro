import type { Animal, AnimalEvent, Farm, Movement, Product } from "./domain";
import { addDays, daysBetween, inWithdrawal, num, plural, shortDate, weightSummary, withdrawalFor } from "./rules";

// ---------------------------------------------------------------- ICA / SINIGAN novelties

export type NoveltyKind = "nacimiento" | "ingreso" | "venta" | "muerte" | "sacrificio" | "traslado";

export interface Novelty {
  kind: NoveltyKind;
  animalId: string;
  date: string;
  reported: boolean;
}

/** Novelties older than this are assumed already handled outside the app. */
export const NOVELTY_WINDOW_DAYS = 90;

const EXIT_KIND: Partial<Record<Animal["status"], NoveltyKind>> = { vendido: "venta", muerto: "muerte", perdido: "muerte", sacrificado: "sacrificio", trasladado: "traslado" };

/**
 * Herd changes the ICA asks producers to register in SINIGAN: births, arrivals and exits.
 * Animals entered together with the farm (its initial inventory) are not arrivals.
 */
export function noveltiesFor(farm: Pick<Farm, "createdAt">, animals: Animal[], events: AnimalEvent[], today: string): Novelty[] {
  const from = addDays(today, -NOVELTY_WINDOW_DAYS);
  const reported = new Set(events.filter((e) => e.type === "reporte_ica").map((e) => `${e.animalId}:${e.notes}`));
  const exitDate = new Map(events.filter((e) => e.type === "baja").map((e) => [e.animalId, e.date]));
  const farmDay = farm.createdAt.slice(0, 10);
  const out: Novelty[] = [];
  const push = (kind: NoveltyKind, a: Animal, date: string) => {
    if (date >= from && date <= today) out.push({ kind, animalId: a.id, date, reported: reported.has(`${a.id}:${kind}`) });
  };
  for (const a of animals) {
    if (a.origin === "nacido") push("nacimiento", a, a.birthDate);
    else if (daysBetween(farmDay, a.createdAt.slice(0, 10)) >= 1) push("ingreso", a, a.createdAt.slice(0, 10));
    const exit = EXIT_KIND[a.status];
    if (exit) push(exit, a, exitDate.get(a.id) ?? a.updatedAt.slice(0, 10));
  }
  return out.sort((x, y) => y.date.localeCompare(x.date));
}

// ---------------------------------------------------------------- Alerts

export type AlertLevel = "alta" | "media" | "info";

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  animalId?: string;
  productId?: string;
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const LEVEL_ORDER: Record<AlertLevel, number> = { alta: 0, media: 1, info: 2 };
export const EXPIRY_WARN_DAYS = 30;
export const WEIGH_EVERY_DAYS = 60;

/** Everything the farmer should look at today, most urgent first. Only active animals count. */
export function farmAlerts(animals: Animal[], events: AnimalEvent[], products: Product[], novelties: Novelty[], today: string): Alert[] {
  const active = animals.filter((a) => a.status === "activo");
  const byAnimal = new Map<string, AnimalEvent[]>();
  for (const e of events) byAnimal.set(e.animalId, [...(byAnimal.get(e.animalId) ?? []), e]);
  const label = (a: Animal) => a.name ?? `#${a.tagVisual ?? "sin arete"}`;
  const out: Alert[] = [];

  for (const a of active) {
    const ev = byAnimal.get(a.id) ?? [];
    const w = withdrawalFor(ev, products);
    const on = inWithdrawal(w, today);
    if (on.meat || on.milk) {
      out.push({
        id: `retiro:${a.id}`, level: "alta", animalId: a.id, title: `${label(a)} en días de retiro`,
        detail: capitalize([on.milk && `leche hasta el ${shortDate(w.milkUntil!, today)}`, on.meat && `carne hasta el ${shortDate(w.meatUntil!, today)}`].filter(Boolean).join(" · ")),
      });
    }
    if (!a.tagVisual) out.push({ id: `arete:${a.id}`, level: "media", animalId: a.id, title: `${label(a)} no tiene arete`, detail: "El ICA exige arete visual y RFID." });
    const lastWeigh = weightSummary(ev).lastDate;
    if (lastWeigh && daysBetween(lastWeigh, today) > WEIGH_EVERY_DAYS) {
      out.push({ id: `pesaje:${a.id}`, level: "info", animalId: a.id, title: `Pesar a ${label(a)}`, detail: `Último pesaje hace ${daysBetween(lastWeigh, today)} días.` });
    }
  }

  const byTag = new Map<string, Animal[]>();
  for (const a of active) for (const code of [a.tagVisual, a.rfid?.replace(/\s/g, "")]) {
    if (code) byTag.set(code, [...(byTag.get(code) ?? []), a]);
  }
  for (const [code, list] of byTag) {
    const unique = [...new Set(list)];
    if (unique.length > 1) {
      out.push({ id: `duplicado:${code}`, level: "alta", animalId: unique[0]!.id, title: `Arete ${code} repetido`,
        detail: `Lo tienen ${unique.map(label).join(" y ")}. Corrige el número en una de las fichas.` });
    }
  }

  for (const p of products) {
    if (p.expiresOn) {
      const left = daysBetween(today, p.expiresOn);
      if (left < 0) out.push({ id: `vence:${p.id}`, level: "alta", productId: p.id, title: `${p.name} está vencido`, detail: "No lo apliques; sácalo del inventario." });
      else if (left <= EXPIRY_WARN_DAYS) out.push({ id: `vence:${p.id}`, level: "media", productId: p.id, title: `${p.name} vence en ${left} días`, detail: `Quedan ${num(p.stock)} ${p.unit}.` });
    }
    if (p.kind !== "herramienta" && p.stock <= 0) out.push({ id: `stock:${p.id}`, level: "media", productId: p.id, title: `Se acabó ${p.name}`, detail: "Pídelo antes de la próxima aplicación." });
  }

  const pending = novelties.filter((n) => !n.reported);
  if (pending.length) {
    out.push({ id: "ica", level: "media", title: `${plural(pending.length, "novedad", "novedades")} por reportar al ICA`, detail: "Nacimientos, ingresos o salidas de los últimos 90 días." });
  }

  return out.sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]);
}

// ---------------------------------------------------------------- Costs

export interface CategoryTotal {
  category: string;
  kind: Movement["kind"];
  amount: number;
}

export interface MonthSummary {
  income: number;
  expense: number;
  profit: number;
  byCategory: CategoryTotal[];
  movements: Movement[];
}

/** Income, expenses and profit of one month ("YYYY-MM"), with categories from largest to smallest. */
export function monthSummary(movements: Movement[], month: string): MonthSummary {
  const inMonth = movements.filter((m) => m.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const totals = new Map<string, CategoryTotal>();
  let income = 0, expense = 0;
  for (const m of inMonth) {
    if (m.kind === "ingreso") income += m.amount; else expense += m.amount;
    const key = `${m.kind}:${m.category}`;
    const t = totals.get(key) ?? { category: m.category, kind: m.kind, amount: 0 };
    t.amount += m.amount;
    totals.set(key, t);
  }
  return { income, expense, profit: income - expense, byCategory: [...totals.values()].sort((a, b) => b.amount - a.amount), movements: inMonth };
}

/** "2026-10" → "2026-09" / "2026-11". */
export function shiftMonth(month: string, delta: number): string {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function monthName(month: string): string {
  const [y, m = 1] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export const EXPENSE_CATEGORIES = ["Alimentación y sal", "Sanidad", "Mano de obra", "Compra de animales", "Mantenimiento", "Otros"];
export const INCOME_CATEGORIES = ["Venta de leche", "Venta de animales", "Otros ingresos"];
