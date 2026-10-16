import type { Farm, Animal } from "@trazagro/shared";

export const colors = {
  primary: "#2E7D32",
  primaryDark: "#1B5E20",
  primaryLight: "#E8F5E9",
  accent: "#6D4C41",
  success: "#43A047",
  warning: "#F9A825",
  danger: "#D32F2F",
  info: "#1976D2",
  bg: "#F7F5EF",
  card: "#FFFFFF",
  text: "#1F2A1F",
  textMuted: "#6B7280",
  border: "#E5E1D8",
};

export const demoFarms: Farm[] = [
  {
    id: "finca-1",
    tenantId: "tenant-1",
    name: "Finca La Esperanza",
    municipality: "Pitalito",
    department: "Huila",
    hectares: 45,
    icaRegistration: "ICA-HUI-001234",
    createdAt: new Date().toISOString(),
  },
  {
    id: "finca-2",
    tenantId: "tenant-1",
    name: "Hacienda El Roble",
    municipality: "Garzón",
    department: "Huila",
    hectares: 120,
    createdAt: new Date().toISOString(),
  },
];

export const demoAnimals: Animal[] = [
  {
    id: "animal-1",
    farmId: "finca-1",
    tagNumber: "00123",
    rfidCode: "985-2024-00123",
    name: "Miel",
    species: "bovino",
    sex: "hembra",
    breed: "Cruza Holstein",
    birthDate: "2023-04-12",
    lotId: "lote-1",
    status: "activo",
    linkMode: "rfid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "animal-2",
    farmId: "finca-1",
    tagNumber: "00124",
    name: "Capitán",
    species: "bovino",
    sex: "macho",
    breed: "Brahman",
    birthDate: "2022-11-03",
    lotId: "lote-1",
    status: "activo",
    linkMode: "lorawan",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "animal-3",
    farmId: "finca-1",
    tagNumber: "00125",
    name: "Estrella",
    species: "bovino",
    sex: "hembra",
    breed: "Cruza Gyr",
    birthDate: "2024-01-20",
    lotId: "lote-2",
    status: "activo",
    linkMode: "rfid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "animal-4",
    farmId: "finca-2",
    tagNumber: "00201",
    rfidCode: "985-2024-00201",
    name: "Relámpago",
    species: "bovino",
    sex: "macho",
    breed: "Angus",
    birthDate: "2021-08-15",
    status: "activo",
    linkMode: "lorawan",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function getAnimalsByFarm(farmId: string): Animal[] {
  return demoAnimals.filter((a) => a.farmId === farmId);
}

export function getAnimal(id: string): Animal | undefined {
  return demoAnimals.find((a) => a.id === id);
}

export function getFarm(id: string): Farm | undefined {
  return demoFarms.find((f) => f.id === id);
}
