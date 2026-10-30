import type { Role } from "./domain";
import { SYNC_TABLES, type SyncTable } from "./sync";

export const ROLES: Role[] = ["dueno", "administrador", "tecnico", "vaquero", "solo_ver"];

export const ROLE_LABEL: Record<Role, string> = {
  dueno: "Dueño",
  administrador: "Administrador",
  tecnico: "Técnico o veterinario",
  vaquero: "Vaquero",
  solo_ver: "Solo ver",
};

export const ROLE_DETAIL: Record<Role, string> = {
  dueno: "Todo, incluido el equipo y la plata",
  administrador: "Todo, menos cambiar al dueño",
  tecnico: "Animales, sanidad, inventario y leche. No ve la plata",
  vaquero: "Animales, vacunas, pesajes y leche. No ve la plata",
  solo_ver: "Consulta sin cambiar nada (socio, banco, comprador)",
};

/** Synced tables each role may write. The server enforces it; the app hides what a role can't do. */
const WRITES: Record<Role, readonly SyncTable[]> = {
  dueno: SYNC_TABLES,
  administrador: SYNC_TABLES,
  tecnico: ["animals", "events", "products", "milk", "lots"],
  vaquero: ["animals", "events", "milk"],
  solo_ver: [],
};

export const canWrite = (role: Role, table: SyncTable) => WRITES[role].includes(table);
export const canManageTeam = (role: Role) => role === "dueno" || role === "administrador";
export const canSeeMoney = (role: Role) => role === "dueno" || role === "administrador";

export interface Member {
  userId: string;
  phone: string;
  fullName?: string;
  role: Role;
}

export interface MyFarm {
  farmId: string;
  role: Role;
}
