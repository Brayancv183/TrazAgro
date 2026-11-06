import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel, colors, plural, shadow, todayDay, type Animal, type Lot } from "@trazagro/shared";
import { daysInLot } from "../db/finca";
import { listAnimals, listFarmEvents, listLots, moveAnimals, saveLot } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { Banner, Button, EarTag, Empty, GreenHeader, Sheet, Txt, tagTone } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { FField, HeaderAction, StatBox, StateChip } from "../ui/finca/parts";

const SWATCH = [colors.link, "#1976D2", colors.tierra, colors.rosa, colors.warn, "#00796B"];

/** "Lote 2 · Levante" → "L2"; "Potrero Alto" → "PA". */
function lotCode(name: string) {
  const n = /lote\s*(\d+)/i.exec(name);
  if (n) return `L${n[1]}`;
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/** Lotes.dc: one card per lot with its swatch, state chip, three stats and two actions. */
export default function LotesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const farmId = useFarmId();
  const { can } = useFarm();
  const today = todayDay();
  const [editing, setEditing] = useState<Partial<Lot>>();
  const [moving, setMoving] = useState<Lot>();
  const [viewing, setViewing] = useState<Lot>();
  const [picked, setPicked] = useState<string[]>([]);
  const [done, setDone] = useState<string>();
  const { data, reload } = useDbQuery(async (d) => ({ lots: await listLots(d, farmId), animals: await listAnimals(d, farmId), events: await listFarmEvents(d, farmId) }), [farmId]);
  const lots = data?.lots ?? [];
  const animals = data?.animals ?? [];
  const loose = animals.filter((a) => !a.lotId);
  const lotName = (a: Animal) => lots.find((l) => l.id === a.lotId)?.name.split(" · ")[0] ?? "Sin lote";

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
        <GreenHeader back waveHeight={40} title="Lotes y potreros"
          kicker={data ? `${plural(lots.length, "lote", "lotes")} · ${plural(animals.length, "animal", "animales")}`.toUpperCase() : "CARGANDO…"}
          right={<HeaderAction icon="map" label="Ver en mapa" onPress={() => router.push("/mapa")} />} />

        <View style={s.main}>
          {done ? <Rise><Banner icon="check" tone="ok" title={done} /></Rise> : null}
          {loose.length ? <Rise><Banner icon="info" tone="warn" title={`${plural(loose.length, "animal está", "animales están")} sin lote`} /></Rise> : null}

          {lots.map((l, i) => {
            const inLot = animals.filter((a) => a.lotId === l.id);
            const days = daysInLot(l.name, inLot, data?.events ?? [], today);
            const females = inLot.filter((a) => a.sex === "hembra").length;
            const rest = !inLot.length;
            return (
              <Rise key={l.id} index={i + 1}>
                <View style={s.card}>
                  <View style={s.top}>
                    <View style={[s.swatch, { backgroundColor: SWATCH[i % SWATCH.length] }]}><Txt w="extrabold" size={14} color={colors.onDark}>{lotCode(l.name)}</Txt></View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt w="extrabold" size={17} numberOfLines={1}>{l.name}</Txt>
                      <Txt size={13} color={colors.textMuted} numberOfLines={1}>{l.purpose || "Sin potrero ni uso anotado"}</Txt>
                    </View>
                    <StateChip label={rest ? "Descanso" : "Con ganado"} bg={rest ? colors.tierraSoft : colors.greenSoft} fg={rest ? colors.tierraDeep : colors.selva} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <StatBox value={inLot.length} label={inLot.length === 1 ? "animal" : "animales"} />
                    <StatBox value={females} label={females === 1 ? "hembra" : "hembras"} />
                    <StatBox value={days ?? "—"} label="días en el lote" />
                  </View>
                  <View style={s.actions}>
                    <View style={{ flex: 1 }}>
                      <Tap accessibilityRole="button" accessibilityLabel={`Ver animales de ${l.name}`} onPress={() => setViewing(l)} style={[s.action, { backgroundColor: colors.sand }]}>
                        <Txt w="extrabold" size={13}>Ver animales</Txt>
                      </Tap>
                    </View>
                    {can("animals") ? (
                      <View style={{ flex: 1 }}>
                        <Tap accessibilityRole="button" accessibilityLabel={`Mover animales a ${l.name}`} onPress={() => { setDone(undefined); setPicked([]); setMoving(l); }} style={[s.action, { backgroundColor: colors.greenSoft }]}>
                          <Txt w="extrabold" size={13} color={colors.selva}>Mover animales</Txt>
                        </Tap>
                      </View>
                    ) : null}
                    {can("lots") ? (
                      <Tap accessibilityRole="button" accessibilityLabel={`Editar ${l.name}`} onPress={() => setEditing(l)} style={s.edit}>
                        <Icon name="edit" color={colors.text} size={18} />
                      </Tap>
                    ) : null}
                  </View>
                </View>
              </Rise>
            );
          })}
          {data && !lots.length ? <Empty title="Sin lotes" text="Crea el primero para agrupar tus animales." /> : null}
          {can("lots") ? (
            <Rise index={lots.length + 1}>
              <Tap accessibilityRole="button" accessibilityLabel="Nuevo lote" onPress={() => setEditing({})} style={s.add}>
                <Icon name="plus" color={colors.tierraDeep} size={20} width={2.4} />
                <Txt w="extrabold" size={15} color={colors.tierraDeep}>Nuevo lote</Txt>
              </Tap>
            </Rise>
          ) : null}
        </View>
      </ScrollView>

      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.id ? "Editar lote" : "Nuevo lote"}>
        {editing ? <LotForm lot={editing} onSave={saveEditing} /> : null}
      </Sheet>

      <Sheet open={!!viewing} onClose={() => setViewing(undefined)} title={viewing?.name ?? ""}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
          {animals.filter((a) => a.lotId === viewing?.id).map((a) => (
            <Tap key={a.id} accessibilityRole="link" accessibilityLabel={animalLabel(a)} style={s.row}
              onPress={() => { setViewing(undefined); router.push({ pathname: "/animal/[id]", params: { id: a.id } }); }}>
              <EarTag code={a.tagVisual} size={34} tone={tagTone(a.sex)} />
              <Txt w="bold" size={16} style={{ flex: 1 }}>{animalLabel(a)}</Txt>
              <Icon name="chevron" color={colors.textMuted} size={18} />
            </Tap>
          ))}
          {viewing && !animals.some((a) => a.lotId === viewing.id) ? <Empty title="Lote vacío" text="Este lote está en descanso." /> : null}
        </ScrollView>
      </Sheet>

      <Sheet open={!!moving} onClose={() => setMoving(undefined)} title={`¿Quiénes pasan a ${moving?.name ?? ""}?`}>
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
          {animals.filter((a) => a.lotId !== moving?.id).map((a) => {
            const on = picked.includes(a.id);
            return (
              <Tap key={a.id} accessibilityRole="checkbox" aria-checked={on} accessibilityState={{ checked: on }} accessibilityLabel={a.name ?? a.tagVisual}
                onPress={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])} style={[s.row, on && s.rowOn]}>
                <EarTag code={a.tagVisual} size={34} tone={tagTone(a.sex)} />
                <View style={{ flex: 1 }}>
                  <Txt w="bold" size={16}>{animalLabel(a)}</Txt>
                  <Txt size={13} color={colors.textMuted}>{lotName(a)}</Txt>
                </View>
                <View style={[s.radio, on && { borderColor: colors.selva }]}>{on ? <View style={s.dot} /> : null}</View>
              </Tap>
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
      <FField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Lote 2 · Levante" autoCapitalize="sentences" />
      <FField label="Potrero o uso (opcional)" value={purpose} onChangeText={setPurpose} placeholder="Ej: Potrero Alto, ordeño, ceba" />
      <Button label="Guardar" disabled={!name.trim()} onPress={() => onSave(name.trim(), purpose.trim())} />
    </View>
  );
}

const s = StyleSheet.create({
  main: { paddingTop: 16, paddingHorizontal: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16, gap: 12, ...shadow },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  swatch: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 8 },
  action: { height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  edit: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  add: { height: 56, borderRadius: 28, borderWidth: 2, borderStyle: "dashed", borderColor: "#C9C2B3", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  rowOn: { borderColor: colors.selva },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.selva },
});
