import type { SQLiteDatabase } from "expo-sqlite";
import { addDays, todayDay } from "@trazagro/shared";

/**
 * Demo farm used until real data exists. Dates are relative to the install day so withdrawal
 * periods, ages and weighings always look current. Demo rows never enter sync_outbox.
 */
export async function seedDemo(db: SQLiteDatabase) {
  const today = todayDay();
  const ago = (days: number) => addDays(today, -days);
  const now = new Date().toISOString();
  // The demo farm has existed for a while: its initial herd is not a recent ICA arrival.
  const since = `${ago(400)}T12:00:00.000Z`;

  const farms = [
    ["demo-f1", "Finca La Esperanza", "Pitalito", "Huila", 45, "ICA-HUI-001234"],
    ["demo-f2", "Hacienda El Roble", "Garzón", "Huila", 120, null],
  ] as const;
  const lots = [
    ["demo-l1", "demo-f1", "Lote 1 · Ordeño", "Potrero Alto"],
    ["demo-l2", "demo-f1", "Lote 2 · Levante", "Potrero Bajo"],
    ["demo-l3", "demo-f1", "Lote 3 · La Quebrada", "En descanso"],
    ["demo-l4", "demo-f2", "Lote único", "Ceba"],
  ] as const;
  // id, farm, lot, tag, rfid, name, sex, breed, birth, origin, mother
  const animals: readonly (readonly [string, string, string, string, string | null, string, "hembra" | "macho", string, string, "nacido" | "comprado", string | null])[] = [
    ["demo-a-rosa", "demo-f1", "demo-l1", "00098", "985 2018 00098", "Rosa", "hembra", "Holstein", "2018-03-10", "comprado", null],
    ["demo-a-miel", "demo-f1", "demo-l1", "00123", "985 2024 00123", "Miel", "hembra", "Cruza Holstein", "2023-04-12", "nacido", "demo-a-rosa"],
    ["demo-a-capitan", "demo-f1", "demo-l2", "00124", "985 2024 00124", "Capitán", "macho", "Brahman", "2021-11-03", "comprado", null],
    ["demo-a-estrella", "demo-f1", "demo-l2", "00125", null, "Estrella", "hembra", "Cruza Gyr", "2024-08-20", "nacido", null],
    ["demo-a-canela", "demo-f1", "demo-l1", "00126", "985 2024 00126", "Canela", "hembra", "Normando", "2020-06-15", "comprado", null],
    ["demo-a-perla", "demo-f1", "demo-l1", "00129", "985 2024 00129", "Perla", "hembra", "Gyr", "2019-09-09", "comprado", null],
    ["demo-a-negra", "demo-f1", "demo-l1", "00130", null, "Negra", "hembra", "Normando", "2022-02-02", "nacido", "demo-a-perla"],
    ["demo-a-bravo", "demo-f1", "demo-l2", "00131", null, "Bravo", "macho", "Cebú", "2025-03-15", "comprado", null],
    ["demo-a-luz", "demo-f1", "demo-l2", "00141", null, "Luz", "hembra", "Cruza Holstein", "2025-05-02", "nacido", "demo-a-miel"],
    ["demo-a-torito", "demo-f1", "demo-l2", "00142", null, "Torito", "macho", "Brahman", ago(150), "nacido", "demo-a-negra"],
    ["demo-a-luna", "demo-f1", "demo-l1", "00143", null, "Luna", "hembra", "Normando", ago(10), "nacido", "demo-a-canela"],
    ["demo-a-r1", "demo-f2", "demo-l4", "00201", "985 2024 00201", "Pinto", "macho", "Brahman", "2024-01-20", "comprado", null],
    ["demo-a-r2", "demo-f2", "demo-l4", "00202", null, "Moro", "macho", "Cebú", "2024-03-02", "comprado", null],
    ["demo-a-r3", "demo-f2", "demo-l4", "00203", null, "Lucero", "macho", "Brahman", "2023-12-11", "comprado", null],
  ];
  const products = [
    ["demo-p-aftosa", "demo-f1", "Aftosa bivalente", "vacuna", "dosis", 38, 0, 0, addDays(today, 170)],
    ["demo-p-oxi", "demo-f1", "Oxitetraciclina 20 %", "medicina", "ml", 60, 7, 28, addDays(today, 300)],
    ["demo-p-iver", "demo-f1", "Ivermectina 1 %", "medicina", "ml", 120, 0, 35, addDays(today, 200)],
    ["demo-p-rb51", "demo-f1", "Brucelosis RB51", "vacuna", "dosis", 12, 0, 0, addDays(today, 25)],
    ["demo-p-carbon", "demo-f1", "Carbón sintomático", "vacuna", "dosis", 4, 0, 0, addDays(today, 18)],
    ["demo-p-sal", "demo-f1", "Sal mineralizada", "insumo", "bulto", 6, 0, 0, null],
  ] as const;
  // id, animal, type, date, product, dose, weight, method, calf
  const events: readonly (readonly [string, string, string, string, string | null, string | null, number | null, string | null, string | null])[] = [
    ["demo-e1", "demo-a-rosa", "parto", "2023-04-12", null, null, null, null, "demo-a-miel"],
    ["demo-e2", "demo-a-miel", "parto", "2025-05-02", null, null, null, null, "demo-a-luz"],
    ["demo-e3", "demo-a-miel", "pesaje", ago(62), null, null, 395, "bascula", null],
    ["demo-e4", "demo-a-miel", "pesaje", ago(31), null, null, 412, "bascula", null],
    ["demo-e5", "demo-a-miel", "vacuna", ago(120), "demo-p-aftosa", "2 ml", null, null, null],
    ["demo-e6", "demo-a-canela", "parto", "2023-07-20", null, null, null, null, null],
    ["demo-e7", "demo-a-canela", "parto", ago(10), null, null, null, null, "demo-a-luna"],
    ["demo-e8", "demo-a-canela", "tratamiento", ago(5), "demo-p-oxi", "20 ml", null, null, null],
    ["demo-e9", "demo-a-canela", "pesaje", ago(40), null, null, 468, "manual", null],
    ["demo-e10", "demo-a-estrella", "pesaje", ago(52), null, null, 338, "bascula", null],
    ["demo-e11", "demo-a-estrella", "pesaje", ago(21), null, null, 351, "bascula", null],
    ["demo-e12", "demo-a-estrella", "desparasitacion", ago(15), "demo-p-iver", "4 ml", null, null, null],
    ["demo-e13", "demo-a-capitan", "pesaje", ago(30), null, null, 562, "bascula", null],
    ["demo-e14", "demo-a-perla", "parto", "2022-02-02", null, null, null, null, "demo-a-negra"],
    ["demo-e15", "demo-a-negra", "parto", ago(150), null, null, null, null, "demo-a-torito"],
    ["demo-e16", "demo-a-perla", "vacuna", ago(120), "demo-p-aftosa", "2 ml", null, null, null],
    ["demo-e17", "demo-a-bravo", "pesaje", ago(14), null, null, 286, "manual", null],
  ];
  const movements = [
    ["demo-m1", "demo-f1", "ingreso", "Venta de leche", 5_200_000, ago(3), "Leche de 18 vacas en ordeño"],
    ["demo-m2", "demo-f1", "ingreso", "Venta de animales", 3_700_000, ago(9), "Novillo vendido en feria"],
    ["demo-m3", "demo-f1", "gasto", "Alimentación y sal", 2_377_200, ago(6), "Sal mineralizada y concentrado"],
    ["demo-m4", "demo-f1", "gasto", "Mano de obra", 1_698_000, ago(4), "Jornales del mes"],
    ["demo-m5", "demo-f1", "gasto", "Sanidad", 1_018_800, ago(5), "Medicinas y vacunas"],
    ["demo-m6", "demo-f1", "gasto", "Otros", 566_000, ago(12), "Arreglo de cercas"],
  ] as const;

  await db.withTransactionAsync(async () => {
    for (const f of farms) {
      await db.runAsync("INSERT INTO farms VALUES (?,?,?,?,?,?,1,?,?)", ...f, since, now);
    }
    for (const l of lots) await db.runAsync("INSERT INTO lots VALUES (?,?,?,?)", ...l);
    for (const a of animals) {
      await db.runAsync(
        "INSERT INTO animals (id,farm_id,lot_id,tag_visual,rfid,name,sex,breed,birth_date,origin,mother_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'activo',?,?)",
        ...a, since, now,
      );
    }
    for (const p of products) await db.runAsync("INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?)", ...p);
    for (const e of events) {
      const farm = animals.find((a) => a[0] === e[1])![1];
      await db.runAsync(
        "INSERT INTO events (id,farm_id,animal_id,type,date,product_id,dose,weight_kg,weight_method,calf_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        e[0], farm, ...e.slice(1), now,
      );
    }
    for (const m of movements) {
      await db.runAsync("INSERT INTO movements (id,farm_id,kind,category,amount,date,description,created_at) VALUES (?,?,?,?,?,?,?,?)", ...m, now);
    }
  });
}

/** Reproduction events and two weeks of milk for the demo farm (added with database version 5). */
export async function seedDemoV5(db: SQLiteDatabase) {
  if (!(await db.getFirstAsync("SELECT 1 FROM farms WHERE id = 'demo-f1'"))) return;
  const today = todayDay();
  const ago = (days: number) => addDays(today, -days);
  const now = new Date().toISOString();
  const events = [
    ["demo-e-s1", "demo-a-rosa", "servicio", ago(200), "monta: Capitán"],
    ["demo-e-d1", "demo-a-rosa", "diagnostico", ago(150), "preñada"],
    ["demo-e-s2", "demo-a-miel", "servicio", ago(50), "ia: Holstein 7HO1234"],
    ["demo-e-s3", "demo-a-negra", "servicio", ago(70), "monta: Capitán"],
    ["demo-e-d3", "demo-a-negra", "diagnostico", ago(20), "vacia"],
  ] as const;
  const cows = [["demo-a-rosa", 18], ["demo-a-miel", 14], ["demo-a-canela", 16], ["demo-a-perla", 12], ["demo-a-negra", 10]] as const;
  await db.withTransactionAsync(async () => {
    for (const [id, animal, type, date, notes] of events) {
      await db.runAsync("INSERT OR IGNORE INTO events (id,farm_id,animal_id,type,date,notes,created_at) VALUES (?,?,?,?,?,?,?)", id, "demo-f1", animal, type, date, notes, now);
    }
    for (let d = 13; d >= 0; d--) {
      for (const [i, [animal, base]] of cows.entries()) {
        const liters = base + Math.round(Math.sin(d * 1.7 + i) * 2 + Math.cos(d * 0.9) * 1.5);
        await db.runAsync("INSERT OR IGNORE INTO milk (id,farm_id,date,session,animal_id,liters,created_at) VALUES (?,?,?,?,?,?,?)",
          `demo-m-${d}-${i}`, "demo-f1", ago(d), "dia", animal, liters, now);
      }
    }
  });
}
