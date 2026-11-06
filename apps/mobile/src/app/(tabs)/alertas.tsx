import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, farmAlerts, noveltiesFor, plural, shadow, todayDay, type Alert, type AlertLevel } from "@trazagro/shared";
import { markAlertsRead, readAlertIds } from "../../db/campo";
import { loadFarmBundle } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { useDbQuery } from "../../lib/useDb";
import { Icon, type IconName } from "../../ui/Icon";
import { Empty, Kicker, Txt, Wave } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { SectionLabel, Tag } from "../../ui/campo/parts";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

/** Card tones from Alertas.dc: urgent ones are red cards, the rest white cards with a tinted icon. */
const TONE: Record<AlertLevel | "plain", { card: string; iconBg: string; icon: string; shadow: boolean }> = {
  alta: { card: colors.dangerSoft, iconBg: colors.urgent, icon: colors.onDark, shadow: false },
  media: { card: colors.card, iconBg: colors.warnSoft, icon: colors.amberText, shadow: true },
  info: { card: colors.card, iconBg: colors.infoSoft, icon: colors.info, shadow: true },
  plain: { card: colors.card, iconBg: colors.sand, icon: colors.text, shadow: true },
};
const GROUPS: { level: AlertLevel; title: string }[] = [
  { level: "alta", title: "Urgente" },
  { level: "media", title: "Pendiente" },
  { level: "info", title: "Cuando puedas" },
];

function iconOf(a: Alert): IconName {
  if (a.id.startsWith("retiro")) return "drop";
  if (a.id.startsWith("pesaje")) return "scale";
  if (a.id.startsWith("arete") || a.id.startsWith("duplicado")) return "tag";
  if (a.productId) return "box";
  if (a.id === "ica") return "report";
  return "alert";
}

function targetOf(a: Alert): Href | undefined {
  if (a.animalId) return { pathname: "/animal/[id]", params: { id: a.animalId } };
  if (a.id === "ica") return "/ica";
  if (a.productId) return "/inventario";
  return undefined;
}

export default function AlertasScreen() {
  const db = useSQLiteContext();
  const farmId = useFarm().farm?.id ?? "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = todayDay();
  const [readNow, setReadNow] = useState<Set<string>>(new Set());
  const { data } = useDbQuery(async (d) => {
    const [bundle, read] = await Promise.all([loadFarmBundle(d, farmId), readAlertIds(d, farmId)]);
    return { ...bundle, read };
  }, [farmId]);
  const alerts = data?.farm ? farmAlerts(data.animals, data.events, data.products, noveltiesFor(data.farm, data.animals, data.events, today), today) : [];
  const isRead = (a: Alert) => !!data?.read.has(a.id) || readNow.has(a.id);
  const unread = alerts.filter((a) => !isRead(a));

  async function markAll() {
    const ids = alerts.map((a) => a.id);
    setReadNow(new Set(ids));
    await markAlertsRead(db, farmId, ids);
  }

  async function open(a: Alert) {
    setReadNow((cur) => new Set(cur).add(a.id));
    markAlertsRead(db, farmId, [a.id]);
    const to = targetOf(a);
    if (to) router.push(to);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
      <View style={[s.header, { paddingTop: insets.top + 20 }]}>
        <View style={s.headRow}>
          <View style={{ gap: 2, flex: 1 }}>
            <Kicker>{data ? (unread.length ? `${unread.length} SIN LEER` : "TODO LEÍDO") : " "}</Kicker>
            <Txt w="extrabold" size={31} color={colors.onDark} style={{ letterSpacing: -0.62, lineHeight: 34 }}>Alertas</Txt>
          </View>
          {unread.length ? (
            <Tap accessibilityRole="button" accessibilityLabel="Marcar leídas" onPress={markAll} style={s.markAll}>
              <Txt w="extrabold" size={13} color={colors.lima}>Marcar leídas</Txt>
            </Tap>
          ) : null}
        </View>
        <View style={s.push} accessibilityLabel="Avisos al celular: llegan pronto">
          <Icon name="phone" color={colors.link} size={20} />
          <Txt w="bold" size={14} style={{ flex: 1 }}>Avisos al celular</Txt>
          <Tag label="Pronto" bg={colors.sand} fg={colors.textMuted} />
        </View>
      </View>
      <Wave height={40} />

      <View style={s.main}>
        {data && !alerts.length ? (
          <Rise index={1}><Empty title="Sin alertas" text="No hay animales en retiro, productos por vencer ni novedades pendientes." /></Rise>
        ) : null}
        {GROUPS.map((g, gi) => {
          const items = alerts.filter((a) => a.level === g.level);
          if (!items.length) return null;
          return (
            <Rise key={g.level} index={gi + 1} style={{ gap: 10 }}>
              <SectionLabel>{`${g.title} · ${items.length}`}</SectionLabel>
              {items.map((a) => {
                const t = TONE[a.productId && a.level !== "alta" ? "plain" : a.level];
                const to = targetOf(a);
                const read = isRead(a);
                return (
                  <Tap key={a.id} accessibilityRole={to ? "button" : undefined} accessibilityLabel={`${a.title}. ${a.detail}${read ? "" : ". Sin leer"}`}
                    onPress={() => open(a)} style={[s.card, { backgroundColor: t.card }, t.shadow && shadow]}>
                    <View style={[s.ic, { backgroundColor: t.iconBg }]}><Icon name={iconOf(a)} color={t.icon} size={20} /></View>
                    <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                      <Txt w="extrabold" size={15} style={{ lineHeight: 20 }}>{a.title}</Txt>
                      <Txt size={13} color={colors.textMuted} style={{ lineHeight: 18 }}>{a.detail}</Txt>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 8, paddingTop: 2 }}>
                      {to ? <Icon name="chevron" color={colors.textMuted} size={18} /> : null}
                      {!read ? <View style={s.dot} /> : null}
                    </View>
                  </Tap>
                );
              })}
            </Rise>
          );
        })}
        {data && alerts.length ? (
          <Txt size={12} color={colors.textMuted} style={{ textAlign: "center" }}>{`Calculadas con tus registros · ${plural(alerts.length, "alerta", "alertas")}`}</Txt>
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6, gap: 14 },
  headRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  markAll: { height: 40, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" },
  push: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.card, borderRadius: 18, ...shadow },
  main: { paddingTop: 16, paddingHorizontal: 16, gap: 16 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 20 },
  ic: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.link },
});
