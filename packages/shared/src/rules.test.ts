import { describe, expect, it } from "vitest";
import type { AnimalEvent, Product } from "./domain";
import { isNewer } from "./sync";
import { addDays, ageText, categoryOf, doseAmount, exitCheck, inWithdrawal, money, normalizePhone, num, plural, shortDate, weightSummary, withdrawalFor, withdrawalPreview } from "./rules";

const ev = (over: Partial<AnimalEvent>): AnimalEvent => ({
  id: Math.random().toString(36), farmId: "f", animalId: "a", type: "nota", date: "2026-10-01", createdAt: "2026-10-01T10:00:00Z", ...over,
});

const oxi: Product = { id: "oxi", farmId: "f", name: "Oxitetraciclina 20 %", kind: "medicina", unit: "ml", stock: 60, withdrawalMilkDays: 7, withdrawalMeatDays: 28 };
const aftosa: Product = { id: "aft", farmId: "f", name: "Aftosa bivalente", kind: "vacuna", unit: "dosis", stock: 38, withdrawalMilkDays: 0, withdrawalMeatDays: 0 };

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-24", 28)).toBe("2026-11-21");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("formats age in days, months and years", () => {
    expect(ageText("2026-10-14", "2026-10-24")).toBe("10 días");
    expect(ageText("2026-02-01", "2026-10-24")).toBe("8 m");
    expect(ageText("2023-04-12", "2026-10-24")).toBe("3 a 6 m");
    expect(ageText("2024-10-24", "2026-10-24")).toBe("2 años");
  });

  it("shows the year only when it differs", () => {
    expect(shortDate("2026-10-24", "2026-10-29")).toBe("24 oct");
    expect(shortDate("2025-04-03", "2026-10-29")).toBe("3 abr 2025");
  });
});

describe("categoryOf", () => {
  it("follows age, sex and births", () => {
    expect(categoryOf("hembra", "2026-03-01", 0, "2026-10-24")).toBe("ternera");
    expect(categoryOf("hembra", "2024-06-01", 0, "2026-10-24")).toBe("novilla");
    expect(categoryOf("hembra", "2022-06-01", 2, "2026-10-24")).toBe("vaca");
    expect(categoryOf("macho", "2026-03-01", 0, "2026-10-24")).toBe("ternero");
    expect(categoryOf("macho", "2025-03-01", 0, "2026-10-24")).toBe("novillo");
    expect(categoryOf("macho", "2022-03-01", 0, "2026-10-24")).toBe("toro");
  });
});

describe("withdrawal", () => {
  const events = [ev({ type: "tratamiento", productId: "oxi", date: "2026-10-24" }), ev({ type: "vacuna", productId: "aft", date: "2026-10-20" })];

  it("takes the end of each product's withdrawal", () => {
    expect(withdrawalFor(events, [oxi, aftosa])).toEqual({ milkUntil: "2026-10-31", meatUntil: "2026-11-21" });
  });

  it("keeps the latest end when products overlap", () => {
    const more = [...events, ev({ type: "tratamiento", productId: "oxi", date: "2026-10-01" })];
    expect(withdrawalFor(more, [oxi]).meatUntil).toBe("2026-11-21");
  });

  it("ignores products with no withdrawal and unknown products", () => {
    expect(withdrawalFor([ev({ type: "vacuna", productId: "aft" }), ev({ type: "tratamiento", productId: "zzz" })], [aftosa])).toEqual({});
  });

  it("is active up to and including the last day", () => {
    const w = { milkUntil: "2026-10-31", meatUntil: "2026-11-21" };
    expect(inWithdrawal(w, "2026-10-31")).toEqual({ milk: true, meat: true });
    expect(inWithdrawal(w, "2026-11-01")).toEqual({ milk: false, meat: true });
    expect(inWithdrawal(w, "2026-11-22")).toEqual({ milk: false, meat: false });
  });
});

describe("withdrawalPreview", () => {
  it("shows only the periods the product has", () => {
    expect(withdrawalPreview("2026-10-24", oxi)).toEqual({ milkUntil: "2026-10-31", meatUntil: "2026-11-21" });
    expect(withdrawalPreview("2026-10-24", aftosa)).toEqual({ milkUntil: undefined, meatUntil: undefined });
  });
});

describe("doseAmount", () => {
  it("reads the number in a dose", () => {
    expect(doseAmount("20 ml")).toBe(20);
    expect(doseAmount("2,5 ml")).toBe(2.5);
    expect(doseAmount("1 dosis")).toBe(1);
    expect(doseAmount("una")).toBeUndefined();
  });
});

describe("exitCheck", () => {
  const w = { milkUntil: "2026-10-31", meatUntil: "2026-11-21" };
  it("blocks slaughter and meat sales during the meat withdrawal", () => {
    expect(exitCheck(w, "2026-10-29", "sacrificio").allowed).toBe(false);
    expect(exitCheck(w, "2026-10-29", "venta_carne").allowed).toBe(false);
    expect(exitCheck(w, "2026-11-22", "sacrificio").allowed).toBe(true);
  });
  it("allows a breeding sale but asks to warn the buyer", () => {
    expect(exitCheck(w, "2026-10-29", "venta_cria")).toEqual({ allowed: true, mustWarnBuyer: true });
    expect(exitCheck({}, "2026-10-29", "venta_cria")).toEqual({ allowed: true, mustWarnBuyer: false });
  });
});

describe("weightSummary", () => {
  it("returns the last weight and the daily gain between the last two", () => {
    const s = weightSummary([
      ev({ type: "pesaje", weightKg: 395, date: "2026-09-01" }),
      ev({ type: "pesaje", weightKg: 412, date: "2026-10-01" }),
      ev({ type: "vacuna", date: "2026-10-05" }),
    ]);
    expect(s).toEqual({ lastKg: 412, lastDate: "2026-10-01", dailyGainKg: 0.57 });
  });
  it("is empty without weighings", () => {
    expect(weightSummary([])).toEqual({});
  });
});

describe("normalizePhone", () => {
  it("accepts Colombian mobiles with or without prefix", () => {
    expect(normalizePhone("315 444 0099")).toBe("+573154440099");
    expect(normalizePhone("+57 315-444-0099")).toBe("+573154440099");
    expect(normalizePhone("573154440099")).toBe("+573154440099");
  });
  it("rejects landlines and short numbers", () => {
    expect(normalizePhone("8 871 2345")).toBeUndefined();
    expect(normalizePhone("315444")).toBeUndefined();
  });
});

describe("plural", () => {
  it("uses the singular only for one", () => {
    expect(plural(1, "animal", "animales")).toBe("1 animal");
    expect(plural(0, "animal", "animales")).toBe("0 animales");
  });
});

describe("num", () => {
  it("uses a decimal comma and drops trailing zeros", () => {
    expect(num(300.5)).toBe("300,5");
    expect(num(412)).toBe("412");
    expect(num(1.036, 2)).toBe("1,04");
  });
});

describe("money", () => {
  it("formats Colombian pesos", () => {
    expect(money(2_800_000)).toBe("$2.800.000");
    expect(money(-300_000)).toBe("−$300.000");
    expect(money(850)).toBe("$850");
  });
});

describe("isNewer (last write wins)", () => {
  it("replaces only with a strictly newer copy", () => {
    expect(isNewer({ updatedAt: "2026-10-30T10:00:00Z" }, { updatedAt: "2026-10-30T09:00:00Z" })).toBe(true);
    expect(isNewer({ updatedAt: "2026-10-30T09:00:00Z" }, { updatedAt: "2026-10-30T10:00:00Z" })).toBe(false);
    expect(isNewer({ updatedAt: "2026-10-30T10:00:00Z" }, { updatedAt: "2026-10-30T10:00:00Z" })).toBe(false);
    expect(isNewer({ createdAt: "2026-10-30T10:00:00Z" }, undefined)).toBe(true);
  });
});
