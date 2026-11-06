import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Circle, Path } from "react-native-svg";
import { animalLabel, categoryOf, colors, monthsBetween, shadow, shortDate, todayDay, type AnimalOrigin, type AnimalSex } from "@trazagro/shared";
import { countActive, shortLot } from "../../db/animales";
import { addPhoto } from "../../db/photos";
import { createAnimal, DuplicateTagError, listAnimals, listLots } from "../../db/repo";
import { useFarm, useFarmId } from "../../lib/farm";
import { RequireWrite } from "../../ui/NoPermission";
import { useDbQuery } from "../../lib/useDb";
import { DateField, splitDay, toDay } from "../../ui/DateField";
import { Icon } from "../../ui/Icon";
import { Txt } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { BarGhost, BarMain, BottomBar, CheckCard, ChoiceCard, DashedButton, Note, SelectField, WizardHeader, WizField } from "../../ui/animales/parts";
import { pickPhoto } from "../../ui/animales/photo";

const BREEDS = ["Holstein", "Normando", "Brahman", "Gyr", "Cebú", "Cruce"];
const STEPS = ["Arete", "Datos", "Origen", "Listo"];
const TITLES = ["¿Qué arete tiene?", "¿Cómo es?", "¿De dónde viene?", "¿Todo bien?"];

interface Form {
  tag: string; rfid: string; noTag: boolean; name: string; sex: AnimalSex; breed: string;
  birth: { d: string; m: string; y: string }; origin: AnimalOrigin; motherId?: string; sire: string;
  seller: string; price: string; bought: { d: string; m: string; y: string }; lotId?: string;
  photo?: string; guide?: string;
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
  const rfidRef = useRef<{ focus: () => void } | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<{ id: string; total: number }>();
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
  const mother = mothers.find((m) => m.id === f.motherId);
  const motherLot = lots.find((l) => l.id === mother?.lotId);

  const birthDay = toDay(f.birth);
  const boughtDay = toDay(f.bought);
  const category = birthDay ? categoryOf(f.sex, birthDay, 0, today) : undefined;
  const label = animalLabel({ name: f.name.trim(), tagVisual: f.noTag ? undefined : f.tag || undefined });

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
        farmId, lotId: f.lotId ?? (f.origin === "nacido" ? mother?.lotId : undefined),
        tagVisual: f.noTag ? undefined : f.tag.trim(), rfid: f.noTag ? undefined : f.rfid.trim() || undefined,
        name: f.name.trim() || undefined, sex: f.sex, breed: f.breed || undefined, birthDate: birthDay!, origin: f.origin,
        motherId: f.origin === "nacido" ? f.motherId : undefined, sireNote: f.sire.trim() || undefined,
        purchase: f.origin === "comprado" ? { seller: f.seller.trim(), price: Number(f.price.replace(/\D/g, "")) || 0, date: boughtDay! } : undefined,
      });
      if (f.photo) await addPhoto(db, { farmId, animalId: animal.id, uri: f.photo, note: f.origin === "nacido" ? "Al nacer" : "Al llegar" });
      if (f.guide && f.origin === "comprado") await addPhoto(db, { farmId, animalId: animal.id, uri: f.guide, note: "Guía de movilización" });
      setSaved({ id: animal.id, total: await countActive(db, farmId) });
    } catch (e) {
      setError(e instanceof DuplicateTagError ? `Ese arete ya es de ${animalLabel(e.existing)}. Revisa el número.` : "No se pudo guardar. Intenta de nuevo.");
    }
  }

  async function photo(key: "photo" | "guide") {
    const uri = await pickPhoto("camera");
    if (uri) set({ [key]: uri });
  }

  if (saved) {
    return (
      <View style={{ flex: 1 }}>
        <WizardHeader kicker="LISTO" closeLabel="Cerrar" onClose={() => router.back()} steps={STEPS} step={4} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          <Rise style={{ alignItems: "center", gap: 12, paddingTop: 6 }}>
            <Svg width={120} height={120} viewBox="0 0 160 160">
              <Circle cx={80} cy={80} r={62} fill={colors.limaSoft} />
              <Circle cx={80} cy={80} r={74} fill="none" stroke={colors.pasto} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" />
              <Circle cx={80} cy={6} r={6} fill={colors.hoja} /><Circle cx={6} cy={80} r={6} fill={colors.lima} /><Circle cx={132} cy={132} r={6} fill={colors.hoja} />
              <Path d="M54 82l18 18 36-38" fill="none" stroke={colors.selva} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Txt w="extrabold" size={26} style={{ textAlign: "center" }}>{`¡${label} ya está en tu finca!`}</Txt>
            <Txt size={15} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 22 }}>
              {`Ahora tienes ${saved.total} ${saved.total === 1 ? "animal" : "animales"}. Desde hoy todo lo que le registres queda en su trazabilidad.`}
            </Txt>
            <View style={{ alignSelf: "stretch" }}><Tap accessibilityRole="link" accessibilityLabel="Ver reporte ICA" onPress={() => router.push("/ica")} style={s.ica}>
              <Icon name="report" color={colors.warn} size={22} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="extrabold" size={15} color={colors.signalText}>{f.origin === "nacido" ? "Recuerda reportar el nacimiento al ICA" : "Recuerda reportar el ingreso al ICA"}</Txt>
                <Txt size={14} color={colors.signalText}>Quedó en tu lista para SINIGAN</Txt>
              </View>
              <Txt w="bold" size={14} color={colors.signalText}>Ver ›</Txt>
            </Tap></View>
            <Tap accessibilityRole="link" accessibilityLabel={`Ver ficha de ${label}`} onPress={() => router.replace({ pathname: "/animal/[id]", params: { id: saved.id } })}
              style={{ minHeight: 44, justifyContent: "center" }}>
              <Txt w="bold" size={15} color={colors.link}>{`Ver ficha de ${label}`}</Txt>
            </Tap>
          </Rise>
        </ScrollView>
        <BottomBar>
          <BarGhost label="Salir" onPress={() => router.back()} />
          <BarMain label="Registrar otro" onPress={() => { setSaved(undefined); setStep(0); setF(blank()); }} />
        </BottomBar>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <WizardHeader kicker={`NUEVO ANIMAL · PASO ${step + 1} DE 4`} closeLabel="Cancelar" onClose={() => router.back()} steps={STEPS} step={step} />

        <Rise key={step} style={{ paddingHorizontal: 16, gap: 12 }}>
          <Txt w="extrabold" size={28} style={{ letterSpacing: -0.56 }}>{TITLES[step]}</Txt>

          {step === 0 ? (
            <>
              <Tap accessibilityRole="button" accessibilityLabel="Leer el arete con el lector" onPress={() => { set({ noTag: false }); rfidRef.current?.focus(); }} style={s.reader}>
                <View style={s.readerIcon}><Icon name="scan" color={colors.selva} size={26} /></View>
                <View style={{ flex: 1 }}>
                  <Txt w="extrabold" size={18} color={colors.onDark}>Leer el arete con el lector</Txt>
                  <Txt size={14} color={colors.onDarkMuted}>Conecta el lector Bluetooth y acércalo al chip</Txt>
                </View>
              </Tap>
              {f.rfid.trim().length >= 8 ? (
                <Note icon="check">{`Chip leído: ${f.rfid.trim()}`}</Note>
              ) : null}
              <WizField label="O escribe el número visible del arete" value={f.tag} onChangeText={(t) => set({ tag: t.replace(/\D/g, ""), noTag: false })}
                keyboardType="number-pad" placeholder="Ej: 00127" editable={!f.noTag} />
              <WizField inputRef={rfidRef} label="Código RFID del chip (opcional)" value={f.rfid} onChangeText={(t) => set({ rfid: t })} keyboardType="number-pad"
                placeholder="Ej: 985 2024 00127" editable={!f.noTag} />
              <CheckCard title="Todavía no tiene arete" text="Te recordamos ponérselo, como lo exige el ICA." on={f.noTag} onPress={() => set({ noTag: !f.noTag, tag: "", rfid: "" })} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <WizField label="Nombre (opcional)" value={f.name} onChangeText={(t) => set({ name: t })} placeholder="Ej: Luna" autoCapitalize="words" />
              <View role="group" accessibilityLabel="Sexo" style={s.two}>
                {(["hembra", "macho"] as const).map((x) => (
                  <View key={x} style={{ flex: 1 }}><ChoiceCard label={x === "hembra" ? "Hembra" : "Macho"} on={f.sex === x} onPress={() => set({ sex: x })} /></View>
                ))}
              </View>
              <SelectField label="Raza" value={f.breed} placeholder="Sin definir" sheetTitle="¿De qué raza es?"
                options={[...BREEDS.map((b) => ({ id: b, label: b })), { id: "", label: "No sé / otra" }]} onChange={(breed) => set({ breed })} />
              <DateField label="Nació el" value={f.birth} onChange={(birth) => set({ birth })} />
              {category ? (
                <Note icon="cow" tone="tint">
                  <Txt w="semibold" size={14} style={{ lineHeight: 19 }}>Queda como <Txt w="extrabold" size={14}>{category}</Txt> según la edad y el sexo. Cambia sola cuando crezca.</Txt>
                </Note>
              ) : null}
              <DashedButton label={f.photo ? "Foto lista" : "Tomar foto (opcional)"} done={!!f.photo} onPress={() => photo("photo")} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View role="group" accessibilityLabel="Origen" style={s.two}>
                <View style={{ flex: 1 }}><ChoiceCard label="Nació aquí" icon="heart" tint={[colors.limaSoft, colors.selva]} on={f.origin === "nacido"} onPress={() => set({ origin: "nacido" })} /></View>
                <View style={{ flex: 1 }}><ChoiceCard label="La compré" icon="money" tint={[colors.tierraSoft, colors.tierra]} on={f.origin === "comprado"} onPress={() => set({ origin: "comprado" })} /></View>
              </View>
              {f.origin === "nacido" ? (
                <>
                  <SelectField label="Madre" value={f.motherId ?? ""} sheetTitle="¿Quién es la madre?"
                    options={[...mothers.map((m) => ({ id: m.id, label: `${m.name ?? ""} #${m.tagVisual ?? "—"}`.trim() })), { id: "", label: "No sé" }]}
                    onChange={(id) => set({ motherId: id || undefined })} />
                  <WizField label="Padre o pajilla (opcional)" value={f.sire} onChangeText={(t) => set({ sire: t })} placeholder="Ej: Capitán #00124 o código de pajilla" />
                  {mother ? <Note icon="heart">{`Se anota solo el parto de la madre y ${f.name.trim() || "la cría"} aparece como ${f.sex === "macho" ? "su hijo" : "su hija"} en la ficha de ${animalLabel(mother)}.`}</Note> : null}
                </>
              ) : (
                <>
                  <WizField label="¿A quién se lo compraste?" value={f.seller} onChangeText={(t) => set({ seller: t })} placeholder="Ej: Finca Los Naranjos" />
                  {money ? <WizField label="Precio" value={f.price} onChangeText={(t) => set({ price: t.replace(/\D/g, "") })} keyboardType="number-pad" placeholder="Ej: 2800000" /> : null}
                  <DateField label="Llegó el" value={f.bought} onChange={(bought) => set({ bought })} />
                  <DashedButton label={f.guide ? "Guía de movilización lista" : "Foto de la guía de movilización"} done={!!f.guide} onPress={() => photo("guide")} />
                  {money ? <Note icon="money">El precio se anota solo en Costos › Compra de animales.</Note> : null}
                </>
              )}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <SelectField label="¿En qué lote va?" value={f.lotId ?? ""} sheetTitle="¿En qué lote va?"
                options={[
                  { id: "", label: f.origin === "nacido" && motherLot ? `Con su madre · ${shortLot(motherLot)}` : "Sin lote por ahora" },
                  ...lots.map((l) => ({ id: l.id, label: l.name })),
                ]}
                onChange={(id) => set({ lotId: id || undefined })} />
              <View style={s.summary}>
                {[
                  ["Arete", f.noTag ? "Sin arete (pendiente)" : `#${f.tag}${f.rfid ? ` · chip ${f.rfid}` : ""}`],
                  ["Nombre", f.name || "—"],
                  ["Sexo y raza", `${f.sex === "hembra" ? "Hembra" : "Macho"}${f.breed ? ` · ${f.breed}` : ""}`],
                  ["Nació", `${birthDay ? shortDate(birthDay) : "—"} · ${category}`],
                  ["Origen", f.origin === "nacido" ? (mother ? `${f.sex === "macho" ? "Hijo" : "Hija"} de ${animalLabel(mother)}${mother.name && mother.tagVisual ? ` #${mother.tagVisual}` : ""}` : "Nació aquí") : `Comprado a ${f.seller}`],
                ].map(([k, v], i, arr) => (
                  <View key={k} style={[s.sum, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" }]}>
                    <Txt size={15} color={colors.textMuted}>{k}</Txt>
                    <Txt w="bold" size={15} style={{ flexShrink: 1, textAlign: "right" }}>{v}</Txt>
                  </View>
                ))}
              </View>
              <Txt size={14} color={colors.textMuted} style={{ textAlign: "center" }}>Se guarda en el teléfono y se sube cuando haya señal.</Txt>
            </>
          ) : null}

          {error ? <Note icon="alert" tone="danger">{error}</Note> : null}
        </Rise>
      </ScrollView>

      <BottomBar>
        <BarGhost label="Atrás" disabled={step === 0} onPress={() => setStep(step - 1)} />
        <BarMain label={step === 3 ? "Guardar animal" : "Siguiente"} onPress={next} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  reader: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: 24, backgroundColor: colors.selva },
  readerIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
  two: { flexDirection: "row", gap: 10 },
  summary: { backgroundColor: colors.card, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 16, ...shadow },
  sum: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 13 },
  ica: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.warnSoft },
});

export default function Screen() {
  return <RequireWrite table="animals"><NuevoAnimalScreen /></RequireWrite>;
}
