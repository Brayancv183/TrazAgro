import type { AnimalEvent, AnimalSex, Product } from "./domain";

const DAY = 86_400_000;

function ymd(day: string): [number, number, number] {
  const [y = 0, m = 1, d = 1] = day.slice(0, 10).split("-").map(Number);
  return [y, m, d];
}

/** Parse a "YYYY-MM-DD" date as UTC midnight so day math never shifts with the device time zone. */
export function parseDay(day: string): number {
  const [y, m, d] = ymd(day);
  return Date.UTC(y, m - 1, d);
}

export function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return formatDay(parseDay(day) + days * DAY);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / DAY);
}

export function todayDay(now: Date = new Date()): string {
  return formatDay(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Whole months between two days (birth day counts as a full month boundary). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = ymd(from);
  const [ty, tm, td] = ymd(to);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return Math.max(0, months);
}

/** "3 a 6 m", "8 m", "15 días". */
export function ageText(birthDate: string, today: string): string {
  const months = monthsBetween(birthDate, today);
  if (months === 0) {
    const days = Math.max(0, daysBetween(birthDate, today));
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} m`;
  return rest === 0 ? `${years} ${years === 1 ? "año" : "años"}` : `${years} a ${rest} m`;
}

export type Category = "ternera" | "novilla" | "vaca" | "ternero" | "novillo" | "toro";

/** Herd category from sex, age and births. Changes on its own as the animal grows. */
export function categoryOf(sex: AnimalSex, birthDate: string, births: number, today: string): Category {
  const months = monthsBetween(birthDate, today);
  if (sex === "hembra") {
    if (months < 12) return "ternera";
    return births > 0 ? "vaca" : "novilla";
  }
  if (months < 12) return "ternero";
  return months < 24 ? "novillo" : "toro";
}

export interface Withdrawal {
  /** Last day milk can't be sold; undefined when there is no active or past withdrawal. */
  milkUntil?: string;
  meatUntil?: string;
}

const APPLIED: ReadonlyArray<AnimalEvent["type"]> = ["vacuna", "tratamiento", "desparasitacion"];

/** Latest withdrawal end dates produced by every product applied to the animal. */
export function withdrawalFor(events: AnimalEvent[], products: Product[]): Withdrawal {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: Withdrawal = {};
  for (const e of events) {
    if (!APPLIED.includes(e.type) || !e.productId) continue;
    const p = byId.get(e.productId);
    if (!p) continue;
    if (p.withdrawalMilkDays > 0) {
      const until = addDays(e.date, p.withdrawalMilkDays);
      if (!out.milkUntil || until > out.milkUntil) out.milkUntil = until;
    }
    if (p.withdrawalMeatDays > 0) {
      const until = addDays(e.date, p.withdrawalMeatDays);
      if (!out.meatUntil || until > out.meatUntil) out.meatUntil = until;
    }
  }
  return out;
}

/** Withdrawal that a single application of `product` on `date` would create (shown before saving). */
export function withdrawalPreview(date: string, product: Pick<Product, "withdrawalMilkDays" | "withdrawalMeatDays">): Withdrawal {
  return {
    milkUntil: product.withdrawalMilkDays > 0 ? addDays(date, product.withdrawalMilkDays) : undefined,
    meatUntil: product.withdrawalMeatDays > 0 ? addDays(date, product.withdrawalMeatDays) : undefined,
  };
}

/** Numeric amount in a dose like "20 ml", "2,5 ml" or "1 dosis"; undefined when there is none. */
export function doseAmount(dose: string): number | undefined {
  const m = dose.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

export function inWithdrawal(w: Withdrawal, today: string): { milk: boolean; meat: boolean } {
  return { milk: !!w.milkUntil && today <= w.milkUntil, meat: !!w.meatUntil && today <= w.meatUntil };
}

export type ExitPurpose = "venta_cria" | "venta_carne" | "sacrificio";

/**
 * Whether an animal may leave the farm today. Meat-bound exits are blocked during the meat
 * withdrawal; a sale for breeding is allowed but the buyer must be told.
 */
export function exitCheck(w: Withdrawal, today: string, purpose: ExitPurpose): { allowed: boolean; mustWarnBuyer: boolean } {
  const active = inWithdrawal(w, today);
  if (purpose === "venta_cria") return { allowed: true, mustWarnBuyer: active.meat || active.milk };
  return { allowed: !active.meat, mustWarnBuyer: false };
}

export interface WeightSummary {
  lastKg?: number;
  lastDate?: string;
  /** Average daily gain between the last two weighings, in kg/day. */
  dailyGainKg?: number;
}

export function weightSummary(events: AnimalEvent[]): WeightSummary {
  const weights = events
    .filter((e) => e.type === "pesaje" && typeof e.weightKg === "number")
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
  const last = weights[weights.length - 1];
  if (!last) return {};
  const prev = weights[weights.length - 2];
  const days = prev ? daysBetween(prev.date, last.date) : 0;
  return {
    lastKg: last.weightKg,
    lastDate: last.date,
    dailyGainKg: prev && days > 0 ? Math.round(((last.weightKg! - prev.weightKg!) / days) * 100) / 100 : undefined,
  };
}

/** "24 oct", "3 ene 2025" (year only when it differs from the reference year). */
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function shortDate(day: string, today?: string): string {
  const [y, m, d] = ymd(day);
  const base = `${d} ${MONTHS[m - 1]}`;
  return today && today.slice(0, 4) === day.slice(0, 4) ? base : `${base} ${y}`;
}

/**
 * Colombian mobile number in E.164 ("+573154440099"), or undefined when it isn't one.
 * Accepts spaces, dashes and an optional +57 / 57 prefix.
 */
export function normalizePhone(input: string): string | undefined {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  return /^3\d{9}$/.test(digits) ? `+57${digits}` : undefined;
}

/** "1 animal", "3 animales", "1 finca". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Number with a decimal comma and at most `decimals` places: 300.5 → "300,5", 412 → "412". */
export function num(n: number, decimals = 1): string {
  const f = 10 ** decimals;
  return String(Math.round(n * f) / f).replace(".", ",");
}

/** "$1.250.000" — Colombian peso, no decimals. */
export function money(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
