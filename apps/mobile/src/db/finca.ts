// Data helpers for the farm screens (fincas, lotes, costos, reportes, ICA). Reads only through repo.ts.
import type { SQLiteDatabase } from "expo-sqlite";
import {
  addDays, categoryOf, farmAlerts, inWithdrawal, noveltiesFor, shortDate, todayDay, weightSummary, withdrawalFor,
  type Animal, type AnimalEvent, type Movement,
} from "@trazagro/shared";
import { getPref, listLots, listMilk, loadFarmBundle, setPref } from "./repo";
import { csvRow, shareText } from "../lib/share";

type Bundle = Awaited<ReturnType<typeof loadFarmBundle>>;

/** Number of open alerts per farm (same rules as Inicio). */
export async function alertCounts(db: SQLiteDatabase, farmIds: string[]): Promise<Record<string, number>> {
  const today = todayDay();
  const out: Record<string, number> = {};
  for (const id of farmIds) {
    const b = await loadFarmBundle(db, id);
    out[id] = b.farm ? farmAlerts(b.animals, b.events, b.products, noveltiesFor(b.farm, b.animals, b.events, today), today).length : 0;
  }
  return out;
}

/** Days since the most recent move of an animal into this lot (from "traslado" events), if any. */
export function daysInLot(lotName: string, animals: Animal[], events: AnimalEvent[], today: string): number | undefined {
  const ids = new Set(animals.map((a) => a.id));
  const last = events.filter((e) => e.type === "traslado" && ids.has(e.animalId) && e.notes === lotName).map((e) => e.date).sort().pop();
  if (!last) return undefined;
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(last)) / 86400000));
}

// ---------------------------------------------------------------- money

export type Period = "mes" | "tri" | "ano";

/** First day of the period that ends with `month` ("YYYY-MM"): 1, 3 or 12 months. */
export function periodRange(period: Period, month: string): { from: string; to: string } {
  const n = period === "mes" ? 1 : period === "tri" ? 3 : 12;
  const [y = 0, m = 1] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - n, 1)).toISOString().slice(0, 7);
  return { from: `${start}-01`, to: `${month}-31` };
}

export interface CatGroup { category: string; amount: number; items: Movement[] }
export interface PeriodSummary { income: number; expense: number; profit: number; gastos: CatGroup[]; ingresos: CatGroup[] }

export function periodSummary(movements: Movement[], from: string, to: string): PeriodSummary {
  const inRange = movements.filter((m) => m.date >= from && m.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  const group = (kind: Movement["kind"]) => {
    const map = new Map<string, CatGroup>();
    for (const m of inRange.filter((x) => x.kind === kind)) {
      const g = map.get(m.category) ?? { category: m.category, amount: 0, items: [] };
      g.amount += m.amount;
      g.items.push(m);
      map.set(m.category, g);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  };
  const gastos = group("gasto"), ingresos = group("ingreso");
  const income = ingresos.reduce((n, g) => n + g.amount, 0), expense = gastos.reduce((n, g) => n + g.amount, 0);
  return { income, expense, profit: income - expense, gastos, ingresos };
}

// ---------------------------------------------------------------- ICA

export type CheckState = "si" | "medio" | "no";
export interface IcaCheck { state: CheckState; title: string; detail: string }

/** What the farm needs for SINIGAN, computed from its own records (no invented values). */
export function icaChecks(b: Bundle, today: string): { checks: IcaCheck[]; ok: number; pending: number } {
  const farm = b.farm!;
  const active = b.animals.filter((a) => a.status === "activo");
  const novelties = noveltiesFor(farm, b.animals, b.events, today);
  const pending = novelties.filter((n) => !n.reported).length;
  const yearAgo = addDays(today, -365);
  const vaccinated = new Set(b.events.filter((e) => e.type === "vacuna" && e.date >= yearAgo).map((e) => e.animalId));
  const vac = active.filter((a) => vaccinated.has(a.id)).length;
  const tag = active.filter((a) => a.tagVisual).length;
  const rfid = active.filter((a) => a.tagVisual && a.rfid).length;
  const n = active.length;
  const pct = (x: number) => (n ? Math.round((x / n) * 100) : 0);
  const checks: IcaCheck[] = [
    { state: farm.icaRegistration ? "si" : "no", title: "Registro ICA del predio", detail: farm.icaRegistration ? `Predio ${farm.icaRegistration}` : "Escribe el registro del predio en Mis fincas." },
    { state: pending ? "no" : "si", title: "Novedades reportadas en SINIGAN", detail: pending ? `${pending === 1 ? "Falta 1" : `Faltan ${pending}`} por reportar de los últimos 90 días.` : "Ninguna pendiente de los últimos 90 días." },
    { state: vac === n ? "si" : vac ? "medio" : "no", title: "Vacunación del último año", detail: `${vac} de ${n} vacunados (${pct(vac)} %).` },
    { state: tag === n ? "si" : tag ? "medio" : "no", title: "Arete visual", detail: `${tag} de ${n} con arete visual.` },
    { state: rfid === n ? "si" : rfid ? "medio" : "no", title: "Identificación DIN (visual + RFID)", detail: `${rfid} de ${n} con DIN. Obligatorio de forma gradual por edad.` },
  ];
  return { checks, ok: checks.filter((c) => c.state === "si").length, pending };
}

// ---------------------------------------------------------------- reports

export type ReportKind = "inventario" | "sanidad" | "finanzas" | "leche";
export const REPORT_NAME: Record<ReportKind, string> = { inventario: "Inventario del hato", sanidad: "Reporte sanitario", finanzas: "Ingresos y gastos", leche: "Producción de leche" };
const EVENT_LABEL: Record<string, string> = { vacuna: "Vacuna", tratamiento: "Tratamiento", desparasitacion: "Desparasitación" };
const SESSION_LABEL = { manana: "Mañana", tarde: "Tarde", dia: "Todo el día" } as const;
const STATUS = { activo: "Activo", vendido: "Vendido", muerto: "Muerto", sacrificado: "Sacrificado", perdido: "Perdido", trasladado: "Trasladado" } as const;

/** Builds a report and hands it to the share sheet (phone) or downloads it (computer). */
export async function exportReport(db: SQLiteDatabase, farmId: string, kind: ReportKind, opts: { onlyActive?: boolean } = {}) {
  const today = todayDay();
  const b = await loadFarmBundle(db, farmId);
  if (!b.farm) return "cancelled" as const;
  const slug = b.farm.name.replace(/\s+/g, "_");
  let r: Awaited<ReturnType<typeof shareText>>;
  if (kind === "inventario") {
    const lots = await listLots(db, farmId);
    const rows = b.animals.filter((a) => !opts.onlyActive || a.status === "activo").sort((x, y) => (x.tagVisual ?? "").localeCompare(y.tagVisual ?? "")).map((a) => {
      const ev = b.events.filter((e) => e.animalId === a.id);
      const w = weightSummary(ev);
      return csvRow([a.tagVisual, a.rfid, a.name, a.sex, a.breed, a.birthDate, categoryOf(a.sex, a.birthDate, ev.filter((e) => e.type === "parto").length, today),
        lots.find((l) => l.id === a.lotId)?.name, a.origin, w.lastKg, w.lastDate, STATUS[a.status]]);
    });
    r = await shareText(`Inventario ${b.farm.name}`, [csvRow(["Arete", "RFID", "Nombre", "Sexo", "Raza", "Nacimiento", "Categoría", "Lote", "Origen", "Último peso (kg)", "Fecha peso", "Estado"]), ...rows].join("\n"), `Inventario_${slug}_${today}.csv`);
  } else if (kind === "finanzas") {
    const from = addDays(today, -365);
    const rows = b.movements.filter((m) => m.date >= from).map((m) => csvRow([m.date, m.kind === "ingreso" ? "Ingreso" : "Gasto", m.category, m.description, m.kind === "ingreso" ? m.amount : -m.amount]));
    r = await shareText(`Finanzas ${b.farm.name}`, [csvRow(["Fecha", "Tipo", "Categoría", "Descripción", "Valor"]), ...rows].join("\n"), `Finanzas_${slug}_${today}.csv`);
  } else if (kind === "leche") {
    const milk = await listMilk(db, farmId, addDays(today, -30));
    const rows = milk.map((m) => {
      const a = b.animals.find((x) => x.id === m.animalId);
      return csvRow([m.date, SESSION_LABEL[m.session], a ? a.name ?? a.tagVisual : "Tanque", String(m.liters).replace(".", ",")]);
    });
    r = await shareText(`Leche ${b.farm.name}`, [csvRow(["Fecha", "Ordeño", "Vaca", "Litros"]), ...rows].join("\n"), `Leche_${slug}_${today}.csv`);
  } else {
    const active = b.animals.filter((a) => a.status === "activo");
    const retiro = active.map((a) => ({ a, w: withdrawalFor(b.events.filter((e) => e.animalId === a.id), b.products) })).filter((x) => { const on = inWithdrawal(x.w, today); return on.milk || on.meat; });
    const recent = b.events.filter((e) => ["vacuna", "tratamiento", "desparasitacion"].includes(e.type) && e.date >= addDays(today, -90)).sort((x, y) => y.date.localeCompare(x.date));
    const name = (id: string) => { const a = b.animals.find((x) => x.id === id); return a ? `${a.name ?? ""} #${a.tagVisual ?? ""}`.trim() : "?"; };
    const text = [
      `Reporte sanitario — ${b.farm.name} (${b.farm.municipality}, ${b.farm.department})${b.farm.icaRegistration ? ` · ${/^ICA/i.test(b.farm.icaRegistration) ? "" : "ICA "}${b.farm.icaRegistration}` : ""}`,
      `Fecha: ${shortDate(today)} · ${active.length} animales activos`,
      "",
      retiro.length ? "EN DÍAS DE RETIRO:" : "Ningún animal en días de retiro.",
      ...retiro.map(({ a, w }) => `· ${name(a.id)}: leche hasta ${w.milkUntil ? shortDate(w.milkUntil) : "—"}, carne hasta ${w.meatUntil ? shortDate(w.meatUntil) : "—"}`),
      "",
      "APLICACIONES (90 días):",
      ...recent.map((e) => `· ${shortDate(e.date)} ${EVENT_LABEL[e.type] ?? e.type} — ${name(e.animalId)} — ${b.products.find((p) => p.id === e.productId)?.name ?? ""} ${e.dose ?? ""}`.trim()),
      "",
      "Generado con TrazAgro",
    ].join("\n");
    r = await shareText(`Sanidad ${b.farm.name}`, text, `Sanidad_${slug}_${today}.txt`);
  }
  if (r !== "cancelled") await rememberReport(db, farmId, { kind, date: today, file: kind === "sanidad" ? "TXT" : "CSV" });
  return r;
}

export interface RecentReport { kind: ReportKind; date: string; file: "CSV" | "TXT" }

/** Reports generated on this phone (device-only, last 5). */
export async function recentReports(db: SQLiteDatabase, farmId: string): Promise<RecentReport[]> {
  try { return JSON.parse((await getPref(db, `reports:${farmId}`)) ?? "[]") as RecentReport[]; } catch { return []; }
}

async function rememberReport(db: SQLiteDatabase, farmId: string, r: RecentReport) {
  const list = [r, ...(await recentReports(db, farmId))].slice(0, 5);
  await setPref(db, `reports:${farmId}`, JSON.stringify(list));
}
