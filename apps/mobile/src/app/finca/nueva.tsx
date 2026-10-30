import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { createFarm, getFarm, updateFarm } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { Banner, Button, Field, GreenHeader } from "../../ui/kit";

/** Registers a farm, or edits it when an `id` is given. */
export default function NuevaFincaScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { selectFarm, refresh } = useFarm();
  const [name, setName] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [department, setDepartment] = useState("Huila");
  const [hectares, setHectares] = useState("");
  const [ica, setIca] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!id) return;
    getFarm(db, id).then((f) => {
      if (!f) return;
      setName(f.name);
      setMunicipality(f.municipality);
      setDepartment(f.department);
      setHectares(f.hectares ? String(f.hectares).replace(".", ",") : "");
      setIca(f.icaRegistration ?? "");
    });
  }, [db, id]);

  async function save() {
    if (!name.trim() || !municipality.trim() || !department.trim()) return setError("Escribe el nombre, el municipio y el departamento.");
    const ha = hectares.trim() ? Number(hectares.replace(",", ".")) : undefined;
    if (ha !== undefined && !(ha > 0)) return setError("Revisa las hectáreas.");
    const input = { name: name.trim(), municipality: municipality.trim(), department: department.trim(), hectares: ha, icaRegistration: ica.trim() || undefined };
    try {
      if (id) {
        await updateFarm(db, id, input);
        await refresh();
        return router.canGoBack() ? router.back() : router.replace("/fincas");
      }
      const farm = await createFarm(db, input);
      await selectFarm(farm.id);
      router.dismissTo("/");
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker={id ? "EDITAR FINCA" : "NUEVA FINCA"} title={id ? name || "Tu finca" : "Registra tu finca"} />
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Field label="Nombre de la finca" value={name} onChangeText={(t) => { setError(undefined); setName(t); }} placeholder="Ej: Finca La Esperanza" autoCapitalize="words" />
          <Field label="Municipio" value={municipality} onChangeText={(t) => { setError(undefined); setMunicipality(t); }} placeholder="Ej: Pitalito" autoCapitalize="words" />
          <Field label="Departamento" value={department} onChangeText={setDepartment} autoCapitalize="words" />
          <Field label="Hectáreas (opcional)" value={hectares} onChangeText={setHectares} keyboardType="decimal-pad" placeholder="Ej: 45" />
          <Field label="Registro ICA del predio (opcional)" value={ica} onChangeText={setIca} placeholder="Ej: 41-001-0123" autoCapitalize="characters" />
          {id ? null : <Banner icon="note" tone="ok" title="Se crea con un primer lote: “Lote 1”" />}
          {error ? <Banner icon="note" tone="danger" title={error} /> : null}
          <Button label={id ? "Guardar cambios" : "Guardar finca"} onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
