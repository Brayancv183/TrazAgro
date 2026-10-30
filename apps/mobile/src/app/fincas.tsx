import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { colors, plural, radius, shadow } from "@trazagro/shared";
import { useFarm } from "../lib/farm";
import { Icon } from "../ui/Icon";
import { Button, Chip, GreenHeader, Txt } from "../ui/kit";

export default function FincasScreen() {
  const router = useRouter();
  const { farm: current, farms, selectFarm, refresh } = useFarm();
  const total = farms.reduce((n, f) => n + f.animalCount, 0);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function open(id: string) {
    await selectFarm(id);
    router.dismissTo("/");
  }

  return (
    <FlatList
      data={farms}
      keyExtractor={(f) => f.id}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListHeaderComponent={
        <>
          <GreenHeader back kicker="TRAZAGRO" title="Mis fincas">
            <Txt w="medium" size={15} color={colors.onDarkMuted}>
              {`${plural(farms.length, "finca", "fincas")} · ${plural(total, "animal activo", "animales activos")}`}
            </Txt>
          </GreenHeader>
          {farms.some((f) => f.isDemo) ? (
            <View style={s.demo}>
              <Icon name="note" color={colors.warn} size={18} />
              <Txt size={13} color={colors.warn} style={{ flex: 1 }}>La finca de prueba es solo para explorar: no se sube a tu cuenta. Puedes ocultarla en Ajustes.</Txt>
            </View>
          ) : null}
        </>
      }
      ListFooterComponent={
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Button kind="soft" icon="plus" label="Registrar otra finca" onPress={() => router.push("/finca/nueva")} />
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => {
        const on = item.id === current?.id;
        return (
          <View style={[s.card, on && s.cardOn]}>
            <Pressable onPress={() => open(item.id)} accessibilityRole="button" accessibilityLabel={`Trabajar en ${item.name}`}
              style={({ pressed }) => [s.main, pressed && { opacity: 0.85 }]}>
            <View style={s.iconBox}><Icon name={on ? "check" : "cow"} color={colors.selva} size={26} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt w="bold" size={18}>{item.name}</Txt>
              <Txt size={14} color={colors.textMuted}>{item.municipality}, {item.department}{item.hectares ? ` · ${item.hectares} ha` : ""}</Txt>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <Chip label={plural(item.animalCount, "animal", "animales")} tone={{ bg: colors.limaSoft, fg: colors.selva }} />
                {on ? <Chip label="Actual" tone={{ bg: colors.selva, fg: colors.onDark }} /> : null}
                {item.isDemo ? <Chip label="Prueba" tone={{ bg: colors.warnSoft, fg: colors.warn }} /> : null}
                {item.icaRegistration ? <Chip label={item.icaRegistration} tone={{ bg: colors.tierraSoft, fg: colors.tierra }} /> : null}
              </View>
            </View>
            </Pressable>
            {item.isDemo ? null : (
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.name}`} hitSlop={8} style={s.edit}
                onPress={() => router.push({ pathname: "/finca/nueva", params: { id: item.id } })}>
                <Icon name="edit" color={colors.selva} size={18} />
              </Pressable>
            )}
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 2, borderColor: "transparent", ...shadow },
  cardOn: { borderColor: colors.lima },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  iconBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  edit: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  demo: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.warnSoft, marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: radius.md },
});
