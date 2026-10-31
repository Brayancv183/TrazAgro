import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel, categoryOf, colors, monthsBetween, radius, shortDate, todayDay, type AnimalOrigin, type AnimalSex } from "@trazagro/shared";
import { createAnimal, DuplicateTagError, listAnimals, listLots } from "../../db/repo";
import { useFarm, useFarmId } from "../../lib/farm";
import { RequireWrite } from "../../ui/NoPermission";
import { useDbQuery } from "../../lib/useDb";
import { DateField, splitDay, toDay } from "../../ui/DateField";
import { Icon } from "../../ui/Icon";
import { Banner, Button, Card, Chip, Field, GreenHeader, Txt } from "../../ui/kit";

const BREEDS = ["Holstein", "Normando", "Brahman", "Gyr", "Cebú", "Cruce"];
const STEPS = ["Arete", "Datos", "Origen", "Listo"];

interface Form {
  tag: string; rfid: string; noTag: boolean; name: string; sex: AnimalSex; breed: string;
  birth: { d: string; m: string; y: string }; origin: AnimalOrigin; motherId?: string; sire: string;
  seller: string; price: string; bought: { d: string; m: string; y: string }; lotId?: string;
}

function NuevoAnimalScreen() {
  // motherId comes from "Registrar → Parto" on the mother's record.
  const { farmId: farmParam, motherId, tag } = useLocalSearchParams<{ farmId?: string; motherId?: string; tag?: string }>();
  const farmId = useFarmId(farmParam);
  // Prices go to the farm's books, which only owners and administrators may change.
  const money = useFarm().can("movements");
  const db = useSQLiteContext();
  const router = useRouter();
  const today = todayDay();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [savedId, setSavedId] = useState<string>();
  const blank = (): Form => ({
    tag: "", rfid: "", noTag: false, name: "", sex: "hembra", breed: "", birth: splitDay(today), origin: "nacido", motherId: undefined,
    sire: "", seller: "", price: "", bought: splitDay(today),
  });
  const [f, setF] = useState<Form>(() => ({
    ...blank(), motherId, tag: tag && /^\d+$/.test(tag) ? tag : "", rfid: tag && !/^\d+$/.test(tag) ? tag : "",
  }));
  const set = (patch: Partial<Form>) => { setError(undefined); setF((o) => ({ ...o, ...patch })); };

  const { data } = useDbQuery(async (d) => ({ animals: await listAnimals(d, farmId), lots: await listLots(d, farmId) }), [farmId]);
  const mothers = (data?.animals ?? []).filter((a) => a.sex === "hembra" && monthsBetween(a.birthDate, today) >= 15);
  const lots = data?.lots ?? [];

  const birthDay = toDay(f.birth);
  const boughtDay = toDay(f.bought);
  const category = birthDay ? categoryOf(f.sex, birthDay, 0, today) : undefined;

  function validate(): string | undefined {
    if (step === 0 && !f.noTag && !/^\d{3,10}$/.test(f.tag.trim())) return "Escribe el número del arete (solo números) o marca que todavía no tiene.";
    if (step === 1 && (!birthDay || birthDay > today)) return "Revisa la fecha de nacimiento.";
    if (step === 2 && f.origin === "nacido" && f.motherId && data && !mothers.some((m) => m.id === f.motherId)) return "La madre debe ser una hembra de la finca de 15 meses o más.";
    if (step === 2 && f.origin === "comprado") {
      if (!f.seller.trim()) return "Escribe a quién se lo compraste.";
      if (!boughtDay || boughtDay > today) return "Revisa la fecha de llegada.";
    }
    return undefined;
  }

  async function next() {
    const problem = validate();
    if (problem) return setError(problem);
    if (step < 3) return setStep(step + 1);
    try {
      const animal = await createAnimal(db, {
        farmId, lotId: f.lotId ?? (f.origin === "nacido" ? data?.animals.find((a) => a.id === f.motherId)?.lotId : undefined),
        tagVisual: f.noTag ? undefined : f.tag.trim(), rfid: f.noTag ? undefined : f.rfid.trim() || undefined,
        name: f.name.trim() || undefined, sex: f.sex, breed: f.breed || undefined, birthDate: birthDay!, origin: f.origin,
        motherId: f.origin === "nacido" ? f.motherId : undefined, sireNote: f.sire.trim() || undefined,
        purchase: f.origin === "comprado" ? { seller: f.seller.trim(), price: Number(f.price.replace(/\D/g, "")) || 0, date: boughtDay! } : undefined,
      });
      setSavedId(animal.id);
    } catch (e) {
      setError(e instanceof DuplicateTagError ? `Ese arete ya es de ${animalLabel(e.existing)}. Revisa el número.` : "No se pudo guardar. Intenta de nuevo.");
    }
  }

  if (savedId) {
    const label = animalLabel({ name: f.name.trim(), tagVisual: f.tag || undefined });
    return (
      <View style={{ flex: 1 }}>
        <GreenHeader title="¡Listo!" kicker="NUEVO ANIMAL" />
        <View style={{ padding: 16, gap: 14 }}>
          <View style={s.successIcon}><Icon name="check" size={44} color={colors.selva} width={3} /></View>
          <Txt w="extrabold" size={24} style={{ textAlign: "center" }}>{label} ya está en tu finca</Txt>
          <Txt size={15} color={colors.textMuted} style={{ textAlign: "center" }}>Desde hoy todo lo que le registres queda en su trazabilidad.</Txt>
          <Banner icon="note" tone="warn" title={f.origin === "nacido" ? "Recuerda reportar el nacimiento al ICA" : "Recuerda reportar el ingreso al ICA"} text="Queda en tu lista para SINIGAN." />
          <Button label={`Ver ficha de ${label}`} onPress={() => router.replace({ pathname: "/animal/[id]", params: { id: savedId } })} />
          <Button kind="soft" label="Registrar otro" onPress={() => { setSavedId(undefined); setStep(0); setF(blank()); }} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker={`NUEVO ANIMAL · PASO ${step + 1} DE 4`} title={["¿Qué arete tiene?", "¿Cómo es?", "¿De dónde viene?", "¿Todo bien?"][step]!}>
          <View style={s.steps}>
            {STEPS.map((l, i) => (
              <View key={l} style={{ alignItems: "center", gap: 4, flex: 1 }}>
                <View style={[s.dot, i < step && s.dotDone, i === step && s.dotNow]}>
                  <Txt w="extrabold" size={13} color={i === step ? colors.selva : i < step ? colors.selva : colors.onDarkMuted}>{i < step ? "✓" : String(i + 1)}</Txt>
                </View>
                <Txt w="semibold" size={12} color={i === step ? colors.onDark : colors.onDarkMuted}>{l}</Txt>
              </View>
            ))}
          </View>
        </GreenHeader>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          {step === 0 ? (
            <>
              <Field label="Número visible del arete" value={f.tag} onChangeText={(t) => set({ tag: t.replace(/\D/g, ""), noTag: false })}
                keyboardType="number-pad" placeholder="Ej: 00127" editable={!f.noTag} />
              <Field label="Código RFID del chip (opcional)" value={f.rfid} onChangeText={(t) => set({ rfid: t })} keyboardType="number-pad"
                placeholder="Ej: 985 2024 00127" editable={!f.noTag} />
              <Banner icon="tag" tone="ok" title="¿Tienes lector RFID Bluetooth?" text="Conéctalo, toca el campo del chip y escanea: el código se escribe solo." />
              <Pressable accessibilityRole="checkbox" aria-checked={f.noTag} onPress={() => set({ noTag: !f.noTag, tag: "", rfid: "" })} style={s.check}>
                <View style={[s.box, f.noTag && { backgroundColor: colors.selva, borderColor: colors.selva }]}>{f.noTag ? <Icon name="check" color={colors.onDark} size={16} width={3} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Txt w="bold" size={15}>Todavía no tiene arete</Txt>
                  <Txt size={13} color={colors.textMuted}>Te recordamos ponérselo, como lo exige el ICA.</Txt>
                </View>
              </Pressable>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field label="Nombre (opcional)" value={f.name} onChangeText={(t) => set({ name: t })} placeholder="Ej: Luna" autoCapitalize="words" />
              <Txt w="semibold" size={14} color={colors.textMuted}>Sexo</Txt>
              <View style={s.row}>{(["hembra", "macho"] as const).map((x) => <Chip key={x} label={x === "hembra" ? "Hembra" : "Macho"} active={f.sex === x} onPress={() => set({ sex: x })} />)}</View>
              <Txt w="semibold" size={14} color={colors.textMuted}>Raza</Txt>
              <View style={s.row}>{BREEDS.map((b) => <Chip key={b} label={b} active={f.breed === b} onPress={() => set({ breed: f.breed === b ? "" : b })} />)}</View>
              <DateField label="Nació el" value={f.birth} onChange={(birth) => set({ birth })} />
              {category ? <Banner icon="cow" tone="ok" title={`Queda como ${category}`} text="Según la edad y el sexo. Cambia sola cuando crezca." /> : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={s.row}>
                <Chip label="Nació aquí" active={f.origin === "nacido"} onPress={() => set({ origin: "nacido" })} />
                <Chip label="La compré" active={f.origin === "comprado"} onPress={() => set({ origin: "comprado" })} />
              </View>
              {f.origin === "nacido" ? (
                <>
                  <Txt w="semibold" size={14} color={colors.textMuted}>Madre</Txt>
                  <View style={s.row}>
                    {mothers.map((m) => <Chip key={m.id} label={`${m.name ?? ""} #${m.tagVisual ?? "—"}`} active={f.motherId === m.id} onPress={() => set({ motherId: f.motherId === m.id ? undefined : m.id })} />)}
                    <Chip label="No sé" active={!f.motherId} onPress={() => set({ motherId: undefined })} />
                  </View>
                  <Field label="Padre o pajilla (opcional)" value={f.sire} onChangeText={(t) => set({ sire: t })} placeholder="Ej: Capitán #00124 o código de pajilla" />
                  {f.motherId ? <Banner icon="heart" tone="ok" title="Se anota solo el parto de la madre" text="Y la cría aparece en su ficha." /> : null}
                </>
              ) : (
                <>
                  <Field label="¿A quién se lo compraste?" value={f.seller} onChangeText={(t) => set({ seller: t })} placeholder="Ej: Finca Los Naranjos" />
                  {money ? <Field label="Precio" value={f.price} onChangeText={(t) => set({ price: t.replace(/\D/g, "") })} keyboardType="number-pad" placeholder="Ej: 2800000" /> : null}
                  <DateField label="Llegó el" value={f.bought} onChange={(bought) => set({ bought })} />
                  {money ? <Banner icon="note" tone="ok" title="El precio queda en Costos" text="Como gasto en Compra de animales." /> : null}
                </>
              )}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Txt w="semibold" size={14} color={colors.textMuted}>¿En qué lote va?</Txt>
              <View style={s.row}>{lots.map((l) => <Chip key={l.id} label={l.name} active={f.lotId === l.id} onPress={() => set({ lotId: f.lotId === l.id ? undefined : l.id })} />)}</View>
              {!f.lotId && f.origin === "nacido" && f.motherId ? <Txt size={13} color={colors.textMuted}>Si no eliges, va con su madre.</Txt> : null}
              <Card style={{ paddingVertical: 4 }}>
                {[
                  ["Arete", f.noTag ? "Sin arete (pendiente)" : `#${f.tag}${f.rfid ? ` · RFID ${f.rfid}` : ""}`],
                  ["Nombre", f.name || "—"],
                  ["Sexo y raza", `${f.sex === "hembra" ? "Hembra" : "Macho"}${f.breed ? ` · ${f.breed}` : ""}`],
                  ["Nació", `${birthDay ? shortDate(birthDay) : "—"} · ${category}`],
                  ["Origen", f.origin === "nacido" ? `Nació aquí${f.motherId ? ` · ${f.sex === "macho" ? "hijo" : "hija"} de ${animalLabel(mothers.find((m) => m.id === f.motherId) ?? {})}` : ""}` : `Comprado a ${f.seller}`],
                ].map(([k, v], i, arr) => (
                  <View key={k} style={[s.sum, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                    <Txt size={15} color={colors.textMuted}>{k}</Txt>
                    <Txt w="bold" size={15} style={{ flexShrink: 1, textAlign: "right" }}>{v}</Txt>
                  </View>
                ))}
              </Card>
              <Txt size={13} color={colors.textMuted} style={{ textAlign: "center" }}>Se guarda en el teléfono y se sube cuando haya señal.</Txt>
            </>
          ) : null}

          {error ? <Banner icon="note" tone="danger" title={error} /> : null}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Pressable accessibilityRole="button" onPress={() => (step ? setStep(step - 1) : router.back())} style={s.backBtn}>
          <Txt w="bold" size={15} color={colors.onDark}>{step ? "Atrás" : "Cancelar"}</Txt>
        </Pressable>
        <Button kind="lime" label={step === 3 ? "Guardar animal" : "Siguiente"} onPress={next} style={{ flex: 1, minHeight: 52 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  steps: { flexDirection: "row", marginTop: 10, marginBottom: 4 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(174,213,129,0.6)" },
  dotDone: { backgroundColor: colors.onDark, borderColor: colors.onDark },
  dotNow: { backgroundColor: colors.lima, borderColor: colors.lima },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  check: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.card, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: colors.line },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
  sum: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  footer: { position: "absolute", left: 14, right: 14, bottom: 18, minHeight: 68, borderRadius: 34, backgroundColor: colors.selva, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 },
  backBtn: { minHeight: 52, paddingHorizontal: 18, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center" },
  successIcon: { alignSelf: "center", width: 88, height: 88, borderRadius: 44, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center", marginTop: 12 },
});

export default function Screen() {
  return <RequireWrite table="animals"><NuevoAnimalScreen /></RequireWrite>;
}
