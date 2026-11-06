import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel, colors, todayDay, type Animal, type AnimalSex, type Lot } from "@trazagro/shared";
import { DuplicateTagError, getAnimal, listLots, updateAnimal } from "../../db/repo";
import { RequireWrite } from "../../ui/NoPermission";
import { DateField, splitDay, toDay, type DayParts } from "../../ui/DateField";
import { Txt } from "../../ui/kit";
import { Rise } from "../../ui/motion";
import { BarGhost, BarMain, BottomBar, ChoiceCard, Note, SelectField, WizardHeader, WizField } from "../../ui/animales/parts";

/** Corrects an animal's data: ear tag, RFID, name, sex, breed, birth date, lot and sire. Same look as the new-animal wizard. */
function EditarAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [animal, setAnimal] = useState<Animal>();
  const [lots, setLots] = useState<Lot[]>([]);
  const [tag, setTag] = useState("");
  const [rfid, setRfid] = useState("");
  const [name, setName] = useState("");
  const [sex, setSex] = useState<AnimalSex>("hembra");
  const [breed, setBreed] = useState("");
  const [birth, setBirth] = useState<DayParts>(splitDay(todayDay()));
  const [lotId, setLotId] = useState<string>();
  const [sire, setSire] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    getAnimal(db, id).then(async (a) => {
      if (!a) return;
      setAnimal(a);
      setLots(await listLots(db, a.farmId));
      setTag(a.tagVisual ?? "");
      setRfid(a.rfid ?? "");
      setName(a.name ?? "");
      setSex(a.sex);
      setBreed(a.breed ?? "");
      setBirth(splitDay(a.birthDate));
      setLotId(a.lotId);
      setSire(a.sireNote ?? "");
    });
  }, [db, id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/animal/[id]", params: { id } }));
  const day = toDay(birth);

  async function save() {
    if (!animal) return;
    if (tag.trim() && !/^\d{3,10}$/.test(tag.trim())) return setError("El arete lleva solo números (de 3 a 10).");
    if (!day || day > todayDay()) return setError("Revisa la fecha de nacimiento.");
    try {
      await updateAnimal(db, animal, { tagVisual: tag.trim(), rfid: rfid.trim(), name: name.trim(), sex, breed: breed.trim(), birthDate: day, lotId, sireNote: sire.trim() });
      close();
    } catch (e) {
      setError(e instanceof DuplicateTagError ? `Ese arete o chip ya lo tiene ${animalLabel(e.existing)}.` : "No se pudo guardar. Intenta de nuevo.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <WizardHeader kicker="EDITAR DATOS" icon="back" closeLabel="Volver" onClose={close} />
        <Rise style={{ paddingHorizontal: 16, gap: 12 }}>
          <Txt w="extrabold" size={28} style={{ letterSpacing: -0.56 }}>{animal ? animalLabel(animal) : "Animal"}</Txt>
          {error ? <Note icon="alert" tone="danger">{error}</Note> : null}
          <View style={s.two}>
            <View style={{ flex: 1 }}><WizField label="Número del arete" value={tag} onChangeText={(t) => { setError(undefined); setTag(t.replace(/\D/g, "")); }} keyboardType="number-pad" placeholder="Ej: 00123" /></View>
            <View style={{ flex: 1 }}><WizField label="Nombre (opcional)" value={name} onChangeText={setName} placeholder="Ej: Lola" autoCapitalize="words" /></View>
          </View>
          <WizField label="Chip RFID (opcional)" value={rfid} onChangeText={(t) => { setError(undefined); setRfid(t); }} placeholder="Ej: 985 2024 00123" />
          <View role="group" accessibilityLabel="Sexo" style={s.two}>
            <View style={{ flex: 1 }}><ChoiceCard label="Hembra" on={sex === "hembra"} onPress={() => setSex("hembra")} /></View>
            <View style={{ flex: 1 }}><ChoiceCard label="Macho" on={sex === "macho"} onPress={() => setSex("macho")} /></View>
          </View>
          <WizField label="Raza" value={breed} onChangeText={setBreed} placeholder="Ej: Normando" autoCapitalize="words" />
          <DateField label="Fecha de nacimiento" value={birth} onChange={(v) => { setError(undefined); setBirth(v); }} />
          {lots.length ? (
            <SelectField label="Lote" value={lotId ?? ""} sheetTitle="¿En qué lote está?"
              options={[...(lotId ? [] : [{ id: "", label: "Sin lote" }]), ...lots.map((l) => ({ id: l.id, label: l.name }))]}
              onChange={(v) => setLotId(v || undefined)} />
          ) : null}
          <WizField label="Padre o pajilla (opcional)" value={sire} onChangeText={setSire} placeholder="Ej: Toro Capitán o pajilla 7HO1234" />
          <Txt size={14} color={colors.textMuted} style={{ textAlign: "center" }}>Se guarda en el teléfono y se sube cuando haya señal.</Txt>
        </Rise>
      </ScrollView>
      <BottomBar>
        <BarGhost label="Cancelar" onPress={close} />
        <BarMain label="Guardar cambios" onPress={save} />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  two: { flexDirection: "row", gap: 10 },
});

export default function Screen() {
  return <RequireWrite table="animals"><EditarAnimalScreen /></RequireWrite>;
}
