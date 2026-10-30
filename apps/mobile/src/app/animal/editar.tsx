import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { todayDay, type Animal, type AnimalSex, type Lot } from "@trazagro/shared";
import { DuplicateTagError, getAnimal, listLots, updateAnimal } from "../../db/repo";
import { RequireWrite } from "../../ui/NoPermission";
import { DateField, splitDay, toDay, type DayParts } from "../../ui/DateField";
import { Banner, Button, Chip, Field, GreenHeader, Txt } from "../../ui/kit";

/** Corrects an animal's data: ear tag, RFID, name, sex, breed, birth date, lot and sire. */
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

  async function save() {
    if (!animal) return;
    if (tag.trim() && !/^\d{3,10}$/.test(tag.trim())) return setError("El arete lleva solo números (de 3 a 10).");
    const day = toDay(birth);
    if (!day || day > todayDay()) return setError("Revisa la fecha de nacimiento.");
    try {
      await updateAnimal(db, animal, { tagVisual: tag.trim(), rfid: rfid.trim(), name: name.trim(), sex, breed: breed.trim(), birthDate: day, lotId, sireNote: sire.trim() });
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/animal/[id]", params: { id: animal.id } });
    } catch (e) {
      setError(e instanceof DuplicateTagError ? `Ese arete o chip ya lo tiene ${e.existing.name ?? `#${e.existing.tagVisual}`}.` : "No se pudo guardar. Intenta de nuevo.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker="EDITAR DATOS" title={animal?.name ?? (animal?.tagVisual ? `#${animal.tagVisual}` : "Animal")} />
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Field label="Número del arete" value={tag} onChangeText={(t) => { setError(undefined); setTag(t.replace(/\D/g, "")); }} keyboardType="number-pad" placeholder="Ej: 00123" />
          <Field label="Chip RFID (opcional)" value={rfid} onChangeText={(t) => { setError(undefined); setRfid(t); }} placeholder="Ej: 985 2024 00123" />
          <Field label="Nombre (opcional)" value={name} onChangeText={setName} placeholder="Ej: Lola" autoCapitalize="words" />
          <View style={{ gap: 6 }}>
            <Txt w="semibold" size={14}>Sexo</Txt>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip label="Hembra" active={sex === "hembra"} onPress={() => setSex("hembra")} />
              <Chip label="Macho" active={sex === "macho"} onPress={() => setSex("macho")} />
            </View>
          </View>
          <Field label="Raza" value={breed} onChangeText={setBreed} placeholder="Ej: Normando" autoCapitalize="words" />
          <DateField label="Fecha de nacimiento" value={birth} onChange={(v) => { setError(undefined); setBirth(v); }} />
          {lots.length ? (
            <View style={{ gap: 6 }}>
              <Txt w="semibold" size={14}>Lote</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {lots.map((l) => <Chip key={l.id} label={l.name.split(" · ")[0]!} active={lotId === l.id} onPress={() => setLotId(l.id)} />)}
              </View>
            </View>
          ) : null}
          <Field label="Padre o pajilla (opcional)" value={sire} onChangeText={setSire} placeholder="Ej: Toro Capitán o pajilla 7HO1234" />
          {error ? <Banner icon="note" tone="danger" title={error} /> : null}
          <Button label="Guardar cambios" onPress={save} disabled={!animal} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function Screen() {
  return <RequireWrite table="animals"><EditarAnimalScreen /></RequireWrite>;
}
