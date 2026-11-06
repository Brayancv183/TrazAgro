import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel,
  addDays, colors, fonts, milkByDay, num, reproStatus, shadow, shortDate, todayDay, type MilkRecord,
} from "@trazagro/shared";
import { listAnimals, listFarmEvents, listMilk, recordMilk } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { DateField, splitDay, toDay } from "../ui/DateField";
import { Banner, Button, Chip, EarTag, Empty, Field, GreenHeader, Sheet, Txt, tagTone } from "../ui/kit";
import { Rise } from "../ui/motion";
import { Bar, HeaderAction, noOutline, Segmented, SectionLabel } from "../ui/campo/parts";

const SESSION: Record<MilkRecord["session"], string> = { manana: "Mañana", tarde: "Tarde", dia: "Todo el día" };
const liters = (t?: string) => Math.max(0, Number((t ?? "").replace(",", ".")) || 0);
/** Liters input: digits and one decimal comma only. */
const clean = (t: string) => t.replace(/[^\d,.]/g, "").replace(".", ",");

/** Daily milk (same visual language as Pesajes/Salud): liters today, 14-day bars, per-cow average and the milking form. */
export default function LecheScreen() {
  const db = useSQLiteContext();
  const farmId = useFarmId();
  const canEdit = useFarm().can("milk");
  const today = todayDay();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"vaca" | "tanque">("vaca");
  const [session, setSession] = useState<MilkRecord["session"]>("dia");
  const [date, setDate] = useState(splitDay(today));
  const [perCow, setPerCow] = useState<Record<string, string>>({});
  const [tank, setTank] = useState("");
  const [saved, setSaved] = useState<string>();
  const { data, reload } = useDbQuery(async (d) => {
    const [animals, events, milk] = await Promise.all([listAnimals(d, farmId), listFarmEvents(d, farmId), listMilk(d, farmId, addDays(today, -30))]);
    // Cows in milk: have calved at least once and are not dried off for the next calving.
    const cows = animals.filter((a) => {
      if (a.sex !== "hembra") return false;
      const ev = events.filter((e) => e.animalId === a.id);
      if (!ev.some((e) => e.type === "parto")) return false;
      const r = reproStatus(ev, today);
      return !(r.state === "prenada" && r.dried);
    });
    return { cows, milk };
  }, [farmId]);

  const days = milkByDay(data?.milk ?? [], addDays(today, -13), today);
  const max = Math.max(1, ...days.map((d) => d.liters));
  const week = days.slice(-7);
  const weekAvg = week.reduce((n, d) => n + d.liters, 0) / 7;
  const todayL = days[days.length - 1]?.liters ?? 0;
  const perCowAvg = (id: string) => {
    const recs = (data?.milk ?? []).filter((m) => m.animalId === id && m.date > addDays(today, -7));
    const n = new Set(recs.map((m) => m.date)).size;
    return n ? recs.reduce((s, m) => s + m.liters, 0) / n : undefined;
  };
  const cows = (data?.cows ?? []).map((c) => ({ c, avg: perCowAvg(c.id) })).sort((x, y) => (y.avg ?? -1) - (x.avg ?? -1));
  const topAvg = Math.max(1, ...cows.map((x) => x.avg ?? 0));
  const total = mode === "vaca" ? Object.values(perCow).reduce((n, v) => n + liters(v), 0) : liters(tank);
  const day = toDay(date);

  async function save() {
    if (!day || day > today || !(total > 0)) return;
    const entries = mode === "vaca" ? (data?.cows ?? []).map((c) => ({ animalId: c.id, liters: liters(perCow[c.id]) })) : [{ liters: liters(tank) }];
    await recordMilk(db, farmId, day, session, entries);
    setSaved(`Guardados ${num(total)} litros del ${shortDate(day, today)}`);
    setPerCow({});
    setTank("");
    setDate(splitDay(today));
    setOpen(false);
    reload();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <GreenHeader back kicker="PRODUCCIÓN DE LECHE" title={`${num(todayL)} L`} accent="hoy" waveHeight={40}
          right={canEdit ? <HeaderAction label="Anotar" accessibilityLabel="Anotar ordeño" onPress={() => { setSaved(undefined); setOpen(true); }} /> : undefined}>
          <Txt w="semibold" size={14} color={colors.onDarkMuted}>{`Promedio de la semana: ${num(weekAvg)} L/día`}</Txt>
        </GreenHeader>

        <View style={s.main}>
          {saved ? <Banner icon="check" tone="ok" title={saved} /> : null}

          <Rise index={0} style={{ flexDirection: "row", gap: 10 }}>
            <View style={[s.stat, { backgroundColor: colors.selva }]}>
              <Txt w="extrabold" size={24} color={colors.onDark}>{num(todayL)}</Txt>
              <Txt w="bold" size={12} color={colors.onDarkMuted}>litros hoy</Txt>
            </View>
            <View style={[s.stat, { backgroundColor: colors.card }, shadow]}>
              <Txt w="extrabold" size={24}>{num(weekAvg)}</Txt>
              <Txt w="bold" size={12} color={colors.textMuted}>L/día · semana</Txt>
            </View>
            <View style={[s.stat, { backgroundColor: colors.tierraSoft }]}>
              <Txt w="extrabold" size={24} color={colors.tierraDeep}>{data?.cows.length ?? 0}</Txt>
              <Txt w="bold" size={12} color={colors.tierraDeep}>vacas en ordeño</Txt>
            </View>
          </Rise>

          <Rise index={1} style={s.card}>
            <Txt w="bold" size={13} color={colors.textMuted}>Últimos 14 días</Txt>
            <View style={s.chart} accessibilityLabel={`Litros por día, máximo ${num(max)}`}>
              {days.map((d) => (
                <View key={d.date} style={s.barCol}>
                  <View style={[s.bar, { height: Math.max(4, (d.liters / max) * 110), backgroundColor: d.date === today ? colors.link : d.liters ? colors.onDarkMuted : colors.sand }]} />
                  <Txt w="semibold" size={10} color={d.date === today ? colors.text : colors.textMuted}>{Number(d.date.slice(8))}</Txt>
                </View>
              ))}
            </View>
          </Rise>

          <Rise index={2} style={{ gap: 10 }}>
            <SectionLabel>Por vaca · promedio 7 días</SectionLabel>
            {data && !cows.length ? <Empty title="Sin vacas en ordeño" text="Las vacas aparecen aquí después de su primer parto." /> : null}
            {cows.length ? (
              <View style={[s.card, { paddingVertical: 4, gap: 0 }]}>
                {cows.map(({ c, avg }, i) => (
                  <View key={c.id} style={[s.row, i < cows.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" }]}>
                    <EarTag code={c.tagVisual} size={30} tone={tagTone(c.sex)} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Txt w="bold" size={15}>{animalLabel(c)}</Txt>
                      <Bar pct={avg ? (avg / topAvg) * 100 : 0} color={colors.pasto} track={colors.greenSoft} height={6} />
                    </View>
                    <Txt w="extrabold" size={17} style={{ minWidth: 62, textAlign: "right" }}>{avg !== undefined ? `${num(avg)} L` : "—"}</Txt>
                  </View>
                ))}
              </View>
            ) : null}
          </Rise>
        </View>
      </ScrollView>

      <Sheet open={open} onClose={() => setOpen(false)} title="Anotar ordeño">
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12, paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
          <Segmented options={[{ id: "vaca", label: "Por vaca" }, { id: "tanque", label: "Total del tanque" }]} value={mode} onChange={setMode} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(Object.keys(SESSION) as MilkRecord["session"][]).map((k) => <Chip key={k} label={SESSION[k]} active={session === k} onPress={() => setSession(k)} />)}
          </View>
          <DateField label="Fecha" value={date} onChange={setDate} />
          {mode === "tanque" ? (
            <Field label="Litros" value={tank} onChangeText={(t) => setTank(clean(t))} keyboardType="decimal-pad" placeholder="Ej: 85" style={noOutline} />
          ) : (
            (data?.cows ?? []).map((c) => (
              <View key={c.id} style={s.cow}>
                <EarTag code={c.tagVisual} size={30} tone={tagTone(c.sex)} />
                <Txt w="bold" size={15} style={{ flex: 1 }}>{animalLabel(c)}</Txt>
                <View style={s.lBox}>
                  <TextInput value={perCow[c.id] ?? ""} onChangeText={(t) => setPerCow({ ...perCow, [c.id]: clean(t) })} keyboardType="decimal-pad"
                    placeholder="0" placeholderTextColor="#9AA39D" accessibilityLabel={`Litros de ${animalLabel(c)}`} style={[s.input, { fontFamily: fonts.extrabold }, noOutline]} />
                  <Txt w="bold" size={14} color={colors.textMuted}>L</Txt>
                </View>
              </View>
            ))
          )}
          {!day || day > today ? <Txt size={13} color={colors.danger}>Revisa la fecha: no puede ser futura.</Txt> : null}
          <Button label={total > 0 ? `Guardar ${num(total)} litros` : "Escribe los litros"} disabled={!(total > 0) || !day || day > today} onPress={save} />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  main: { paddingTop: 14, paddingHorizontal: 16, gap: 14 },
  stat: { flex: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, gap: 2 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 10, ...shadow },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 130, gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  bar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  cow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.crema, borderRadius: 20, paddingVertical: 6, paddingLeft: 10, paddingRight: 6 },
  lBox: { flexDirection: "row", alignItems: "center", gap: 4, width: 100, height: 48, borderRadius: 24, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.selva, backgroundColor: colors.card },
  input: { flex: 1, minWidth: 0, fontSize: 18, color: colors.text, textAlign: "right", minHeight: 44 },
});
