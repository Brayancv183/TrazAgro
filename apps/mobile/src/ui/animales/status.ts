import type { ReproStatus } from "@trazagro/shared";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The green status pill next to the name: "En ordeño", "Preñada" or the category ("Novilla", "Toro"). */
export function statusOf(x: { category: string; milkAvg?: number; repro?: ReproStatus }): string {
  if (x.milkAvg !== undefined) return "En ordeño";
  if (x.repro?.state === "prenada") return "Preñada";
  if (x.repro?.state === "parida") return "Recién parida";
  return cap(x.category);
}
