import { describe, expect, it } from "vitest";
import type { Animal, AnimalEvent, MilkRecord, Movement } from "./domain";
import { agenda, herdMetrics, milkByDay, reproStatus } from "./herd";

const TODAY = "2026-10-30";
const animal = (over: Partial<Animal>): Animal => ({
  id: "a", farmId: "f", sex: "hembra", birthDate: "2021-01-01", origin: "nacido", status: "activo", tagVisual: "00100",
  createdAt: "2026-01-10T12:00:00Z", updatedAt: "2026-01-10T12:00:00Z", ...over,
});
const ev = (over: Partial<AnimalEvent>): AnimalEvent => ({ id: Math.random().toString(36), farmId: "f", animalId: "a", type: "nota", date: TODAY, createdAt: `${over.date ?? TODAY}T08:00:00Z`, ...over });

describe("reproStatus", () => {
  it("goes parida → servida → preñada with the expected calving date", () => {
    const calving = ev({ type: "parto", date: "2026-03-01" });
    expect(reproStatus([calving], TODAY)).toMatchObject({ state: "parida", openDays: 243 });
    const service = ev({ type: "servicio", date: "2026-09-01", notes: "monta: Toro" });
    expect(reproStatus([calving, service], TODAY)).toMatchObject({ state: "servida", checkOn: "2026-10-16" });
    const check = ev({ type: "diagnostico", date: "2026-10-20", notes: "preñada" });
    expect(reproStatus([calving, service, check], TODAY)).toMatchObject({ state: "prenada", expectedCalving: "2027-06-11", dryOffOn: "2027-04-12" });
  });

  it("an empty check sends her back to vacía, and a new calving resets the cycle", () => {
    const service = ev({ type: "servicio", date: "2026-08-01" });
    expect(reproStatus([service, ev({ type: "diagnostico", date: "2026-09-20", notes: "vacia" })], TODAY).state).toBe("vacia");
    expect(reproStatus([service, ev({ type: "parto", date: "2026-10-01" })], TODAY).state).toBe("parida");
  });
});

describe("agenda", () => {
  it("schedules pregnancy checks, calvings, dry-off and revaccination", () => {
    const events = [
      ev({ animalId: "lola", type: "servicio", date: "2026-09-20" }),
      ev({ animalId: "rosa", type: "servicio", date: "2026-01-10" }),
      ev({ animalId: "rosa", type: "diagnostico", date: "2026-03-01", notes: "preñada" }),
      ev({ animalId: "toro", type: "vacuna", date: "2026-05-10" }),
    ];
    const items = agenda([animal({ id: "lola", name: "Lola" }), animal({ id: "rosa", name: "Rosa" }), animal({ id: "toro", sex: "macho" })], events, [], TODAY);
    expect(items.map((i) => i.id)).toEqual(["parto:rosa", "diag:lola", "vacuna:toro"]);
  });
});

describe("milk and metrics", () => {
  it("adds liters per day, including empty days", () => {
    const r = (date: string, liters: number): MilkRecord => ({ id: date + liters, farmId: "f", date, session: "dia", liters, createdAt: date });
    expect(milkByDay([r("2026-10-29", 10), r("2026-10-29", 5.5), r("2026-10-30", 12)], "2026-10-28", TODAY)).toEqual([
      { date: "2026-10-28", liters: 0 }, { date: "2026-10-29", liters: 15.5 }, { date: "2026-10-30", liters: 12 },
    ]);
  });

  it("computes birth rate, mortality and net result per animal", () => {
    const animals = [animal({ id: "v1" }), animal({ id: "v2" }), animal({ id: "muerta", status: "muerto" }), animal({ id: "cria", birthDate: "2026-06-01" })];
    const events = [
      ev({ animalId: "v1", type: "parto", date: "2026-06-01", calfId: "cria" }),
      ev({ animalId: "v1", type: "parto", date: "2025-06-01" }),
      ev({ animalId: "muerta", type: "baja", date: "2026-08-01" }),
    ];
    const mv = (kind: Movement["kind"], amount: number): Movement => ({ id: kind, farmId: "f", kind, category: "x", amount, date: "2026-09-01", description: "", createdAt: "" });
    const m = herdMetrics(animals, events, [mv("ingreso", 3_900_000), mv("gasto", 300_000)], [], TODAY);
    expect(m).toMatchObject({ active: 3, births: 1, deaths: 1, birthRate: 33, mortality: 25, calvingInterval: 365, netPerAnimalMonth: 100000 });
  });
});
