import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { animalLabel, colors, daysBetween, num, shadow, shortDate, todayDay, WEIGH_EVERY_DAYS, weightSummary, type AnimalEvent } from "@trazagro/shared";
import { listAnimals, listFarmEvents, listLots } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon, type IconName } from "../ui/Icon";
import { EarTag, Empty, GreenHeader, Txt, tagTone } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { HAIR, SectionLabel } from "../ui/campo/parts";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const SLOW_GAIN = 0.3;

/** Pesajes (Pesajes.dc): average weight by lot, 6-month evolution, how to weigh, best gains and every animal. */
export default function PesajesScreen() {
  const router = useRouter();
  const farmId = useFarmId();
  const canEdit = useFarm().can("events");
  const today = todayDay();
  const [lot, setLot] = useState("todos");
  const { data } = useDbQuery(async (d) => {
    const [animals, events, lots] = await Promise.all([listAnimals(d, farmId), listFarmEvents(d, farmId), listLots(d, farmId)]);
    const weighings = events.filter((e) => e.type === "pesaje" && typeof e.weightKg === "number");
    return { lots, weighings, rows: animals.map((a) => ({ a, w: weightSummary(events.filter((e) => e.animalId === a.id)) })) };
  }, [farmId]);

  const lots = (data?.lots ?? []).filter((l) => data?.rows.some((r) => r.a.lotId === l.id));
  const all = (data?.rows ?? []).slice().sort((x, y) => (y.w.dailyGainKg ?? -99) - (x.w.dailyGainKg ?? -99));
  const rows = all.filter((r) => lot === "todos" || r.a.lotId === lot);
  const weighed = rows.filter((r) => r.w.lastKg);
  const gains = rows.filter((r) => r.w.dailyGainKg !== undefined).map((r) => r.w.dailyGainKg!);
  const avgKg = weighed.length ? weighed.reduce((n, r) => n + r.w.lastKg!, 0) / weighed.length : undefined;
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : undefined;
  const due = rows.filter((r) => !r.w.lastDate || daysBetween(r.w.lastDate, today) >= WEIGH_EVERY_DAYS).length;
  const ids = new Set(rows.map((r) => r.a.id));
  const bars = monthly((data?.weighings ?? []).filter((e) => ids.has(e.animalId)), today);
  const byLot = lots.map((l) => {
    const g = all.filter((r) => r.a.lotId === l.id && r.w.dailyGainKg !== undefined).map((r) => r.w.dailyGainKg!);
    return { l, avg: g.length ? g.reduce((a, b) => a + b, 0) / g.length : undefined };
  }).filter((x) => x.avg !== undefined);
  const slow = rows.filter((r) => r.w.dailyGainKg !== undefined && r.w.dailyGainKg < SLOW_GAIN);
  const best = rows.filter((r) => (r.w.dailyGainKg ?? 0) > 0).slice(0, 3);
  const lotName = lot === "todos" ? "todo el hato" : lots.find((l) => l.id === lot)?.name.split(" · ")[0] ?? "";
  const weigh = () => router.push({ pathname: "/evento/nuevo", params: { kind: "pesaje" } });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <GreenHeader back title={avgKg !== undefined ? `${num(avgKg, 0)} kg` : "Sin pesos"} kicker={`PESO PROMEDIO · ${lotName.toUpperCase()}`} waveHeight={40}
        right={lots.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 270, flexGrow: 0 }} contentContainerStyle={s.lotGroup}>
            {[{ id: "todos", name: "Todos" }, ...lots].map((l) => {
              const on = l.id === lot;
              const label = l.name.split(" · ")[0]!;
              return (
                <Tap key={l.id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} aria-pressed={on} onPress={() => setLot(l.id)}
                  style={[s.lotBtn, on && { backgroundColor: colors.selva }]}>
                  <Txt w="bold" size={13} color={on ? colors.onDark : colors.textMuted}>{label}</Txt>
                </Tap>
              );
            })}
          </ScrollView>
        ) : undefined}>
        <Txt w="semibold" size={14} color={colors.onDarkMuted}>
          {[avgGain !== undefined && `${avgGain >= 0 ? "▲" : "▼"} ${num(Math.abs(avgGain), 2)} kg/día`, data && `${weighed.length} con peso · ${due} por pesar`].filter(Boolean).join("  ·  ")}
        </Txt>
      </GreenHeader>

      <View style={s.main}>
        <Rise index={0} style={s.card}>
          <Txt w="bold" size={13} color={colors.textMuted}>Últimos 6 meses · peso promedio</Txt>
          <View style={s.chart} accessibilityLabel={`Peso promedio por mes: ${bars.map((b) => `${b.m} ${b.kg ? `${num(b.kg, 0)} kilos` : "sin datos"}`).join(", ")}`}>
            {bars.map((b, i) => (
              <View key={b.m} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                <Txt w="extrabold" size={11}>{b.kg ? num(b.kg, 0) : "—"}</Txt>
                <View style={[s.bar, { height: b.h, backgroundColor: b.kg ? (i === bars.length - 1 ? colors.link : colors.onDarkMuted) : colors.sand }]} />
                <Txt w="semibold" size={11} color={colors.textMuted}>{b.m}</Txt>
              </View>
            ))}
          </View>
        </Rise>

        {byLot.length || slow.length ? (
          <Rise index={1} style={s.card}>
            <SectionLabel color={colors.hoja}>Ganancia promedio por lote</SectionLabel>
            {byLot.map(({ l, avg }) => (
              <View key={l.id} style={s.line}>
                <Txt w="semibold" size={15} style={{ flex: 1 }}>{l.name}</Txt>
                <Txt w="extrabold" size={15} color={avg! >= 0 ? colors.link : colors.danger}>{`${avg! >= 0 ? "+" : "−"}${num(Math.abs(avg!), 2)} kg/día`}</Txt>
              </View>
            ))}
            {slow.length ? (
              <View style={s.slow}>
                <Txt size={13} color={colors.signalText} style={{ lineHeight: 18 }}>
                  <Txt w="bold" size={13} color={colors.signalText}>{`${slow.length} ${slow.length === 1 ? "se queda atrás" : "se quedan atrás"}: `}</Txt>
                  {`${slow.slice(0, 4).map((r) => animalLabel(r.a)).join(", ")}${slow.length > 4 ? "…" : ""} ${slow.length === 1 ? "gana" : "ganan"} menos de ${num(SLOW_GAIN)} kg/día`}
                </Txt>
              </View>
            ) : null}
          </Rise>
        ) : null}

        <Rise index={2} style={s.how}>
          <Txt w="extrabold" size={17} color={colors.onDark}>¿Cómo vas a pesar?</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <HowTile icon="scale" title="Báscula Bluetooth" sub="Pronto" white />
            <HowTile icon="camera" title="Foto con IA" sub="Pronto" />
            <HowTile icon="edit" title="Escribir o cinta" sub={canEdit ? "Manual · ahora" : "Manual"} onPress={canEdit ? weigh : undefined} label="Registrar pesaje" />
          </View>
        </Rise>

        {best.length ? (
          <Rise index={3} style={{ gap: 8 }}>
            <Txt w="extrabold" size={17}>Mejor ganancia</Txt>
            <View style={[s.card, { paddingVertical: 4, gap: 0 }]}>
              {best.map((r, i) => (
                <View key={r.a.id} style={[s.bestRow, i < best.length - 1 && { borderBottomWidth: 1, borderBottomColor: HAIR }]}>
                  <Txt w="extrabold" size={15} style={{ flex: 1 }}>{[r.a.name, r.a.tagVisual && `#${r.a.tagVisual}`].filter(Boolean).join(" · ")}</Txt>
                  <Txt w="extrabold" size={14} color={colors.link}>{`+${num(r.w.dailyGainKg!)} kg/d`}</Txt>
                </View>
              ))}
            </View>
          </Rise>
        ) : null}

        <Rise index={4} style={{ gap: 10 }}>
          <Txt w="extrabold" size={17}>Cada animal</Txt>
          {data && !rows.length ? <Empty title="Sin animales" text="Registra animales para seguir su peso." /> : null}
          {rows.map(({ a, w }) => {
            const late = !w.lastDate || daysBetween(w.lastDate, today) >= WEIGH_EVERY_DAYS;
            return (
              <Tap key={a.id} accessibilityRole="button" accessibilityLabel={animalLabel(a)} onPress={() => router.push({ pathname: "/animal/[id]", params: { id: a.id } })} style={s.row}>
                <EarTag code={a.tagVisual} size={34} tone={tagTone(a.sex)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="bold" size={16}>{animalLabel(a)}</Txt>
                  <Txt size={12} color={late ? colors.warn : colors.textMuted}>{w.lastDate ? `Pesado ${shortDate(w.lastDate, today)}${late ? " · toca pesar" : ""}` : "Nunca pesado"}</Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt w="extrabold" size={18}>{w.lastKg ? `${num(w.lastKg)} kg` : "—"}</Txt>
                  {w.dailyGainKg !== undefined ? <Txt w="bold" size={12} color={w.dailyGainKg >= 0 ? colors.link : colors.danger}>{w.dailyGainKg >= 0 ? "▲" : "▼"} {num(Math.abs(w.dailyGainKg), 2)} kg/día</Txt> : null}
                </View>
              </Tap>
            );
          })}
        </Rise>
      </View>
    </ScrollView>
  );
}

function HowTile({ icon, title, sub, white, onPress, label }: { icon: IconName; title: string; sub: string; white?: boolean; onPress?: () => void; label?: string }) {
  const body = (
    <>
      <View style={[s.howIc, { backgroundColor: white ? colors.limaSoft : onPress ? "rgba(255,255,255,0.18)" : colors.lima }]}>
        <Icon name={icon} color={white || !onPress ? colors.selva : colors.onDark} size={20} />
      </View>
      <Txt w="extrabold" size={14} color={white ? colors.text : colors.onDark} style={{ lineHeight: 16 }}>{title}</Txt>
      <Txt w="bold" size={11} color={white ? colors.selva : onPress ? colors.onDarkMuted : colors.signal}>{sub}</Txt>
    </>
  );
  const style = [s.howTile, { backgroundColor: white ? colors.card : "rgba(255,255,255,0.12)" }, !onPress && { opacity: 0.85 }];
  return (
    <View style={{ flex: 1 }}>
      {onPress ? <Tap accessibilityRole="button" accessibilityLabel={label ?? title} onPress={onPress} style={style}>{body}</Tap>
        : <View accessibilityLabel={`${title}: ${sub}`} style={style}>{body}</View>}
    </View>
  );
}

/** Average of the weights recorded in each of the last 6 months, with bar heights scaled to 100 px. */
function monthly(weighings: AnimalEvent[], today: string) {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const out = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 6 + i, 1)).toISOString().slice(0, 7);
    const list = weighings.filter((e) => e.date.startsWith(d)).map((e) => e.weightKg!);
    return { key: d, m: MONTHS[Number(d.slice(5, 7)) - 1]!, kg: list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0 };
  });
  const vals = out.filter((o) => o.kg).map((o) => o.kg);
  const min = vals.length ? Math.min(...vals) * 0.85 : 0, max = vals.length ? Math.max(...vals) : 1;
  return out.map((o) => ({ ...o, h: o.kg ? Math.max(12, Math.round(((o.kg - min) / Math.max(1, max - min)) * 100)) : 6 }));
}

const s = StyleSheet.create({
  main: { paddingTop: 14, paddingHorizontal: 16, gap: 14 },
  lotGroup: { flexDirection: "row", gap: 4, padding: 4, backgroundColor: colors.card, borderRadius: 999, borderWidth: 1, borderColor: colors.outline },
  lotBtn: { height: 40, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 10, ...shadow },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 10, height: 140 },
  bar: { width: "100%", borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  line: { flexDirection: "row", alignItems: "center", minHeight: 36 },
  slow: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.warnSoft },
  how: { backgroundColor: colors.selva, borderRadius: 22, padding: 16, gap: 12 },
  howTile: { gap: 6, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 20, minHeight: 124 },
  howIc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 8, paddingLeft: 10, paddingRight: 14, ...shadow },
});
