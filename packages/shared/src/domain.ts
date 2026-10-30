/**
 * Domain model. Dates are ISO calendar dates ("YYYY-MM-DD"); timestamps are ISO strings.
 * Every id is a UUID generated on the device, so records can be created offline and synced later.
 */

export type Role = "dueno" | "administrador" | "tecnico" | "vaquero" | "solo_ver";

export type AnimalSex = "hembra" | "macho";

/** "trasladado": moved to another of the owner's farms, where it continues as a new record. */
export type AnimalStatus = "activo" | "vendido" | "muerto" | "sacrificado" | "perdido" | "trasladado";

export type AnimalOrigin = "nacido" | "comprado";

export interface Farm {
  id: string;
  name: string;
  municipality: string;
  department: string;
  hectares?: number;
  icaRegistration?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lot {
  id: string;
  farmId: string;
  name: string;
  purpose?: string;
}

export interface Animal {
  id: string;
  farmId: string;
  lotId?: string;
  /** Visual DIN ear-tag number, e.g. "00123". */
  tagVisual?: string;
  /** RFID chip code read from the electronic tag. */
  rfid?: string;
  name?: string;
  sex: AnimalSex;
  breed?: string;
  birthDate: string;
  origin: AnimalOrigin;
  motherId?: string;
  fatherId?: string;
  /** Free text when the sire is not in the herd (e.g. semen straw code). */
  sireNote?: string;
  status: AnimalStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * "baja": the animal left the herd (its `notes` carry the reason, its status the outcome).
 * "reporte_ica": the person confirmed a novelty was reported in SINIGAN (`notes` = novelty kind).
 * "servicio": mating or insemination (`notes` = "monta: …" or "ia: …").
 * "diagnostico": pregnancy check (`notes` = "preñada" | "vacia").
 * "secado": the cow stops being milked before calving.
 * "traslado": moved to another lot (`notes` = new lot name).
 */
export type EventType =
  | "vacuna" | "tratamiento" | "desparasitacion" | "pesaje" | "parto" | "servicio" | "diagnostico" | "secado"
  | "traslado" | "baja" | "nota" | "reporte_ica";

export type WeightMethod = "bascula" | "foto" | "manual";

/** Events are append-only: they are never edited, a correction is a new event. */
export interface AnimalEvent {
  id: string;
  farmId: string;
  animalId: string;
  type: EventType;
  date: string;
  productId?: string;
  dose?: string;
  /** Amount of the product used, in the product's unit. Inventory is stock minus these. */
  quantity?: number;
  weightKg?: number;
  weightMethod?: WeightMethod;
  /** For "parto": the calf created by this birth. */
  calfId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export type ProductKind = "vacuna" | "medicina" | "insumo" | "herramienta";

export interface Product {
  id: string;
  farmId: string;
  name: string;
  kind: ProductKind;
  unit: string;
  /** Units available now: purchased stock minus what events have used. */
  stock: number;
  /** Withdrawal period after application, in days. 0 = none. */
  withdrawalMilkDays: number;
  withdrawalMeatDays: number;
  expiresOn?: string;
}

/** Milk produced: one cow (`animalId`) or the whole herd's tank (no animal). Append-only. */
export interface MilkRecord {
  id: string;
  farmId: string;
  date: string;
  session: "manana" | "tarde" | "dia";
  animalId?: string;
  liters: number;
  createdAt: string;
}

export type MovementKind = "ingreso" | "gasto";

export interface Movement {
  id: string;
  farmId: string;
  kind: MovementKind;
  category: string;
  amount: number;
  date: string;
  description: string;
  animalId?: string;
  receiptUri?: string;
  createdAt: string;
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  role: Role;
  farmIds: string[];
  createdAt: string;
}

export type PlanTier = "esencial" | "pro" | "gremio";
