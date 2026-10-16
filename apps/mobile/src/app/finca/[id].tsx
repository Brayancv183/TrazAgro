import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack, Link, useLocalSearchParams } from "expo-router";
import { colors, getAnimalsByFarm, getFarm } from "../../data/demo";

export default function FincaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const farm = getFarm(id);
  const animals = getAnimalsByFarm(id);

  return (
    <>
      <Stack.Screen options={{ title: farm?.name ?? "Finca" }} />
      <FlatList
        data={animals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.subtitle}>
            {animals.length} animales registrados
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No hay animales en esta finca</Text>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: "/animal/[id]", params: { id: item.id } }} asChild>
            <TouchableOpacity style={styles.card}>
              <View style={styles.row}>
                <View style={styles.tagCircle}>
                  <Text style={styles.tagText}>{item.tagNumber.slice(-3)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name ?? "Sin nombre"}</Text>
                  <Text style={styles.meta}>
                    #{item.tagNumber} · {item.species} · {item.sex}
                  </Text>
                  {item.breed ? <Text style={styles.breed}>{item.breed}</Text> : null}
                </View>
                <View
                  style={[
                    styles.linkBadge,
                    item.linkMode === "lorawan" && styles.linkBadgeGps,
                  ]}
                >
                  <Text
                    style={[
                      styles.linkBadgeText,
                      item.linkMode === "lorawan" && styles.linkBadgeTextGps,
                    ]}
                  >
                    {item.linkMode === "lorawan" ? "GPS" : "RFID"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 4 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  tagCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  breed: { fontSize: 12, color: colors.accent, fontWeight: "600" },
  linkBadge: {
    backgroundColor: "#F7F5EF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  linkBadgeText: { fontSize: 11, fontWeight: "700", color: colors.accent },
  linkBadgeGps: { backgroundColor: "#E8F5E9" },
  linkBadgeTextGps: { color: colors.primary },
});
