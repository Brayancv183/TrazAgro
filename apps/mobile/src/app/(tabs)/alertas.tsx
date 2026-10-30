import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, farmAlerts, noveltiesFor, radius, shadow, todayDay, type Alert, type AlertLevel } from "@trazagro/shared";
import { loadFarmBundle } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { useDbQuery } from "../../lib/useDb";
import { Icon } from "../../ui/Icon";
import { Empty, GreenHeader, Txt } from "../../ui/kit";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

const LEVEL: Record<AlertLevel, { bg: string; fg: string; label: string }> = {
  alta: { bg: colors.dangerSoft, fg: colors.danger, label: "URGENTE" },
  media: { bg: colors.warnSoft, fg: colors.warn, label: "PENDIENTE" },
  info: { bg: colors.infoSoft, fg: colors.info, label: "PARA HOY" },
};

export default function AlertasScreen() {
  const farmId = useFarm().farm?.id ?? "";
  const router = useRouter();
  const today = todayDay();
  const { data } = useDbQuery((db) => loadFarmBundle(db, farmId), [farmId]);
  const alerts = data?.farm ? farmAlerts(data.animals, data.events, data.products, noveltiesFor(data.farm, data.animals, data.events, today), today) : [];

  function open(a: Alert) {
    if (a.animalId) router.push({ pathname: "/animal/[id]", params: { id: a.animalId } });
    else if (a.id === "ica") router.push("/ica");
    else if (a.productId) router.push("/inventario");
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
      <GreenHeader kicker={data?.farm?.name.toUpperCase() ?? ""} title="Alertas">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>{data ? (alerts.length ? "Lo más urgente primero." : "Todo en orden.") : "Cargando…"}</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {data && !alerts.length ? <Empty title="Sin alertas" text="No hay animales en retiro, productos por vencer ni novedades pendientes." /> : null}
        {alerts.map((a) => {
          const l = LEVEL[a.level];
          const tappable = !!a.animalId || !!a.productId || a.id === "ica";
          return (
            <Pressable key={a.id} disabled={!tappable} onPress={() => open(a)} accessibilityRole={tappable ? "button" : undefined}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
              <View style={[s.badge, { backgroundColor: l.bg }]}><Icon name={a.id.startsWith("retiro") ? "drop" : a.id.startsWith("pesaje") ? "scale" : a.id.startsWith("arete") ? "tag" : "note"} color={l.fg} size={20} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Txt w="semibold" size={11} color={l.fg} style={{ letterSpacing: 1.6 }}>{l.label}</Txt>
                <Txt w="bold" size={16}>{a.title}</Txt>
                <Txt size={13} color={colors.textMuted}>{a.detail}</Txt>
              </View>
              {tappable ? <Icon name="chevron" color={colors.textMuted} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, ...shadow },
  badge: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
