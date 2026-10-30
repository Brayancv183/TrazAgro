import { describe, expect, it } from "vitest";
import type { Animal, AnimalEvent, Movement, Product } from "./domain";
import { farmAlerts, monthName, monthSummary, noveltiesFor, shiftMonth } from "./farm";

const TODAY = "2026-10-30";
const FARM = { createdAt: "2026-01-10T12:00:00Z" };
const animal = (over: Partial<Animal>): Animal => ({
  id: "a", farmId: "f", sex: "hembra", birthDate: "2022-01-01", origin: "nacido", status: "activo", tagVisual: "00100",
  createdAt: "2026-01-10T12:00:00Z", updatedAt: "2026-01-10T12:00:00Z", ...over,
});
const ev = (over: Partial<AnimalEvent>): AnimalEvent => ({ id: Math.random().toString(36), farmId: "f", animalId: "a", type: "nota", date: TODAY, createdAt: `${TODAY}T08:00:00Z`, ...over });
const product = (over: Partial<Product>): Product => ({ id: "p", farmId: "f", name: "Oxi", kind: "medicina", unit: "ml", stock: 50, withdrawalMilkDays: 7, withdrawalMeatDays: 28, ...over });

describe("noveltiesFor (ICA)", () => {
  it("lists recent births, arrivals after the initial inventory, and exits", () => {
    const animals = [
      animal({ id: "cria", birthDate: "2026-10-20" }),
      animal({ id: "vieja", birthDate: "2020-01-01" }),
      animal({ id: "inicial", origin: "comprado", createdAt: "2026-01-10T15:00:00Z" }),
      animal({ id: "comprada", origin: "comprado", createdAt: "2026-10-25T09:00:00Z" }),
      animal({ id: "vendida", birthDate: "2021-01-01", status: "vendido" }),
    ];
    const events = [ev({ animalId: "vendida", type: "baja", date: "2026-10-28" })];
    const n = noveltiesFor(FARM, animals, events, TODAY);
    expect(n.map((x) => `${x.kind}:${x.animalId}`)).toEqual(["venta:vendida", "ingreso:comprada", "nacimiento:cria"]);
    expect(n.every((x) => !x.reported)).toBe(true);
  });

  it("marks a novelty reported once the person confirms it", () => {
    const n = noveltiesFor(FARM, [animal({ id: "cria", birthDate: "2026-10-20" })], [ev({ animalId: "cria", type: "reporte_ica", notes: "nacimiento" })], TODAY);
    expect(n[0]!.reported).toBe(true);
  });
});

describe("farmAlerts", () => {
  it("puts withdrawal and expired products first and skips animals that left", () => {
    const animals = [animal({ id: "a", name: "Canela" }), animal({ id: "b", name: "Ida", status: "vendido" }), animal({ id: "c", name: "Sin", tagVisual: undefined })];
    const events = [ev({ animalId: "a", type: "tratamiento", productId: "p", date: "2026-10-25" }), ev({ animalId: "b", type: "tratamiento", productId: "p", date: "2026-10-25" })];
    const products = [product({}), product({ id: "v", name: "Vacuna vieja", kind: "vacuna", expiresOn: "2026-10-01" }), product({ id: "pronto", name: "RB51", kind: "vacuna", expiresOn: "2026-11-15", stock: 12 })];
    const alerts = farmAlerts(animals, events, products, [], TODAY);
    expect(alerts.map((x) => x.id)).toEqual(["retiro:a", "vence:v", "arete:c", "vence:pronto"]);
    expect(alerts[0]!.detail).toBe("Leche hasta el 1 nov · carne hasta el 22 nov");
    const onlyMeat = farmAlerts([animal({ name: "Estrella" })], [ev({ type: "desparasitacion", productId: "iver", date: "2026-10-15" })],
      [product({ id: "iver", withdrawalMilkDays: 0, withdrawalMeatDays: 35 })], [], TODAY);
    expect(onlyMeat[0]!.detail).toBe("Carne hasta el 19 nov");
  });

  it("asks to weigh animals not weighed in two months and to report pending novelties", () => {
    const alerts = farmAlerts([animal({ name: "Bravo" })], [ev({ type: "pesaje", weightKg: 300, date: "2026-08-01" })], [],
      [{ kind: "nacimiento", animalId: "x", date: TODAY, reported: false }], TODAY);
    expect(alerts.map((x) => x.title)).toEqual(["1 novedad por reportar al ICA", "Pesar a Bravo"]);
  });
});

describe("duplicate tags", () => {
  it("flags the same ear tag on two active animals", () => {
    const alerts = farmAlerts([animal({ id: "x", name: "Luna", tagVisual: "00150" }), animal({ id: "y", name: "Lucía", tagVisual: "00150" }),
      animal({ id: "z", name: "Ida", tagVisual: "00150", status: "vendido" })], [], [], [], TODAY);
    expect(alerts.map((a) => a.title)).toEqual(["Arete 00150 repetido"]);
    expect(alerts[0]!.detail).toContain("Luna y Lucía");
  });
});

describe("monthSummary", () => {
  const mv = (kind: Movement["kind"], category: string, amount: number, date: string): Movement =>
    ({ id: Math.random().toString(36), farmId: "f", kind, category, amount, date, description: "", createdAt: date });
  it("totals one month by category", () => {
    const s = monthSummary([mv("ingreso", "Venta de leche", 5_000_000, "2026-10-03"), mv("gasto", "Sanidad", 800_000, "2026-10-05"),
      mv("gasto", "Sanidad", 200_000, "2026-10-20"), mv("gasto", "Otros", 900_000, "2026-09-30")], "2026-10");
    expect(s).toMatchObject({ income: 5_000_000, expense: 1_000_000, profit: 4_000_000 });
    expect(s.byCategory).toEqual([{ category: "Venta de leche", kind: "ingreso", amount: 5_000_000 }, { category: "Sanidad", kind: "gasto", amount: 1_000_000 }]);
    expect(s.movements.map((m) => m.date)).toEqual(["2026-10-20", "2026-10-05", "2026-10-03"]);
  });
  it("moves between months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthName("2026-10")).toBe("octubre 2026");
  });
});
