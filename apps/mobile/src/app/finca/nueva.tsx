import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@trazagro/shared";
import { createFarm, getFarm, updateFarm } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { Icon, type IconName } from "../../ui/Icon";
import { HeaderButton, Kicker, Txt, Wave } from "../../ui/kit";
import { Rise } from "../../ui/motion";
import { ActionBar, FField } from "../../ui/finca/parts";

/** Registers a farm, or edits it when an `id` is given. Visual language of Registro1.dc (header with ✕, 28 px question, pill fields, green action bar). */
export default function NuevaFincaScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const close = () => (router.canGoBack() ? router.back() : router.replace(id ? "/fincas" : "/"));

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
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View style={s.headerRow}>
            <HeaderButton icon="x" label="Cancelar" onPress={close} />
            <Kicker>{id ? "EDITAR FINCA" : "NUEVA FINCA"}</Kicker>
            <View style={{ width: 46 }} />
          </View>
        </View>
        <Wave height={40} />

        <View style={s.main}>
          <Rise index={0}>
            <Txt w="extrabold" size={28} style={{ letterSpacing: -0.56 }}>{id ? name || "Tu finca" : "Registra tu finca"}</Txt>
          </Rise>
          <Rise index={1} style={{ gap: 12 }}>
            <FField label="Nombre de la finca" value={name} onChangeText={(t) => { setError(undefined); setName(t); }} placeholder="Ej: Finca La Esperanza" autoCapitalize="words" />
            <View style={s.two}>
              <View style={{ flex: 1 }}><FField label="Municipio" value={municipality} onChangeText={(t) => { setError(undefined); setMunicipality(t); }} placeholder="Ej: Pitalito" autoCapitalize="words" /></View>
              <View style={{ flex: 1 }}><FField label="Departamento" value={department} onChangeText={(t) => { setError(undefined); setDepartment(t); }} autoCapitalize="words" /></View>
            </View>
            <View style={s.two}>
              <View style={{ flex: 1 }}><FField label="Hectáreas (opcional)" value={hectares} onChangeText={(t) => { setError(undefined); setHectares(t); }} keyboardType="decimal-pad" placeholder="Ej: 45" /></View>
              <View style={{ flex: 1.3 }}><FField label="Registro ICA (opcional)" value={ica} onChangeText={setIca} placeholder="Ej: 41-001-0123" autoCapitalize="characters" /></View>
            </View>
          </Rise>
          <Rise index={2} style={{ gap: 10 }}>
            {id ? null : <Note icon="layers" text="Se crea con un primer lote: “Lote 1”. Después puedes agregar más en Lotes." />}
            <Note icon="sync" text="Se guarda en el teléfono y se sube cuando haya señal." />
            {error ? <Note icon="alert" tone="danger" text={error} /> : null}
          </Rise>
        </View>
      </ScrollView>
      <ActionBar backLabel="Cancelar" onBack={close} label={id ? "Guardar cambios" : "Guardar finca"} onPress={save} />
    </KeyboardAvoidingView>
  );
}

function Note({ icon, text, tone = "ok" }: { icon: IconName; text: string; tone?: "ok" | "danger" }) {
  const danger = tone === "danger";
  return (
    <View accessibilityRole={danger ? "alert" : undefined} style={[s.note, { backgroundColor: danger ? colors.dangerSoft : colors.limaSoft }]}>
      <Icon name={icon} color={danger ? colors.danger : colors.selva} size={20} />
      <Txt w="semibold" size={14} color={danger ? colors.urgentText : colors.selva} style={{ flex: 1, lineHeight: 19 }}>{text}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  main: { paddingHorizontal: 16, gap: 14 },
  two: { flexDirection: "row", gap: 10 },
  note: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20 },
});
