import type { IconName } from "../Icon";

/** TrazAgro hardware catalog (prices from the business plan, COP). Shared by Tienda, Suscripción and Mapa. */
export const CATALOG: { id: string; name: string; detail: string; price: number; icon: IconName; group: "rfid" | "gps" }[] = [
  { id: "rfid", name: "Par de aretes RFID DIN", detail: "134,2 kHz · Res. ICA 219/2026", price: 14000, icon: "tag", group: "rfid" },
  { id: "kit-rfid", name: "Kit finca RFID", detail: "50 pares RFID + registro en la app", price: 950000, icon: "box", group: "rfid" },
  { id: "lector", name: "Lector RFID Bluetooth", detail: "Lee el arete y lo escribe en la app", price: 249000, icon: "scan", group: "rfid" },
  { id: "gps", name: "Orejera GPS LoRa", detail: "Ubicación del animal, $0 al mes", price: 250000, icon: "gps", group: "gps" },
  { id: "gateway", name: "Gateway LoRa + instalación", detail: "Uno por finca, usa el internet de la casa", price: 1300000, icon: "gps", group: "gps" },
];
