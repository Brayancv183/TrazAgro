import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { colors, demoFarms, getAnimalsByFarm } from "../data/demo";

export default function FincasScreen() {
  return (
    <FlatList
      data={demoFarms}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Text style={styles.subtitle}>Gestiona tu hato sin conexión</Text>
      }
      renderItem={({ item }) => {
        const count = getAnimalsByFarm(item.id).length;
        return (
          <Link href={{ pathname: "/finca/[id]", params: { id: item.id } }} asChild>
            <TouchableOpacity style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.farmName}>{item.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count} animales</Text>
                </View>
              </View>
              <Text style={styles.farmMeta}>
                {item.municipality}, {item.department} · {item.hectares} ha
              </Text>
              {item.icaRegistration ? (
                <Text style={styles.ica}>Registro ICA: {item.icaRegistration}</Text>
              ) : null}
            </TouchableOpacity>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  farmName: { fontSize: 18, fontWeight: "700", color: colors.text },
  badge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: colors.primary, fontWeight: "600", fontSize: 12 },
  farmMeta: { marginTop: 6, color: colors.textMuted, fontSize: 14 },
  ica: { marginTop: 4, color: colors.accent, fontSize: 12, fontWeight: "600" },
});
