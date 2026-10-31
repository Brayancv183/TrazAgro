import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel, colors, fonts, radius, shadow, type Animal } from "@trazagro/shared";
import { findByTag } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { Icon } from "../../ui/Icon";
import { Banner, Button, Chip, EarTag, GreenHeader, Txt } from "../../ui/kit";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

/**
 * Find an animal by ear tag or RFID. Bluetooth RFID readers type the code like a keyboard and press
 * Enter, so a focused field is all they need. "Corral rápido" collects several animals for one event.
 */
export default function EscanearScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { farm, can } = useFarm();
  const canEdit = can("events");
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState("");
  const [corral, setCorral] = useState(false);
  const [batch, setBatch] = useState<Animal[]>([]);
  const [notFound, setNotFound] = useState<string>();
  const [last, setLast] = useState<string>();

  async function lookup() {
    const c = code.trim();
    if (!c || !farm) return;
    setNotFound(undefined);
    const a = await findByTag(db, farm.id, c);
    setCode("");
    input.current?.focus();
    if (!a || a.status !== "activo") return setNotFound(c);
    if (!corral) return router.push({ pathname: "/animal/[id]", params: { id: a.id } });
    setLast(batch.some((b) => b.id === a.id) ? `${animalLabel(a)} ya estaba en el corral` : `Agregado: ${animalLabel(a)}`);
    setBatch((b) => (b.some((x) => x.id === a.id) ? b : [a, ...b]));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled">
        <GreenHeader kicker={farm?.name.toUpperCase() ?? ""} title="Escanear arete">
          <Txt w="medium" size={15} color={colors.onDarkMuted}>Escribe el número del arete o usa tu lector RFID.</Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <View style={s.modes}>
            <Chip label="Buscar uno" active={!corral} onPress={() => { setCorral(false); setBatch([]); setLast(undefined); }} />
            <Chip label="Corral rápido" active={corral} onPress={() => setCorral(true)} />
          </View>

          <View style={s.reader}>
            <Icon name="scan" color={colors.selva} size={30} />
            <TextInput ref={input} value={code} onChangeText={(t) => { setNotFound(undefined); setCode(t); }} onSubmitEditing={lookup}
              placeholder="Arete o RFID" placeholderTextColor="#9AA39D" autoFocus returnKeyType="search" autoCapitalize="characters"
              blurOnSubmit={false} accessibilityLabel="Número de arete o RFID"
              style={{ flex: 1, fontFamily: fonts.bold, fontSize: 24, color: colors.text, minHeight: 56 }} />
          </View>
          <Button label={corral ? "Agregar al corral" : "Buscar"} icon="search" onPress={lookup} disabled={!code.trim()} />

          {notFound ? (
            <>
              <Banner icon="tag" tone="warn" title={`No hay un animal activo con “${notFound}”`} text="Revisa el número o regístralo ahora con ese arete." />
              {canEdit ? <Button kind="soft" icon="plus" label={`Registrar con ${notFound}`} onPress={() => router.push({ pathname: "/animal/nuevo", params: { tag: notFound } })} /> : null}
            </>
          ) : null}

          {corral ? (
            <View style={{ gap: 10 }}>
              <Txt w="extrabold" size={19}>{batch.length ? `${batch.length} en el corral` : "Corral vacío"}</Txt>
              {last ? <Txt size={13} color={colors.textMuted}>{last}</Txt> : null}
              <Txt size={13} color={colors.textMuted}>Pasa los animales por la manga y escanea uno por uno. Al final registra la vacuna, el pesaje o el tratamiento a todos juntos.</Txt>
              {batch.map((a) => (
                <View key={a.id} style={s.row}>
                  <EarTag code={a.tagVisual} size={38} tone={a.sex === "macho" ? colors.tierra : colors.selva} />
                  <Txt w="bold" size={16} style={{ flex: 1 }}>{animalLabel(a)}</Txt>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${animalLabel(a)}`} hitSlop={8}
                    onPress={() => setBatch((b) => b.filter((x) => x.id !== a.id))}>
                    <Icon name="x" color={colors.textMuted} size={20} />
                  </Pressable>
                </View>
              ))}
              {batch.length && canEdit ? (
                <Button icon="check" label={`Registrar a los ${batch.length}`}
                  onPress={() => router.push({ pathname: "/evento/nuevo", params: { animalIds: batch.map((a) => a.id).join(",") } })} />
              ) : null}
            </View>
          ) : null}

          <Banner icon="camera" tone="ok" title="Cámara y NFC del celular"
            text="La lectura con cámara y con NFC llega en la app instalada (Android/iPhone). Los lectores RFID Bluetooth ya funcionan: conéctalo y escanea en este campo." />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  modes: { flexDirection: "row", gap: 8 },
  reader: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 18, borderWidth: 2, borderColor: colors.lima, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 10, ...shadow },
});
