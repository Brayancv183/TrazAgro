import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel,
  addDays, colors, fonts, milkByDay, num, radius, reproStatus, shadow, shortDate, todayDay, type MilkRecord,
} from "@trazagro/shared";
import { listAnimals, listFarmEvents, listMilk, recordMilk } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { DateField, splitDay, toDay } from "../ui/DateField";
import { Banner, Button, Card, Chip, EarTag, Field, GreenHeader, Txt } from "../ui/kit";

const SESSION: Record<MilkRecord["session"], string> = { manana: "Mañana", tarde: "Tarde", dia: "Todo el día" };
const liters = (t?: string) => Math.max(0, Number((t ?? "").replace(",", ".")) || 0);
/** Liters input: digits and one decimal comma only. */
const clean = (t: string) => t.replace(/[^\d,.]/g, "").replace(".", ",");

/** Daily milk: liters per cow or the tank total, the last two weeks and the average per cow. */
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
  const perCowAvg = (id: string) => {
    const recs = (data?.milk ?? []).filter((m) => m.animalId === id && m.date > addDays(today, -7));
    const n = new Set(recs.map((m) => m.date)).size;
    return n ? recs.reduce((s, m) => s + m.liters, 0) / n : undefined;
  };
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker="PRODUCCIÓN" title={`${num(days[days.length - 1]?.liters ?? 0)} L hoy`}>
          <Txt w="medium" size={15} color={colors.onDarkMuted}>{`Promedio de la semana: ${num(weekAvg)} L/día`}</Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {saved ? <Banner icon="check" tone="ok" title={saved} /> : null}
          <Card style={{ gap: 10 }}>
            <Txt w="semibold" size={11} color={colors.hoja} style={{ letterSpacing: 2.2 }}>ÚLTIMOS 14 DÍAS</Txt>
            <View style={s.chart} accessibilityLabel={`Litros por día, máximo ${num(max)}`}>
              {days.map((d) => (
                <View key={d.date} style={s.barCol}>
                  <View style={[s.bar, { height: Math.max(2, (d.liters / max) * 110), backgroundColor: d.date === today ? colors.selva : colors.lima }]} />
                  <Txt size={10} color={colors.textMuted}>{Number(d.date.slice(8))}</Txt>
                </View>
              ))}
            </View>
          </Card>

          {open ? (
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Chip label="Por vaca" active={mode === "vaca"} onPress={() => setMode("vaca")} />
                <Chip label="Total del tanque" active={mode === "tanque"} onPress={() => setMode("tanque")} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {(Object.keys(SESSION) as MilkRecord["session"][]).map((k) => <Chip key={k} label={SESSION[k]} active={session === k} onPress={() => setSession(k)} />)}
              </View>
              <DateField label="Fecha" value={date} onChange={setDate} />
              {mode === "tanque" ? (
                <Field label="Litros" value={tank} onChangeText={(t) => setTank(clean(t))} keyboardType="decimal-pad" placeholder="Ej: 85" />
              ) : (
                (data?.cows ?? []).map((c) => (
                  <View key={c.id} style={s.cow}>
                    <EarTag code={c.tagVisual} size={34} />
                    <Txt w="bold" size={15} style={{ flex: 1 }}>{animalLabel(c)}</Txt>
                    <TextInput value={perCow[c.id] ?? ""} onChangeText={(t) => setPerCow({ ...perCow, [c.id]: clean(t) })} keyboardType="decimal-pad"
                      placeholder="L" placeholderTextColor="#9AA39D" accessibilityLabel={`Litros de ${animalLabel(c)}`} style={[s.input, { fontFamily: fonts.bold }]} />
                  </View>
                ))
              )}
              {!day || day > today ? <Txt size={13} color={colors.danger}>Revisa la fecha: no puede ser futura.</Txt> : null}
              <Button label={total > 0 ? `Guardar ${num(total)} litros` : "Escribe los litros"} disabled={!(total > 0) || !day || day > today} onPress={save} />
            </Card>
          ) : canEdit ? (
            <Button icon="milk" label="Anotar ordeño" onPress={() => { setSaved(undefined); setOpen(true); }} />
          ) : null}

          <Txt w="extrabold" size={19} style={{ marginTop: 6 }}>Por vaca · promedio 7 días</Txt>
          {(data?.cows ?? []).map((c) => {
            const avg = perCowAvg(c.id);
            return (
              <View key={c.id} style={s.row}>
                <EarTag code={c.tagVisual} size={34} />
                <Txt w="bold" size={15} style={{ flex: 1 }}>{animalLabel(c)}</Txt>
                <Txt w="extrabold" size={17}>{avg !== undefined ? `${num(avg)} L` : "—"}</Txt>
              </View>
            );
          })}
          {data && !data.cows.length ? <Txt size={14} color={colors.textMuted}>Las vacas aparecen aquí después de su primer parto.</Txt> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  chart: { flexDirection: "row", alignItems: "flex-end", height: 130, gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  bar: { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  cow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { width: 80, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.crema, borderWidth: 1.5, borderColor: colors.line, textAlign: "center", fontSize: 17, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 10, ...shadow },
});
