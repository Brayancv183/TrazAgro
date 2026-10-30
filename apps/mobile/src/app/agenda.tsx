import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { addDays, agenda, colors, radius, shadow, shortDate, todayDay, type AgendaItem } from "@trazagro/shared";
import { loadFarmBundle } from "../db/repo";
import { useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon, type IconName } from "../ui/Icon";
import { Empty, GreenHeader, Txt } from "../ui/kit";

const KIND_ICON: Record<AgendaItem["kind"], IconName> = { reproduccion: "heart", salud: "syringe", pesaje: "scale", inventario: "box" };

/** What is due on the farm: overdue first, then this week and the next weeks. */
export default function AgendaScreen() {
  const router = useRouter();
  const farmId = useFarmId();
  const today = todayDay();
  const { data } = useDbQuery((d) => loadFarmBundle(d, farmId), [farmId]);
  const items = data ? agenda(data.animals, data.events, data.products, today, 45) : [];
  const week = addDays(today, 7);
  const groups = [
    { title: "Atrasado", tone: colors.danger, items: items.filter((i) => i.date < today) },
    { title: "Hoy", tone: colors.selva, items: items.filter((i) => i.date === today) },
    { title: "Esta semana", tone: colors.selva, items: items.filter((i) => i.date > today && i.date <= week) },
    { title: "Más adelante", tone: colors.textMuted, items: items.filter((i) => i.date > week) },
  ].filter((g) => g.items.length);

  function open(i: AgendaItem) {
    if (i.animalId) router.push({ pathname: "/animal/[id]", params: { id: i.animalId } });
    else if (i.productId) router.push("/inventario");
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker={data?.farm?.name.toUpperCase() ?? ""} title="Agenda">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>Próximos 45 días, calculado de tus registros.</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {data && !items.length ? <Empty title="Nada pendiente" text="Cuando registres servicios, vacunas y pesajes, aquí verás lo que toca." /> : null}
        {groups.map((g) => (
          <View key={g.title} style={{ gap: 8, marginBottom: 6 }}>
            <Txt w="semibold" size={12} color={g.tone} style={{ letterSpacing: 1.8 }}>{g.title.toUpperCase()} · {g.items.length}</Txt>
            {g.items.map((i) => (
              <Pressable key={i.id} accessibilityRole="button" onPress={() => open(i)} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
                <View style={s.date}>
                  <Txt w="extrabold" size={13} color={g.tone}>{shortDate(i.date, today)}</Txt>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="bold" size={15}>{i.title}</Txt>
                  <Txt size={13} color={colors.textMuted}>{i.detail}</Txt>
                </View>
                <Icon name={KIND_ICON[i.kind]} color={colors.selva} size={20} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  date: { width: 64, alignItems: "center" },
});
