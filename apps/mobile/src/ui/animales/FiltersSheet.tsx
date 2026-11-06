import { StyleSheet, View } from "react-native";
import { colors, plural, type Lot } from "@trazagro/shared";
import { shortLot, type HerdRow } from "../../db/animales";
import { Sheet, Txt } from "../kit";
import { Tap } from "../motion";
import { FlexTap } from "./parts";

/** Keys of the sheet's chips. Inside a group any chip may match; between groups all must. */
export type FilterKey = string;

const GROUPS = (lots: Lot[]) => [
  { id: "sexo", title: "Sexo", chips: [["h", "Hembras"], ["m", "Machos"]] },
  ...(lots.length ? [{ id: "lote", title: "Lote", chips: lots.map((l) => [`lot:${l.id}`, shortLot(l)!]) }] : []),
  { id: "estado", title: "Estado", chips: [["pre", "Preñadas"], ["esp", "Días de espera"], ["vac", "Vacuna pendiente"], ["pes", "Pesaje pendiente"]] },
  { id: "id", title: "Identificación", chips: [["rfid", "Arete RFID"], ["norfid", "Sin RFID"], ["sin", "Sin arete"]] },
] as { id: string; title: string; chips: [string, string][] }[];

function test(r: HerdRow, k: FilterKey): boolean {
  if (k === "h") return r.a.sex === "hembra";
  if (k === "m") return r.a.sex === "macho";
  if (k.startsWith("lot:")) return r.a.lotId === k.slice(4);
  if (k === "pre") return r.repro?.state === "prenada";
  if (k === "esp") return r.retiro.meat || r.retiro.milk;
  if (k === "vac") return r.vaccineDue;
  if (k === "pes") return r.weighDue;
  if (k === "rfid") return !!r.a.rfid;
  if (k === "norfid") return !r.a.rfid;
  if (k === "sin") return !r.a.tagVisual;
  return true;
}

/** True when the row passes the chosen chips (OR inside a group, AND across groups). */
export function passes(r: HerdRow, on: Set<FilterKey>, lots: Lot[]): boolean {
  for (const g of GROUPS(lots)) {
    const picked = g.chips.map((c) => c[0]).filter((k) => on.has(k));
    if (picked.length && !picked.some((k) => test(r, k))) return false;
  }
  return true;
}

/** "Filtrar animales" (SheetFiltros.dc): chip groups and a CTA with the live result count. */
export function FiltersSheet({ open, onClose, on, setOn, lots, count, total }: {
  open: boolean; onClose: () => void; on: Set<FilterKey>; setOn: (s: Set<FilterKey>) => void; lots: Lot[]; count: number; total: number;
}) {
  const toggle = (k: string) => { const n = new Set(on); if (n.has(k)) n.delete(k); else n.add(k); setOn(n); };
  return (
    <Sheet open={open} onClose={onClose} title="Filtrar animales">
      {GROUPS(lots).map((g) => (
        <View key={g.id} accessibilityRole="none" accessibilityLabel={g.title} style={{ gap: 8 }}>
          <Txt w="extrabold" size={13} color={colors.tierra}>{g.title}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {g.chips.map(([k, label]) => {
              const a = on.has(k);
              return (
                <Tap key={k} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: a }} aria-selected={a} onPress={() => toggle(k)}
                  style={[s.chip, a ? { backgroundColor: colors.text, borderColor: colors.text } : null]}>
                  <Txt w="bold" size={14} color={a ? colors.onDark : colors.text}>{label}</Txt>
                </Tap>
              );
            })}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <FlexTap accessibilityRole="button" accessibilityLabel="Limpiar filtros" onPress={() => setOn(new Set())} disabled={!on.size} style={[s.cta, { backgroundColor: colors.sand }]}>
          <Txt w="extrabold" size={15} color={colors.link}>Limpiar</Txt>
        </FlexTap>
        <FlexTap flex={2} accessibilityRole="button" accessibilityLabel={on.size ? `Ver ${plural(count, "animal", "animales")}` : `Ver los ${total} animales`} onPress={onClose} style={[s.cta, { backgroundColor: colors.selva }]}>
          <Txt w="extrabold" size={16} color={colors.onDark}>{on.size ? `Ver ${plural(count, "animal", "animales")}` : `Ver los ${total} animales`}</Txt>
        </FlexTap>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  chip: { height: 42, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: "#D5D0C4", backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  cta: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
