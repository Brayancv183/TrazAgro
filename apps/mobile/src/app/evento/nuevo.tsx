import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  colors, doseAmount, fonts, monthsBetween, num, radius, shadow, shortDate, todayDay, weightSummary, withdrawalPreview,
  type Animal, type Product, type ProductKind,
} from "@trazagro/shared";
import { listAnimals, listFarmEvents, listLots, listProducts, recordEvents, type RecordableType } from "../../db/repo";
import { useFarmId } from "../../lib/farm";
import { useDbQuery } from "../../lib/useDb";
import { DateField, splitDay, toDay } from "../../ui/DateField";
import { Icon, type IconName } from "../../ui/Icon";
import { Banner, Button, Card, Chip, EarTag, Field, GreenHeader, Txt } from "../../ui/kit";

type Kind = RecordableType | "parto";

const TYPES: { id: Kind; label: string; icon: IconName; bg: string; fg: string }[] = [
  { id: "vacuna", label: "Vacuna", icon: "syringe", bg: colors.limaSoft, fg: colors.selva },
  { id: "tratamiento", label: "Tratamiento", icon: "drop", bg: colors.rosaSoft, fg: colors.rosa },
  { id: "desparasitacion", label: "Desparasitar", icon: "bug", bg: colors.tierraSoft, fg: colors.tierra },
  { id: "pesaje", label: "Pesaje", icon: "scale", bg: colors.infoSoft, fg: colors.info },
  { id: "parto", label: "Parto", icon: "heart", bg: colors.rosaSoft, fg: colors.rosa },
  { id: "nota", label: "Nota", icon: "note", bg: colors.warnSoft, fg: colors.warn },
];

const PRODUCT_KIND: Partial<Record<Kind, ProductKind>> = { vacuna: "vacuna", tratamiento: "medicina", desparasitacion: "medicina" };
const STEPS = ["Qué", "Quién", "Detalles", "Listo"];

export default function RegistrarEventoScreen() {
  // animalIds (comma separated) comes from "Corral rápido"; kind preselects the type from the Crear sheet.
  const { farmId: farmParam, animalId, animalIds, kind: kindParam } = useLocalSearchParams<{ farmId?: string; animalId?: string; animalIds?: string; kind?: Kind }>();
  const farmId = useFarmId(farmParam);
  const db = useSQLiteContext();
  const router = useRouter();
  const today = todayDay();

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind>(kindParam ?? "vacuna");
  const [selected, setSelected] = useState<string[]>(animalIds ? animalIds.split(",") : animalId ? [animalId] : []);
  const [productId, setProductId] = useState<string>();
  const [dose, setDose] = useState("");
  const [date, setDate] = useState(splitDay(today));
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  // Stock left is captured at save time: after reload() the product list already reflects the use.
  const [saved, setSaved] = useState<{ n: number; left?: number }>();

  const { data, reload } = useDbQuery(async (d) => {
    const [animals, lots, products, events] = await Promise.all([listAnimals(d, farmId), listLots(d, farmId), listProducts(d, farmId), listFarmEvents(d, farmId)]);
    return { animals, lots, products, events };
  }, [farmId]);

  const animals = data?.animals ?? [];
  const pool = kind === "parto" ? animals.filter((a) => a.sex === "hembra" && monthsBetween(a.birthDate, today) >= 15) : animals;
  const chosen = animals.filter((a) => selected.includes(a.id));
  const products = (data?.products ?? []).filter((p) => p.kind === PRODUCT_KIND[kind]);
  const product = products.find((p) => p.id === productId);
  const day = toDay(date);
  const perAnimal = doseAmount(dose);
  const used = perAnimal !== undefined ? perAnimal * chosen.length : undefined;
  const lastWeights = useMemo(() => {
    const out = new Map<string, number>();
    for (const a of chosen) {
      const w = weightSummary((data?.events ?? []).filter((e) => e.animalId === a.id)).lastKg;
      if (w) out.set(a.id, w);
    }
    return out;
  }, [chosen, data]);

  const reset = (patch: () => void) => { setError(undefined); patch(); };

  function validate(): string | undefined {
    if (step === 1) {
      if (!chosen.length) return kind === "parto" ? "Elige la madre." : "Elige al menos un animal.";
      if (kind === "parto" && chosen.length > 1) return "Para un parto elige solo la madre.";
    }
    if (step === 2) {
      if (!day || day > today) return "Revisa la fecha.";
      if (PRODUCT_KIND[kind] && !product) return "Elige el producto del inventario.";
      if (PRODUCT_KIND[kind] && perAnimal === undefined) return "Escribe la dosis, por ejemplo 2 ml.";
      if (kind === "pesaje" && !chosen.some((a) => kg(weights[a.id]) > 0)) return "Escribe al menos un peso.";
      if (kind === "nota" && !notes.trim()) return "Escribe la nota.";
    }
    return undefined;
  }

  async function next() {
    const problem = validate();
    if (problem) return setError(problem);
    if (step === 1 && kind === "parto") {
      // A birth creates the calf: continue in "Nuevo animal" with the mother already chosen.
      return router.replace({ pathname: "/animal/nuevo", params: { farmId, motherId: chosen[0]!.id } });
    }
    if (step < 3) return setStep(step + 1);
    try {
      const n = await recordEvents(db, {
        farmId, type: kind as RecordableType, date: day!, animalIds: chosen.map((a) => a.id),
        productId: product?.id, dose: dose.trim() || undefined, quantityEach: perAnimal,
        weights: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, kg(v)])),
        weightMethod: "manual", notes: notes.trim() || undefined,
      });
      setSaved({ n, left: product && used !== undefined ? product.stock - used : undefined });
      reload();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    }
  }

  const typeUi = TYPES.find((t) => t.id === kind)!;

  if (saved) {
    const one = chosen.length === 1 ? chosen[0] : undefined;
    return (
      <View style={{ flex: 1 }}>
        <GreenHeader kicker="REGISTRO" title="¡Guardado!" />
        <View style={{ padding: 16, gap: 14 }}>
          <View style={s.successIcon}><Icon name="check" size={44} color={colors.selva} width={3} /></View>
          <Txt w="extrabold" size={22} style={{ textAlign: "center" }}>
            {saved.n === 1 ? `${typeUi.label} de ${one?.name ?? "1 animal"}` : `${typeUi.label} de ${saved.n} animales`}
          </Txt>
          <Txt size={15} color={colors.textMuted} style={{ textAlign: "center" }}>Quedó en su trazabilidad. No tienes que anotarlo otra vez.</Txt>
          {product && used !== undefined && saved.left !== undefined ? (
            <Banner icon="note" tone="ok" title={`Inventario: −${num(used)} ${product.unit}`} text={`Quedan ${num(saved.left)} ${product.unit} de ${product.name}.`} />
          ) : null}
          {one ? <Button label="Ver la ficha" onPress={() => router.replace({ pathname: "/animal/[id]", params: { id: one.id } })} /> : null}
          <Button kind="soft" label="Registrar otro" onPress={() => { setSaved(undefined); setStep(0); setSelected(animalId ? [animalId] : []); setDose(""); setWeights({}); setNotes(""); }} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker={`REGISTRAR · PASO ${step + 1} DE 4`} title={["¿Qué pasó?", kind === "parto" ? "¿Quién parió?" : "¿A quién?", kind === "pesaje" ? "¿Cuánto pesa?" : "Detalles", "¿Todo bien?"][step]!}>
          <View style={s.steps}>
            {STEPS.map((l, i) => (
              <View key={l} style={{ alignItems: "center", gap: 4, flex: 1 }}>
                <View style={[s.dot, i < step && s.dotDone, i === step && s.dotNow]}>
                  <Txt w="extrabold" size={13} color={i <= step ? colors.selva : colors.onDarkMuted}>{i < step ? "✓" : String(i + 1)}</Txt>
                </View>
                <Txt w="semibold" size={12} color={i === step ? colors.onDark : colors.onDarkMuted}>{l}</Txt>
              </View>
            ))}
          </View>
        </GreenHeader>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          {step === 0 ? (
            <View style={s.grid}>
              {TYPES.map((t) => {
                const on = kind === t.id;
                return (
                  <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
                    onPress={() => reset(() => { setKind(t.id); setProductId(undefined); setDose(""); })}
                    style={[s.tile, on && s.tileOn]}>
                    <View style={[s.tileIcon, { backgroundColor: t.bg }]}><Icon name={t.icon} color={t.fg} size={24} /></View>
                    <Txt w="bold" size={16}>{t.label}</Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === 1 ? (
            <>
              {kind !== "parto" ? (
                <View style={s.row}>
                  {(data?.lots ?? []).map((l) => {
                    const ids = animals.filter((a) => a.lotId === l.id).map((a) => a.id);
                    if (!ids.length) return null;
                    const all = ids.every((id) => selected.includes(id)) && selected.length === ids.length;
                    return <Chip key={l.id} label={`Todo el ${l.name.split(" · ")[0]} (${ids.length})`} active={all} onPress={() => reset(() => setSelected(all ? [] : ids))} />;
                  })}
                </View>
              ) : null}
              <Txt w="semibold" size={14} color={colors.textMuted}>
                {kind === "parto" ? "Elige la madre" : `O elige de la lista · ${chosen.length} ${chosen.length === 1 ? "elegido" : "elegidos"}`}
              </Txt>
              {pool.map((a) => (
                <AnimalPick key={a.id} a={a} on={selected.includes(a.id)}
                  onPress={() => reset(() => setSelected((cur) => kind === "parto" ? [a.id] : cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id]))} />
              ))}
              {kind === "parto" ? <Banner icon="heart" tone="ok" title="Luego registras la cría" text="Le pones su arete y queda como hija de la madre, con el parto anotado." /> : null}
            </>
          ) : null}

          {step === 2 && PRODUCT_KIND[kind] ? (
            <>
              <Txt w="semibold" size={14} color={colors.textMuted}>Producto (del inventario)</Txt>
              <View style={s.row}>
                {products.map((p) => <Chip key={p.id} label={`${p.name} · ${num(p.stock)} ${p.unit}`} active={productId === p.id} onPress={() => reset(() => setProductId(p.id))} />)}
              </View>
              {!products.length ? <Banner icon="note" tone="warn" title="No hay productos de este tipo en el inventario" /> : null}
              <Field label={chosen.length > 1 ? "Dosis por animal" : "Dosis"} value={dose} onChangeText={(t) => reset(() => setDose(t))}
                placeholder={product ? `Ej: 2 ${product.unit}` : "Ej: 2 ml"} />
              <DateField label="Fecha" value={date} onChange={(v) => reset(() => setDate(v))} />
              {product && day ? <ProductNotes product={product} day={day} today={today} used={used} /> : null}
            </>
          ) : null}

          {step === 2 && kind === "pesaje" ? (
            <>
              <Banner icon="scale" tone="ok" title="Báscula Bluetooth: muy pronto" text="Por ahora escribe el peso de cada animal. Los que dejes vacíos no se guardan." />
              {chosen.map((a) => (
                <View key={a.id} style={s.weighRow}>
                  <EarTag code={a.tagVisual} size={38} tone={a.sex === "macho" ? colors.tierra : colors.selva} />
                  <View style={{ flex: 1 }}>
                    <Txt w="bold" size={16}>{a.name ?? `#${a.tagVisual}`}</Txt>
                    <Txt size={13} color={colors.textMuted}>{lastWeights.has(a.id) ? `Último: ${num(lastWeights.get(a.id)!)} kg` : "Sin pesajes"}</Txt>
                  </View>
                  <TextInput value={weights[a.id] ?? ""} onChangeText={(t) => reset(() => setWeights((w) => ({ ...w, [a.id]: t.replace(/[^\d.,]/g, "") })))}
                    keyboardType="decimal-pad" placeholder="kg" placeholderTextColor="#9AA39D" accessibilityLabel={`Peso de ${a.name ?? a.tagVisual} en kilos`}
                    style={[s.kg, { fontFamily: fonts.extrabold }]} />
                </View>
              ))}
              <DateField label="Fecha" value={date} onChange={(v) => reset(() => setDate(v))} />
            </>
          ) : null}

          {step === 2 && kind === "nota" ? (
            <>
              <Field label="Nota" value={notes} onChangeText={(t) => reset(() => setNotes(t))} placeholder="Ej: cojea de la pata trasera" multiline style={{ minHeight: 100, paddingTop: 14 }} />
              <DateField label="Fecha" value={date} onChange={(v) => reset(() => setDate(v))} />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Card style={{ paddingVertical: 4 }}>
                {summary().map(([k, v], i, arr) => (
                  <View key={k} style={[s.sum, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                    <Txt size={15} color={colors.textMuted}>{k}</Txt>
                    <Txt w="bold" size={15} style={{ flexShrink: 1, textAlign: "right" }}>{v}</Txt>
                  </View>
                ))}
              </Card>
              {product && day ? <ProductNotes product={product} day={day} today={today} used={used} /> : null}
              <Txt size={13} color={colors.textMuted} style={{ textAlign: "center" }}>Se guarda en el teléfono y se sube cuando haya señal.</Txt>
            </>
          ) : null}

          {error ? <Banner icon="note" tone="danger" title={error} /> : null}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Pressable accessibilityRole="button" onPress={() => (step ? reset(() => setStep(step - 1)) : router.back())} style={s.backBtn}>
          <Txt w="bold" size={15} color={colors.onDark}>{step ? "Atrás" : "Cancelar"}</Txt>
        </Pressable>
        <Button kind="lime" label={step === 3 ? "Guardar registro" : step === 1 && kind === "parto" ? "Registrar la cría" : "Siguiente"} onPress={next} style={{ flex: 1, minHeight: 52 }} />
      </View>
    </KeyboardAvoidingView>
  );

  function summary(): [string, string][] {
    const who = chosen.length === 1 ? `${chosen[0]!.name ?? ""} #${chosen[0]!.tagVisual ?? ""}` : `${chosen.length} animales`;
    const rows: [string, string][] = [["Qué", typeUi.label], ["A quién", who]];
    if (product) rows.push(["Producto", `${product.name} · ${dose}${chosen.length > 1 ? " c/u" : ""}`]);
    if (kind === "pesaje") {
      const n = chosen.filter((a) => kg(weights[a.id]) > 0).length;
      rows.push(["Pesajes", `${n} de ${chosen.length} con peso`]);
    }
    if (kind === "nota") rows.push(["Nota", notes.trim()]);
    rows.push(["Fecha", day ? shortDate(day, today) : "—"]);
    return rows;
  }
}

function ProductNotes({ product, day, today, used }: { product: Product; day: string; today: string; used?: number }) {
  const w = withdrawalPreview(day, product);
  const left = used !== undefined ? product.stock - used : undefined;
  return (
    <>
      {w.milkUntil || w.meatUntil ? (
        <Banner icon="drop" tone="warn" title="Días de retiro calculados solos"
          text={[w.milkUntil && `Leche: hasta el ${shortDate(w.milkUntil, today)}`, w.meatUntil && `Carne: hasta el ${shortDate(w.meatUntil, today)}`].filter(Boolean).join(" · ")} />
      ) : <Banner icon="check" tone="ok" title="Sin días de retiro" text="Este producto no restringe la leche ni la carne." />}
      {used !== undefined ? (
        left !== undefined && left < 0
          ? <Banner icon="note" tone="danger" title={`No alcanza: hay ${num(product.stock)} ${product.unit}`} text={`Se necesitan ${num(used)} ${product.unit}. Puedes guardar igual y comprar más.`} />
          : <Banner icon="note" tone="ok" title={`Se descuentan ${num(used)} ${product.unit} del inventario`} text={`Quedan ${num(left!)} ${product.unit}.`} />
      ) : null}
    </>
  );
}

function AnimalPick({ a, on, onPress }: { a: Animal; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${a.name ?? ""} ${a.tagVisual ?? ""}`} onPress={onPress}
      style={[s.pick, { borderColor: on ? colors.selva : colors.line }]}>
      <EarTag code={a.tagVisual} size={36} tone={a.sex === "macho" ? colors.tierra : colors.selva} />
      <View style={{ flex: 1 }}>
        <Txt w="bold" size={16}>{a.name ?? `#${a.tagVisual}`}</Txt>
        <Txt size={13} color={colors.textMuted}>{[a.tagVisual && `#${a.tagVisual}`, a.breed].filter(Boolean).join(" · ")}</Txt>
      </View>
      <View style={[s.radio, on && { borderColor: colors.selva, backgroundColor: colors.selva }]}>{on ? <Icon name="check" color={colors.onDark} size={14} width={3} /> : null}</View>
    </Pressable>
  );
}

/** Kilos typed with comma or dot ("300,5"); 0 when empty or not a number. */
const kg = (v?: string) => Number((v ?? "").replace(",", ".")) || 0;

const s = StyleSheet.create({
  steps: { flexDirection: "row", marginTop: 10, marginBottom: 4 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(174,213,129,0.6)" },
  dotDone: { backgroundColor: colors.onDark, borderColor: colors.onDark },
  dotNow: { backgroundColor: colors.lima, borderColor: colors.lima },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47%", flexGrow: 1, height: 112, borderRadius: radius.lg, padding: 14, justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 2, borderColor: "transparent", ...shadow },
  tileOn: { borderColor: colors.selva },
  tileIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 2 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
  weighRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  kg: { width: 96, minHeight: 52, borderRadius: radius.md, borderWidth: 2, borderColor: colors.selva, textAlign: "center", fontSize: 20, color: colors.text, backgroundColor: colors.card },
  sum: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  footer: { position: "absolute", left: 14, right: 14, bottom: 18, minHeight: 68, borderRadius: 34, backgroundColor: colors.selva, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 },
  backBtn: { minHeight: 52, paddingHorizontal: 18, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center" },
  successIcon: { alignSelf: "center", width: 88, height: 88, borderRadius: 44, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center", marginTop: 12 },
});
