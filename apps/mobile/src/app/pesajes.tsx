import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { animalLabel, colors, daysBetween, num, radius, shadow, shortDate, todayDay, WEIGH_EVERY_DAYS, weightSummary } from "@trazagro/shared";
import { listAnimals, listFarmEvents, listLots } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Button, Card, EarTag, Empty, GreenHeader, Txt } from "../ui/kit";

/** Last weight and daily gain per animal, averaged by lot. */
export default function PesajesScreen() {
  const router = useRouter();
  const farmId = useFarmId();
  const canEdit = useFarm().can("events");
  const today = todayDay();
  const { data } = useDbQuery(async (d) => {
    const [animals, events, lots] = await Promise.all([listAnimals(d, farmId), listFarmEvents(d, farmId), listLots(d, farmId)]);
    return { lots, rows: animals.map((a) => ({ a, w: weightSummary(events.filter((e) => e.animalId === a.id)) })) };
  }, [farmId]);

  const rows = (data?.rows ?? []).sort((x, y) => (y.w.dailyGainKg ?? -99) - (x.w.dailyGainKg ?? -99));
  const weighed = rows.filter((r) => r.w.lastKg);
  const byLot = (data?.lots ?? []).map((l) => {
    const gains = rows.filter((r) => r.a.lotId === l.id && r.w.dailyGainKg !== undefined).map((r) => r.w.dailyGainKg!);
    return { l, avg: gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : undefined, n: gains.length };
  }).filter((x) => x.n);
  const due = rows.filter((r) => !r.w.lastDate || daysBetween(r.w.lastDate, today) >= WEIGH_EVERY_DAYS).length;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker="HATO" title="Pesajes">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>{data ? `${weighed.length} con peso · ${due} por pesar` : "Cargando…"}</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {canEdit ? <Button icon="scale" label="Registrar pesaje" onPress={() => router.push({ pathname: "/evento/nuevo", params: { kind: "pesaje" } })} /> : null}
        {byLot.length ? (
          <Card style={{ gap: 8 }}>
            <Txt w="semibold" size={11} color={colors.hoja} style={{ letterSpacing: 2.2 }}>GANANCIA PROMEDIO POR LOTE</Txt>
            {byLot.map(({ l, avg }) => (
              <View key={l.id} style={s.line}>
                <Txt size={15} style={{ flex: 1 }}>{l.name}</Txt>
                <Txt w="bold" size={15} color={avg! >= 0 ? colors.selva : colors.danger}>{num(avg!, 2)} kg/día</Txt>
              </View>
            ))}
          </Card>
        ) : null}
        {data && !rows.length ? <Empty title="Sin animales" text="Registra animales para seguir su peso." /> : null}
        {rows.map(({ a, w }) => {
          const late = !w.lastDate || daysBetween(w.lastDate, today) >= WEIGH_EVERY_DAYS;
          return (
            <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/animal/[id]", params: { id: a.id } })} style={s.row}>
              <EarTag code={a.tagVisual} size={38} tone={a.sex === "macho" ? colors.tierra : colors.selva} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="bold" size={16}>{animalLabel(a)}</Txt>
                <Txt size={13} color={late ? colors.warn : colors.textMuted}>{w.lastDate ? `Pesado ${shortDate(w.lastDate, today)}${late ? " · toca pesar" : ""}` : "Nunca pesado"}</Txt>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Txt w="extrabold" size={18}>{w.lastKg ? `${num(w.lastKg)} kg` : "—"}</Txt>
                {w.dailyGainKg !== undefined ? <Txt w="semibold" size={12} color={w.dailyGainKg >= 0 ? colors.selva : colors.danger}>{w.dailyGainKg >= 0 ? "▲" : "▼"} {num(Math.abs(w.dailyGainKg), 2)} kg/día</Txt> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  line: { flexDirection: "row", alignItems: "center", minHeight: 36 },
});
