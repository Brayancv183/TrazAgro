import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel, colors, plural, radius, shadow, todayDay, type Lot } from "@trazagro/shared";
import { listAnimals, listLots, moveAnimals, saveLot } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { Banner, Button, Card, Chip, EarTag, Empty, Field, GreenHeader, Sheet, Txt } from "../ui/kit";

/** Lots (potreros / grupos): create, rename and move animals between them. */
export default function LotesScreen() {
  const db = useSQLiteContext();
  const farmId = useFarmId();
  const { can } = useFarm();
  const [editing, setEditing] = useState<Partial<Lot>>();
  const [moving, setMoving] = useState<Lot>();
  const [picked, setPicked] = useState<string[]>([]);
  const [done, setDone] = useState<string>();
  const { data, reload } = useDbQuery(async (d) => ({ lots: await listLots(d, farmId), animals: await listAnimals(d, farmId) }), [farmId]);
  const lots = data?.lots ?? [];
  const animals = data?.animals ?? [];

  async function saveEditing(name: string, purpose: string) {
    await saveLot(db, { id: editing?.id, farmId, name, purpose });
    setEditing(undefined);
    reload();
  }

  async function confirmMove() {
    if (!moving) return;
    const chosen = animals.filter((a) => picked.includes(a.id));
    await moveAnimals(db, chosen, moving, todayDay());
    setDone(`${plural(chosen.length, "animal pasó", "animales pasaron")} a ${moving.name}`);
    setMoving(undefined);
    setPicked([]);
    reload();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker="HATO" title="Lotes y potreros">
          <Txt w="medium" size={15} color={colors.onDarkMuted}>{data ? `${plural(lots.length, "lote", "lotes")} · ${plural(animals.length, "animal", "animales")}` : "Cargando…"}</Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {done ? <Banner icon="check" tone="ok" title={done} /> : null}
          {lots.map((l) => {
            const inLot = animals.filter((a) => a.lotId === l.id);
            return (
              <Card key={l.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={s.icon}><Icon name="layers" color={colors.selva} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt w="bold" size={17}>{l.name}</Txt>
                    <Txt size={13} color={colors.textMuted}>{[l.purpose, plural(inLot.length, "animal", "animales")].filter(Boolean).join(" · ")}</Txt>
                  </View>
                  {can("lots") ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${l.name}`} hitSlop={8} onPress={() => setEditing(l)} style={s.small}>
                      <Icon name="edit" color={colors.selva} size={18} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {inLot.slice(0, 8).map((a) => <Chip key={a.id} label={animalLabel(a)} />)}
                  {inLot.length > 8 ? <Chip label={`+${inLot.length - 8}`} /> : null}
                </View>
                {can("animals") ? <Button kind="soft" icon="swap" label="Pasar animales a este lote" onPress={() => { setDone(undefined); setPicked([]); setMoving(l); }} /> : null}
              </Card>
            );
          })}
          {data && !lots.length ? <Empty title="Sin lotes" text="Crea el primero para agrupar tus animales." /> : null}
          {animals.some((a) => !a.lotId) ? <Banner icon="note" tone="warn" title={`${plural(animals.filter((a) => !a.lotId).length, "animal está", "animales están")} sin lote`} /> : null}
          {can("lots") ? <Button icon="plus" label="Nuevo lote" onPress={() => setEditing({})} /> : null}
        </View>
      </ScrollView>

      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.id ? "Editar lote" : "Nuevo lote"}>
        {editing ? <LotForm lot={editing} onSave={saveEditing} /> : null}
      </Sheet>

      <Sheet open={!!moving} onClose={() => setMoving(undefined)} title={`¿Quiénes pasan a ${moving?.name ?? ""}?`}>
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
          {animals.filter((a) => a.lotId !== moving?.id).map((a) => {
            const on = picked.includes(a.id);
            return (
              <Pressable key={a.id} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={a.name ?? a.tagVisual}
                onPress={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])} style={[s.pick, on && s.pickOn]}>
                <EarTag code={a.tagVisual} size={34} tone={a.sex === "macho" ? colors.tierra : colors.selva} />
                <Txt w="bold" size={15} style={{ flex: 1 }}>{animalLabel(a)}</Txt>
                <Txt size={13} color={colors.textMuted}>{lots.find((l) => l.id === a.lotId)?.name.split(" · ")[0] ?? "Sin lote"}</Txt>
                {on ? <Icon name="check" color={colors.selva} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <Button label={picked.length ? `Pasar ${plural(picked.length, "animal", "animales")}` : "Elige animales"} disabled={!picked.length} onPress={confirmMove} />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function LotForm({ lot, onSave }: { lot: Partial<Lot>; onSave: (name: string, purpose: string) => void }) {
  const [name, setName] = useState(lot.name ?? "");
  const [purpose, setPurpose] = useState(lot.purpose ?? "");
  return (
    <View style={{ gap: 12 }}>
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Lote 2 · Levante" autoCapitalize="sentences" />
      <Field label="Potrero o uso (opcional)" value={purpose} onChangeText={setPurpose} placeholder="Ej: Potrero Alto, ordeño, ceba" />
      <Button label="Guardar" disabled={!name.trim()} onPress={() => onSave(name.trim(), purpose.trim())} />
    </View>
  );
}

const s = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  small: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  pick: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: radius.md, padding: 10, borderWidth: 2, borderColor: "transparent", ...shadow },
  pickOn: { borderColor: colors.lima },
});
