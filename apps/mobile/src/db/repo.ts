import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { num } from "@trazagro/shared";
import type { Animal, AnimalEvent, AnimalOrigin, AnimalSex, EventType, Farm, Lot, MilkRecord, Movement, MovementKind, NoveltyKind, Product, ProductKind, WeightMethod } from "@trazagro/shared";

type Row = Record<string, any>;

const toFarm = (r: Row): Farm => ({
  id: r.id, name: r.name, municipality: r.municipality, department: r.department,
  hectares: r.hectares ?? undefined, icaRegistration: r.ica_registration ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const toAnimal = (r: Row): Animal => ({
  id: r.id, farmId: r.farm_id, lotId: r.lot_id ?? undefined, tagVisual: r.tag_visual ?? undefined,
  rfid: r.rfid ?? undefined, name: r.name ?? undefined, sex: r.sex, breed: r.breed ?? undefined,
  birthDate: r.birth_date, origin: r.origin, motherId: r.mother_id ?? undefined, fatherId: r.father_id ?? undefined,
  sireNote: r.sire_note ?? undefined, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
});

const toEvent = (r: Row): AnimalEvent => ({
  id: r.id, farmId: r.farm_id, animalId: r.animal_id, type: r.type, date: r.date,
  productId: r.product_id ?? undefined, dose: r.dose ?? undefined, quantity: r.quantity ?? undefined, weightKg: r.weight_kg ?? undefined,
  weightMethod: r.weight_method ?? undefined, calfId: r.calf_id ?? undefined, notes: r.notes ?? undefined,
  createdBy: r.created_by ?? undefined, createdAt: r.created_at,
});

const toProduct = (r: Row): Product => ({
  id: r.id, farmId: r.farm_id, name: r.name, kind: r.kind, unit: r.unit, stock: r.stock,
  withdrawalMilkDays: r.withdrawal_milk_days, withdrawalMeatDays: r.withdrawal_meat_days, expiresOn: r.expires_on ?? undefined,
});

export interface FarmSummary extends Farm {
  animalCount: number;
  isDemo: boolean;
}

export async function listFarms(db: SQLiteDatabase): Promise<FarmSummary[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT f.*, (SELECT COUNT(*) FROM animals a WHERE a.farm_id = f.id AND a.status = 'activo') AS animal_count
     FROM farms f ORDER BY f.name`,
  );
  return rows.map((r) => ({ ...toFarm(r), animalCount: r.animal_count, isDemo: !!r.is_demo }));
}

export async function getFarm(db: SQLiteDatabase, id: string): Promise<Farm | null> {
  const r = await db.getFirstAsync<Row>("SELECT * FROM farms WHERE id = ?", id);
  return r ? toFarm(r) : null;
}

export async function listLots(db: SQLiteDatabase, farmId: string): Promise<Lot[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM lots WHERE farm_id = ? ORDER BY name", farmId);
  return rows.map((r) => ({ id: r.id, farmId: r.farm_id, name: r.name, purpose: r.purpose ?? undefined }));
}

export async function listAnimals(db: SQLiteDatabase, farmId: string): Promise<Animal[]> {
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM animals WHERE farm_id = ? AND status = 'activo' ORDER BY COALESCE(tag_visual, name)",
    farmId,
  );
  return rows.map(toAnimal);
}

export async function getAnimal(db: SQLiteDatabase, id: string): Promise<Animal | null> {
  const r = await db.getFirstAsync<Row>("SELECT * FROM animals WHERE id = ?", id);
  return r ? toAnimal(r) : null;
}

export async function listChildren(db: SQLiteDatabase, motherId: string): Promise<Animal[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM animals WHERE mother_id = ? ORDER BY birth_date", motherId);
  return rows.map(toAnimal);
}

export async function findByTag(db: SQLiteDatabase, farmId: string, code: string): Promise<Animal | null> {
  const r = await db.getFirstAsync<Row>(
    "SELECT * FROM animals WHERE farm_id = ? AND (tag_visual = ? OR REPLACE(rfid,' ','') = REPLACE(?,' ','')) ORDER BY status = 'activo' DESC",
    farmId, code, code,
  );
  return r ? toAnimal(r) : null;
}

export async function listEvents(db: SQLiteDatabase, animalId: string): Promise<AnimalEvent[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM events WHERE animal_id = ? ORDER BY date DESC, created_at DESC", animalId);
  return rows.map(toEvent);
}

/** Events of every animal in a farm — used to compute withdrawal and weights for lists. */
export async function listFarmEvents(db: SQLiteDatabase, farmId: string): Promise<AnimalEvent[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM events WHERE farm_id = ?", farmId);
  return rows.map(toEvent);
}

/** Products with their available stock: purchased stock minus every quantity events have used. */
export async function listProducts(db: SQLiteDatabase, farmId: string): Promise<Product[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT p.*, p.stock - COALESCE((SELECT SUM(e.quantity) FROM events e WHERE e.product_id = p.id), 0) AS available
     FROM products p WHERE p.farm_id = ? ORDER BY p.name`,
    farmId,
  );
  return rows.map((r) => ({ ...toProduct(r), stock: r.available }));
}

async function isDemoFarm(db: SQLiteDatabase, farmId: string) {
  const r = await db.getFirstAsync<{ is_demo: number }>("SELECT is_demo FROM farms WHERE id = ?", farmId);
  return !!r?.is_demo;
}

async function outbox(db: SQLiteDatabase, farmId: string, table: string, id: string, op: "insert" | "update", payload: object) {
  if (await isDemoFarm(db, farmId)) return;
  await db.runAsync(
    "INSERT INTO sync_outbox (table_name, record_id, op, payload, created_at) VALUES (?,?,?,?,?)",
    table, id, op, JSON.stringify(payload), new Date().toISOString(),
  );
}

export interface NewAnimalInput {
  farmId: string;
  lotId?: string;
  tagVisual?: string;
  rfid?: string;
  name?: string;
  sex: AnimalSex;
  breed?: string;
  birthDate: string;
  origin: AnimalOrigin;
  motherId?: string;
  sireNote?: string;
  purchase?: { seller: string; price: number; date: string };
}

export class DuplicateTagError extends Error {
  constructor(public existing: Animal) {
    super(`El arete ya está registrado (${existing.name ?? existing.tagVisual})`);
  }
}

/**
 * Registers an animal. A birth also adds a "parto" event to the mother; a purchase adds its
 * expense to the farm's books. Everything runs in one transaction with its outbox rows.
 */
export async function createAnimal(db: SQLiteDatabase, input: NewAnimalInput): Promise<Animal> {
  for (const code of [input.tagVisual, input.rfid]) {
    if (!code) continue;
    // A tag of an animal that already left (sold, dead) can be reused, as when editing.
    const existing = await findByTag(db, input.farmId, code);
    if (existing && existing.status === "activo") throw new DuplicateTagError(existing);
  }
  const now = new Date().toISOString();
  const animal: Animal = {
    id: randomUUID(), farmId: input.farmId, lotId: input.lotId, tagVisual: input.tagVisual || undefined,
    rfid: input.rfid || undefined, name: input.name || undefined, sex: input.sex, breed: input.breed,
    birthDate: input.birthDate, origin: input.origin, motherId: input.origin === "nacido" ? input.motherId : undefined,
    sireNote: input.sireNote, status: "activo", createdAt: now, updatedAt: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO animals (id,farm_id,lot_id,tag_visual,rfid,name,sex,breed,birth_date,origin,mother_id,sire_note,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      animal.id, animal.farmId, animal.lotId ?? null, animal.tagVisual ?? null, animal.rfid ?? null, animal.name ?? null,
      animal.sex, animal.breed ?? null, animal.birthDate, animal.origin, animal.motherId ?? null, animal.sireNote ?? null,
      animal.status, now, now,
    );
    await outbox(db, animal.farmId, "animals", animal.id, "insert", animal);

    if (animal.motherId) {
      const birth: AnimalEvent = {
        id: randomUUID(), farmId: animal.farmId, animalId: animal.motherId, type: "parto",
        date: animal.birthDate, calfId: animal.id, createdAt: now,
      };
      await db.runAsync(
        "INSERT INTO events (id,farm_id,animal_id,type,date,calf_id,created_at) VALUES (?,?,?,?,?,?,?)",
        birth.id, birth.farmId, birth.animalId, birth.type, birth.date, birth.calfId!, now,
      );
      await outbox(db, animal.farmId, "events", birth.id, "insert", birth);
    }

    if (input.origin === "comprado" && input.purchase && input.purchase.price > 0) {
      const id = randomUUID();
      const label = animal.name ?? animal.tagVisual ?? "animal";
      const movement = {
        id, farmId: animal.farmId, kind: "gasto", category: "Compra de animales", amount: input.purchase.price,
        date: input.purchase.date, description: `Compra de ${label} a ${input.purchase.seller}`, animalId: animal.id, createdAt: now,
      };
      await db.runAsync(
        "INSERT INTO movements (id,farm_id,kind,category,amount,date,description,animal_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        id, movement.farmId, movement.kind, movement.category, movement.amount, movement.date, movement.description, animal.id, now,
      );
      await outbox(db, animal.farmId, "movements", id, "insert", movement);
    }
  });
  return animal;
}

export type RecordableType = "vacuna" | "tratamiento" | "desparasitacion" | "pesaje" | "nota";

export interface RecordInput {
  farmId: string;
  type: RecordableType;
  date: string;
  animalIds: string[];
  productId?: string;
  dose?: string;
  /** Product used per animal, in the product's unit. */
  quantityEach?: number;
  /** For "pesaje": kilos per animal id. Animals without a weight are skipped. */
  weights?: Record<string, number>;
  weightMethod?: WeightMethod;
  notes?: string;
}

/** Records the same event for one or many animals in a single transaction. Returns how many were saved. */
export async function recordEvents(db: SQLiteDatabase, input: RecordInput): Promise<number> {
  const now = new Date().toISOString();
  const targets = input.type === "pesaje"
    ? input.animalIds.filter((id) => (input.weights?.[id] ?? 0) > 0)
    : input.animalIds;
  await db.withTransactionAsync(async () => {
    for (const animalId of targets) {
      const e: AnimalEvent = {
        id: randomUUID(), farmId: input.farmId, animalId, type: input.type, date: input.date,
        productId: input.productId, dose: input.dose, quantity: input.productId ? input.quantityEach : undefined,
        weightKg: input.type === "pesaje" ? input.weights![animalId] : undefined,
        weightMethod: input.type === "pesaje" ? input.weightMethod : undefined, notes: input.notes, createdAt: now,
      };
      await db.runAsync(
        `INSERT INTO events (id,farm_id,animal_id,type,date,product_id,dose,quantity,weight_kg,weight_method,notes,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        e.id, e.farmId, e.animalId, e.type, e.date, e.productId ?? null, e.dose ?? null, e.quantity ?? null,
        e.weightKg ?? null, e.weightMethod ?? null, e.notes ?? null, now,
      );
      await outbox(db, e.farmId, "events", e.id, "insert", e);
    }
  });
  return targets.length;
}

export interface NewFarmInput {
  name: string;
  municipality: string;
  department: string;
  hectares?: number;
  icaRegistration?: string;
}

/** Creates a real farm with a first lot. Both go to the outbox so they reach the server. */
export async function createFarm(db: SQLiteDatabase, input: NewFarmInput): Promise<Farm> {
  const now = new Date().toISOString();
  const farm: Farm = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  const lot: Lot = { id: randomUUID(), farmId: farm.id, name: "Lote 1" };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO farms (id,name,municipality,department,hectares,ica_registration,is_demo,created_at,updated_at) VALUES (?,?,?,?,?,?,0,?,?)",
      farm.id, farm.name, farm.municipality, farm.department, farm.hectares ?? null, farm.icaRegistration ?? null, now, now,
    );
    await outbox(db, farm.id, "farms", farm.id, "insert", farm);
    await db.runAsync("INSERT INTO lots (id,farm_id,name) VALUES (?,?,?)", lot.id, lot.farmId, lot.name);
    await outbox(db, farm.id, "lots", lot.id, "insert", lot);
  });
  return farm;
}

/** Every animal of the farm, including those that already left (for ICA novelties and history). */
export async function listAllAnimals(db: SQLiteDatabase, farmId: string): Promise<Animal[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM animals WHERE farm_id = ?", farmId);
  return rows.map(toAnimal);
}

const toMovement = (r: Row): Movement => ({
  id: r.id, farmId: r.farm_id, kind: r.kind, category: r.category, amount: r.amount, date: r.date,
  description: r.description, animalId: r.animal_id ?? undefined, receiptUri: r.receipt_uri ?? undefined, createdAt: r.created_at,
});

export async function listMovements(db: SQLiteDatabase, farmId: string): Promise<Movement[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM movements WHERE farm_id = ? ORDER BY date DESC, created_at DESC", farmId);
  return rows.map(toMovement);
}

export interface NewMovementInput {
  farmId: string;
  kind: MovementKind;
  category: string;
  amount: number;
  date: string;
  description: string;
  animalId?: string;
}

async function insertMovement(db: SQLiteDatabase, input: NewMovementInput): Promise<Movement> {
  const m: Movement = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
  await db.runAsync(
    "INSERT INTO movements (id,farm_id,kind,category,amount,date,description,animal_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    m.id, m.farmId, m.kind, m.category, m.amount, m.date, m.description, m.animalId ?? null, m.createdAt,
  );
  await outbox(db, m.farmId, "movements", m.id, "insert", m);
  return m;
}

export async function createMovement(db: SQLiteDatabase, input: NewMovementInput): Promise<Movement> {
  let m!: Movement;
  await db.withTransactionAsync(async () => { m = await insertMovement(db, input); });
  return m;
}

export type ExitReason = "murio" | "venta_cria" | "venta_carne" | "sacrificio" | "perdido";

const EXIT_STATUS: Record<ExitReason, Animal["status"]> = {
  murio: "muerto", venta_cria: "vendido", venta_carne: "vendido", sacrificio: "sacrificado", perdido: "perdido",
};
const EXIT_LABEL: Record<ExitReason, string> = {
  murio: "Murió", venta_cria: "Vendido para cría o leche", venta_carne: "Vendido para carne", sacrificio: "Sacrificio", perdido: "Perdido o robado",
};

export interface ExitInput {
  animal: Animal;
  reason: ExitReason;
  date: string;
  /** Sale price; when present, the income goes to the farm's books. */
  price?: number;
  buyer?: string;
  notes?: string;
}

/**
 * Takes an animal out of the herd: a "baja" event, the new status and, for a sale, its income.
 * The caller must have checked withdrawal periods with exitCheck() first.
 */
export async function recordExit(db: SQLiteDatabase, input: ExitInput): Promise<void> {
  const now = new Date().toISOString();
  const a = input.animal;
  const updated: Animal = { ...a, status: EXIT_STATUS[input.reason], updatedAt: now };
  const notes = [EXIT_LABEL[input.reason], input.buyer && `a ${input.buyer}`, input.notes].filter(Boolean).join(" · ");
  const e: AnimalEvent = { id: randomUUID(), farmId: a.farmId, animalId: a.id, type: "baja", date: input.date, notes, createdAt: now };
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO events (id,farm_id,animal_id,type,date,notes,created_at) VALUES (?,?,?,?,?,?,?)", e.id, e.farmId, e.animalId, e.type, e.date, notes, now);
    await outbox(db, a.farmId, "events", e.id, "insert", e);
    await db.runAsync("UPDATE animals SET status = ?, updated_at = ? WHERE id = ?", updated.status, now, a.id);
    await outbox(db, a.farmId, "animals", a.id, "update", updated);
    if ((input.reason === "venta_cria" || input.reason === "venta_carne") && input.price && input.price > 0) {
      await insertMovement(db, {
        farmId: a.farmId, kind: "ingreso", category: "Venta de animales", amount: input.price, date: input.date, animalId: a.id,
        description: `Venta de ${a.name ?? `#${a.tagVisual ?? ""}`}${input.buyer ? ` a ${input.buyer}` : ""}`,
      });
    }
  });
}

/**
 * Moves an animal to another of the person's farms: it leaves the origin herd (status "trasladado", with a
 * "baja" event) and starts a new record at the destination with the same tags, linked by a note.
 * Two records keep each farm's history and permissions separate.
 */
export async function transferAnimal(db: SQLiteDatabase, a: Animal, to: Farm, date: string, lotId?: string): Promise<Animal> {
  const now = new Date().toISOString();
  const from = await getFarm(db, a.farmId);
  const moved: Animal = { ...a, status: "trasladado", updatedAt: now };
  const copy: Animal = { ...a, id: randomUUID(), farmId: to.id, lotId, motherId: undefined, fatherId: undefined, origin: "comprado", status: "activo", createdAt: now, updatedAt: now,
    sireNote: a.sireNote };
  const out: AnimalEvent = { id: randomUUID(), farmId: a.farmId, animalId: a.id, type: "baja", date, notes: `Trasladado a ${to.name}`, createdAt: now };
  const arrived: AnimalEvent = { id: randomUUID(), farmId: to.id, animalId: copy.id, type: "nota", date, notes: `Llegó de ${from?.name ?? "otra finca"}`, createdAt: now };
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE animals SET status = ?, updated_at = ? WHERE id = ?", moved.status, now, a.id);
    await outbox(db, a.farmId, "animals", a.id, "update", moved);
    await db.runAsync(
      `INSERT INTO animals (id,farm_id,lot_id,tag_visual,rfid,name,sex,breed,birth_date,origin,sire_note,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      copy.id, copy.farmId, copy.lotId ?? null, copy.tagVisual ?? null, copy.rfid ?? null, copy.name ?? null, copy.sex, copy.breed ?? null,
      copy.birthDate, copy.origin, copy.sireNote ?? null, copy.status, now, now,
    );
    await outbox(db, to.id, "animals", copy.id, "insert", copy);
    for (const e of [out, arrived]) {
      await db.runAsync("INSERT INTO events (id,farm_id,animal_id,type,date,notes,created_at) VALUES (?,?,?,?,?,?,?)", e.id, e.farmId, e.animalId, e.type, e.date, e.notes!, now);
      await outbox(db, e.farmId, "events", e.id, "insert", e);
    }
  });
  return copy;
}

/** The person confirms a novelty was registered in SINIGAN. */
export async function markReported(db: SQLiteDatabase, farmId: string, animalId: string, kind: NoveltyKind): Promise<void> {
  const e: AnimalEvent = { id: randomUUID(), farmId, animalId, type: "reporte_ica", date: new Date().toISOString().slice(0, 10), notes: kind, createdAt: new Date().toISOString() };
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO events (id,farm_id,animal_id,type,date,notes,created_at) VALUES (?,?,?,?,?,?,?)", e.id, farmId, animalId, e.type, e.date, kind, e.createdAt);
    await outbox(db, farmId, "events", e.id, "insert", e);
  });
}

/** Everything the farm-level screens (alerts, ICA, costs) compute from. */
export async function loadFarmBundle(db: SQLiteDatabase, farmId: string) {
  const [farm, animals, events, products, movements] = await Promise.all([
    getFarm(db, farmId), listAllAnimals(db, farmId), listFarmEvents(db, farmId), listProducts(db, farmId), listMovements(db, farmId),
  ]);
  return { farm, animals, events, products, movements };
}

/** Device-only settings (current farm, theme…). Never synced. */
export async function getPref(db: SQLiteDatabase, key: string): Promise<string | undefined> {
  return (await db.getFirstAsync<{ value: string }>("SELECT value FROM prefs WHERE key = ?", key))?.value;
}

export async function setPref(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync("INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}

/** Farms shown on this phone: the demo ones can be hidden once there is a real farm. */
export async function listFarmsVisible(db: SQLiteDatabase): Promise<FarmSummary[]> {
  const hide = (await getPref(db, "hide_demo")) === "1";
  const all = await listFarms(db);
  return hide && all.some((f) => !f.isDemo) ? all.filter((f) => !f.isDemo) : all;
}

// ---------------------------------------------------------------- editing
// Lots and products have no updated_at column; their payload carries `updatedAt` so the server's
// last-write-wins accepts the edit.

export async function updateFarm(db: SQLiteDatabase, id: string, input: NewFarmInput): Promise<void> {
  const old = await getFarm(db, id);
  if (!old) return;
  const now = new Date().toISOString();
  const farm: Farm = { ...old, ...input, updatedAt: now };
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE farms SET name=?, municipality=?, department=?, hectares=?, ica_registration=?, updated_at=? WHERE id=?",
      farm.name, farm.municipality, farm.department, farm.hectares ?? null, farm.icaRegistration ?? null, now, id);
    await outbox(db, id, "farms", id, "update", farm);
  });
}

export async function saveLot(db: SQLiteDatabase, input: { id?: string; farmId: string; name: string; purpose?: string }): Promise<Lot> {
  const lot: Lot = { id: input.id ?? randomUUID(), farmId: input.farmId, name: input.name, purpose: input.purpose || undefined };
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO lots (id,farm_id,name,purpose) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, purpose=excluded.purpose",
      lot.id, lot.farmId, lot.name, lot.purpose ?? null);
    await outbox(db, lot.farmId, "lots", lot.id, input.id ? "update" : "insert", { ...lot, updatedAt: new Date().toISOString() });
  });
  return lot;
}

/** Moves animals to a lot: updates each animal and leaves a "traslado" event in its history. */
export async function moveAnimals(db: SQLiteDatabase, animals: Animal[], lot: Lot, date: string): Promise<void> {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const a of animals) {
      if (a.lotId === lot.id) continue;
      await db.runAsync("UPDATE animals SET lot_id = ?, updated_at = ? WHERE id = ?", lot.id, now, a.id);
      await outbox(db, a.farmId, "animals", a.id, "update", { ...a, lotId: lot.id, updatedAt: now });
      const e: AnimalEvent = { id: randomUUID(), farmId: a.farmId, animalId: a.id, type: "traslado", date, notes: lot.name, createdAt: now };
      await db.runAsync("INSERT INTO events (id,farm_id,animal_id,type,date,notes,created_at) VALUES (?,?,?,?,?,?,?)", e.id, e.farmId, e.animalId, e.type, e.date, lot.name, now);
      await outbox(db, a.farmId, "events", e.id, "insert", e);
    }
  });
}

export interface ProductInput {
  id?: string;
  farmId: string;
  name: string;
  kind: ProductKind;
  unit: string;
  withdrawalMilkDays: number;
  withdrawalMeatDays: number;
  expiresOn?: string;
}

/** Raw purchased stock (before uses): what the products.stock column holds. */
async function purchasedStock(db: SQLiteDatabase, id: string) {
  return (await db.getFirstAsync<{ stock: number }>("SELECT stock FROM products WHERE id = ?", id))?.stock ?? 0;
}

async function writeProduct(db: SQLiteDatabase, p: Omit<Product, "stock">, stock: number, op: "insert" | "update") {
  await db.runAsync(
    `INSERT INTO products (id,farm_id,name,kind,unit,stock,withdrawal_milk_days,withdrawal_meat_days,expires_on) VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind, unit=excluded.unit, stock=excluded.stock,
       withdrawal_milk_days=excluded.withdrawal_milk_days, withdrawal_meat_days=excluded.withdrawal_meat_days, expires_on=excluded.expires_on`,
    p.id, p.farmId, p.name, p.kind, p.unit, stock, p.withdrawalMilkDays, p.withdrawalMeatDays, p.expiresOn ?? null,
  );
  await outbox(db, p.farmId, "products", p.id, op, { ...p, stock, updatedAt: new Date().toISOString() });
}

/** Creates or edits a product. `addStock` is a purchase: it raises the stock and, with a price, books the expense. */
export async function saveProduct(db: SQLiteDatabase, input: ProductInput, addStock = 0, price = 0, date?: string): Promise<string> {
  const id = input.id ?? randomUUID();
  const p = { ...input, id, expiresOn: input.expiresOn || undefined };
  await db.withTransactionAsync(async () => {
    const stock = (input.id ? await purchasedStock(db, id) : 0) + addStock;
    await writeProduct(db, p, stock, input.id ? "update" : "insert");
    if (addStock > 0 && price > 0) {
      await insertMovement(db, {
        farmId: p.farmId, kind: "gasto", category: input.kind === "herramienta" ? "Mantenimiento" : input.kind === "insumo" ? "Alimentación y sal" : "Sanidad",
        amount: price, date: date ?? new Date().toISOString().slice(0, 10), description: `Compra de ${num(addStock)} ${p.unit} de ${p.name}`,
      });
    }
  });
  return id;
}

/** Writes off units that were lost, spilled or expired (not used on an animal). */
export async function adjustStock(db: SQLiteDatabase, product: Product, remove: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    const stock = Math.max(0, (await purchasedStock(db, product.id)) - remove);
    const { stock: _available, ...rest } = product;
    await writeProduct(db, rest, stock, "update");
  });
}

export interface AnimalEdit {
  tagVisual?: string;
  rfid?: string;
  name?: string;
  sex: AnimalSex;
  breed?: string;
  birthDate: string;
  lotId?: string;
  sireNote?: string;
}

/** Corrects an animal's record. Ear tag and RFID must stay unique among the farm's other active animals. */
export async function updateAnimal(db: SQLiteDatabase, a: Animal, edit: AnimalEdit): Promise<void> {
  for (const code of [edit.tagVisual, edit.rfid]) {
    if (!code) continue;
    const existing = await findByTag(db, a.farmId, code);
    if (existing && existing.id !== a.id && existing.status === "activo") throw new DuplicateTagError(existing);
  }
  const now = new Date().toISOString();
  const updated: Animal = {
    ...a, tagVisual: edit.tagVisual || undefined, rfid: edit.rfid || undefined, name: edit.name || undefined, sex: edit.sex,
    breed: edit.breed || undefined, birthDate: edit.birthDate, lotId: edit.lotId, sireNote: edit.sireNote || undefined, updatedAt: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE animals SET tag_visual=?, rfid=?, name=?, sex=?, breed=?, birth_date=?, lot_id=?, sire_note=?, updated_at=? WHERE id=?",
      updated.tagVisual ?? null, updated.rfid ?? null, updated.name ?? null, updated.sex, updated.breed ?? null, updated.birthDate,
      updated.lotId ?? null, updated.sireNote ?? null, now, a.id,
    );
    await outbox(db, a.farmId, "animals", a.id, "update", updated);
  });
}

/** Events without product or weight: service, pregnancy check, dry-off or a note. */
export async function recordSimple(db: SQLiteDatabase, farmId: string, animalIds: string[], type: EventType, date: string, notes?: string): Promise<void> {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const animalId of animalIds) {
      const e: AnimalEvent = { id: randomUUID(), farmId, animalId, type, date, notes, createdAt: now };
      await db.runAsync("INSERT INTO events (id,farm_id,animal_id,type,date,notes,created_at) VALUES (?,?,?,?,?,?,?)", e.id, farmId, animalId, type, date, notes ?? null, now);
      await outbox(db, farmId, "events", e.id, "insert", e);
    }
  });
}

// ---------------------------------------------------------------- milk

const toMilk = (r: Row): MilkRecord => ({
  id: r.id, farmId: r.farm_id, date: r.date, session: r.session, animalId: r.animal_id ?? undefined, liters: r.liters, createdAt: r.created_at,
});

export async function listMilk(db: SQLiteDatabase, farmId: string, from = "0000"): Promise<MilkRecord[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM milk WHERE farm_id = ? AND date >= ? ORDER BY date DESC, created_at DESC", farmId, from);
  return rows.map(toMilk);
}

/** Saves one milking: liters per cow (blank cows are skipped) or a single tank total without animal. */
export async function recordMilk(db: SQLiteDatabase, farmId: string, date: string, session: MilkRecord["session"], entries: { animalId?: string; liters: number }[]): Promise<number> {
  const now = new Date().toISOString();
  const valid = entries.filter((e) => e.liters > 0);
  await db.withTransactionAsync(async () => {
    for (const e of valid) {
      const m: MilkRecord = { id: randomUUID(), farmId, date, session, animalId: e.animalId, liters: e.liters, createdAt: now };
      await db.runAsync("INSERT INTO milk (id,farm_id,date,session,animal_id,liters,created_at) VALUES (?,?,?,?,?,?,?)", m.id, farmId, date, session, m.animalId ?? null, m.liters, now);
      await outbox(db, farmId, "milk", m.id, "insert", m);
    }
  });
  return valid.length;
}
