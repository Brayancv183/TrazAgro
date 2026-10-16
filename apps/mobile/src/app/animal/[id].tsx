import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { colors, getAnimal, getFarm } from "../../data/demo";

export default function AnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const animal = getAnimal(id);
  const farm = animal ? getFarm(animal.farmId) : undefined;

  if (!animal) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Animal no encontrado</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: animal.name ?? `#${animal.tagNumber}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{animal.tagNumber.slice(-3)}</Text>
          </View>
          <View>
            <Text style={styles.name}>{animal.name ?? "Sin nombre"}</Text>
            <Text style={styles.tag}>Arete #{animal.tagNumber}</Text>
          </View>
        </View>

        <Section title="Identificación">
          <Row label="Especie" value={animal.species} />
          <Row label="Sexo" value={animal.sex} />
          {animal.breed ? <Row label="Raza" value={animal.breed} /> : null}
          {animal.rfidCode ? <Row label="Código RFID" value={animal.rfidCode} /> : null}
          <Row label="Modo de rastreo" value={animal.linkMode} />
          <Row label="Estado" value={animal.status} />
        </Section>

        <Section title="Origen">
          {animal.birthDate ? <Row label="Nacimiento" value={animal.birthDate} /> : null}
          {farm ? <Row label="Finca" value={farm.name} /> : null}
          {animal.motherId ? <Row label="Madre" value={`#${animal.motherId}`} /> : null}
        </Section>

        <Text style={styles.footer}>
          Historial clínico, pesajes y reproducción llegan en la Fase 1 del MVP.
        </Text>
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.textMuted },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "800", color: colors.text },
  tag: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  footer: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginBottom: 24 },
});
