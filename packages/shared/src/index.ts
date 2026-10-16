export type Role = "ganadero" | "tecnico" | "super_admin";

export type Species = "bovino" | "bufalo" | "ovino" | "caprino";

export type AnimalSex = "macho" | "hembra";

export type PlanTier = "esencial" | "pro" | "gremio";

export type LinkMode = "rfid" | "lorawan" | "meshtastic" | "gsat" | "lte";

export interface Farm {
  id: string;
  tenantId: string;
  name: string;
  municipality?: string;
  department?: string;
  hectares?: number;
  icaRegistration?: string;
  createdAt: string;
}

export interface Animal {
  id: string;
  farmId: string;
  tagNumber: string;
  rfidCode?: string;
  name?: string;
  species: Species;
  sex: AnimalSex;
  breed?: string;
  birthDate?: string;
  motherId?: string;
  fatherId?: string;
  lotId?: string;
  status: "activo" | "vendido" | "muerto" | "baja";
  linkMode: LinkMode;
  createdAt: string;
  updatedAt: string;
}

export interface HealthEvent {
  id: string;
  animalId: string;
  type: "vacunacion" | "desparasitacion" | "enfermedad" | "tratamiento" | "revision" | "otro";
  date: string;
  description: string;
  product?: string;
  dose?: string;
  veterinarian?: string;
  nextDueDate?: string;
  createdAt: string;
}

export interface WeightRecord {
  id: string;
  animalId: string;
  date: string;
  weightKg: number;
  source: "báscula" | "estimado";
  notes?: string;
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
