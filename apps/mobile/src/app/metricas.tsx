import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { addDays, colors, herdMetrics, money, num, shadow, todayDay, type Category } from "@trazagro/shared";
import { listMilk, loadFarmBundle } from "../db/repo";
import { useFarmId } from "../lib/farm";
import { RequireWrite } from "../ui/NoPermission";
import { useDbQuery } from "../lib/useDb";
import { GreenHeader, Txt } from "../ui/kit";
import { Rise } from "../ui/motion";
import { HeaderAction, Segmented } from "../ui/finca/parts";

const CATEGORY: { id: Category; label: string; color: string }[] = [
  { id: "vaca", label: "Vacas", color: colors.selva },
  { id: "novilla", label: "Novillas", color: "#66BB6A" },
  { id: "ternera", label: "Terneras", color: "#A5D6A7" },
  { id: "ternero", label: "Terneros", color: "#BCAAA4" },
  { id: "novillo", label: "Novillos", color: colors.tierra },
  { id: "toro", label: "Toros", color: colors.text },
];

/** Metricas.dc (composition + indicators) and Rentabilidad.dc (money) for the last 3, 6 or 12 months. */
function MetricasScreen() {
  const router = useRouter();
  const farmId = useFarmId();
  const today = todayDay();
  const [months, setMonths] = useState<"3" | "6" | "12">("12");
  const { data } = useDbQuery(async (d) => ({ ...(await loadFarmBundle(d, farmId)), milk: await listMilk(d, farmId, addDays(todayDay(), -400)) }), [farmId]);
  const m = data ? herdMetrics(data.animals, data.events, data.movements, data.milk, today, Number(months)) : undefined;
  const net = m ? m.income - m.expenses : 0;
  const comp = m ? CATEGORY.filter((c) => m.byCategory[c.id]) : [];
  const ratio = m && m.income ? m.expenses / m.income : undefined;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back waveHeight={40} kicker={`ÚLTIMOS ${months} MESES`} title="Métricas del hato"
        right={<HeaderAction icon="report" label="Reporte" onPress={() => router.push("/reportes")} />}>
        <Segmented variant="glass" style={{ marginTop: 10 }} value={months} onChange={setMonths}
          options={(["3", "6", "12"] as const).map((n) => ({ id: n, label: `${n} meses` }))} />
      </GreenHeader>
      {m ? (
        <View style={s.main}>
          <Rise index={0}>
            <View style={s.card}>
              <View style={s.between}>
                <Txt w="extrabold" size={16}>Composición</Txt>
                <Txt w="extrabold" size={14}>{`${m.active} ${m.active === 1 ? "animal" : "animales"}`}</Txt>
              </View>
              <View style={s.stack}>
                {comp.map((c) => <View key={c.id} style={{ flex: m.byCategory[c.id]!, backgroundColor: c.color }} />)}
              </View>
              <View style={s.legend}>
                {comp.map((c) => (
                  <View key={c.id} style={s.legendItem}>
                    <View style={[s.dot, { backgroundColor: c.color }]} />
                    <Txt w="semibold" size={13} style={{ flex: 1 }}>{c.label}</Txt>
                    <Txt w="extrabold" size={13}>{m.byCategory[c.id]}</Txt>
                  </View>
                ))}
              </View>
            </View>
          </Rise>

          <Rise index={1} style={s.grid}>
            <Kpi label="Natalidad" value={m.birthRate !== undefined ? `${m.birthRate} %` : "—"} sub={`${m.births} ${m.births === 1 ? "parto" : "partos"}`} />
            <Kpi label="Mortalidad" value={m.mortality !== undefined ? `${num(m.mortality)} %` : "—"} sub={`${m.deaths} ${m.deaths === 1 ? "muerte" : "muertes"}`} tone={m.deaths ? colors.danger : undefined} />
            <Kpi label="Intervalo entre partos" value={m.calvingInterval !== undefined ? `${m.calvingInterval} días` : "—"} sub="meta: 365–400" />
            <Kpi label="Ganancia de peso" value={m.avgDailyGain !== undefined ? `${num(m.avgDailyGain, 2)} kg/día` : "—"} sub="promedio del hato" />
            <Kpi label="Leche producida" value={m.milkLiters ? `${num(m.milkLiters, 0)} L` : "—"} sub={m.milkLiters ? `en ${months} meses` : "sin leche anotada"} />
            <Kpi label="Utilidad por animal" value={m.netPerAnimalMonth !== undefined ? money(m.netPerAnimalMonth) : "—"} sub="al mes"
              tone={(m.netPerAnimalMonth ?? 0) < 0 ? colors.danger : undefined} />
          </Rise>

          <Rise index={2} style={{ gap: 10 }}>
            <Txt w="extrabold" size={20}>Rentabilidad</Txt>
            <View style={s.card}>
              <View style={s.between}>
                <Txt w="extrabold" size={16}>Utilidad del periodo</Txt>
                <View style={[s.gain, { backgroundColor: net >= 0 ? colors.limaSoft : colors.dangerSoft }]}>
                  <Txt w="extrabold" size={14} color={net >= 0 ? colors.selva : colors.danger}>{`${net >= 0 ? "+" : "−"}${money(Math.abs(net))}`}</Txt>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                <Txt w="extrabold" size={24}>{money(m.expenses)}</Txt>
                <Txt size={14} color={colors.textMuted}>{`gastados de ${money(m.income)}`}</Txt>
              </View>
              {ratio !== undefined ? (
                <>
                  <View accessibilityRole="progressbar" accessibilityLabel="Gastos sobre ingresos" style={s.track}>
                    <View style={[s.fill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: ratio > 1 ? colors.urgent : ratio > 0.85 ? colors.warn : colors.link }]} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[s.dotSm, { backgroundColor: ratio > 1 ? colors.urgent : colors.link }]} />
                    <Txt w="semibold" size={13} color={ratio > 1 ? colors.urgentText : colors.selva} style={{ flex: 1 }}>
                      {ratio > 1 ? `Los gastos superan los ingresos en ${Math.round((ratio - 1) * 100)} %` : `Los gastos son el ${Math.round(ratio * 100)} % de los ingresos`}
                    </Txt>
                  </View>
                </>
              ) : <Txt size={13} color={colors.textMuted}>Todavía no hay ingresos anotados en el periodo.</Txt>}
            </View>
            <View style={s.listCard}>
              <Row label="Costo por animal" sub="gastos del periodo al mes" value={m.active && m.expenses ? money(Math.round(m.expenses / m.active / Number(months))) : "—"} />
              <Row label="Costo por litro" sub={m.milkLiters ? `${num(m.milkLiters, 0)} L producidos` : "sin leche anotada"} value={m.milkLiters && m.expenses ? money(Math.round(m.expenses / m.milkLiters)) : "—"} last />
            </View>
          </Rise>
          <Txt size={12} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 18 }}>
            Natalidad: partos sobre hembras de más de 2 años. Mortalidad: muertes y pérdidas sobre el total del hato.
          </Txt>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <View style={s.kpiCell}>
      <View style={s.kpi}>
        <Txt w="bold" size={12} color={colors.textMuted}>{label}</Txt>
        <Txt w="extrabold" size={22} color={tone ?? colors.text} style={{ letterSpacing: -0.22 }} numberOfLines={1}>{value}</Txt>
        {sub ? <Txt w="bold" size={12} color={colors.textMuted}>{sub}</Txt> : null}
      </View>
    </View>
  );
}

function Row({ label, sub, value, last }: { label: string; sub: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" }]}>
      <View style={{ flex: 1 }}>
        <Txt w="bold" size={14}>{label}</Txt>
        <Txt size={12} color={colors.textMuted}>{sub}</Txt>
      </View>
      <Txt w="extrabold" size={16}>{value}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  main: { paddingTop: 14, paddingHorizontal: 16, gap: 14 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 12, ...shadow },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stack: { flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", gap: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 12 },
  legendItem: { width: "46%", flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSm: { width: 8, height: 8, borderRadius: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCell: { width: "48.5%" },
  kpi: { backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 4, ...shadow },
  gain: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  track: { height: 12, borderRadius: 6, backgroundColor: "#EEF2E8", overflow: "hidden" },
  fill: { height: 12, borderRadius: 6 },
  listCard: { backgroundColor: colors.card, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
});

// The farm's books are only for the owner and administrators.
export default function Screen() {
  return <RequireWrite table="movements"><MetricasScreen /></RequireWrite>;
}
