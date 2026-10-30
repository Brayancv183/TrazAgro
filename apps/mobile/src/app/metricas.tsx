import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { addDays, colors, herdMetrics, money, num, radius, shadow, todayDay, type Category } from "@trazagro/shared";
import { listMilk, loadFarmBundle } from "../db/repo";
import { useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Card, Chip, GreenHeader, Txt } from "../ui/kit";

const CATEGORY: Record<Category, string> = { vaca: "Vacas", novilla: "Novillas", ternera: "Terneras", toro: "Toros", novillo: "Novillos", ternero: "Terneros" };

/** Herd and money indicators for the last 3, 6 or 12 months. */
export default function MetricasScreen() {
  const farmId = useFarmId();
  const today = todayDay();
  const [months, setMonths] = useState(12);
  const { data } = useDbQuery(async (d) => ({ ...(await loadFarmBundle(d, farmId)), milk: await listMilk(d, farmId, addDays(todayDay(), -400)) }), [farmId]);
  const m = data ? herdMetrics(data.animals, data.events, data.movements, data.milk, today, months) : undefined;
  const net = m ? m.income - m.expenses : 0;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker={`ÚLTIMOS ${months} MESES`} title="Métricas">
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {[3, 6, 12].map((n) => <Chip key={n} label={`${n} meses`} active={months === n} onPress={() => setMonths(n)}
            tone={months === n ? { bg: colors.lima, fg: colors.selva } : { bg: "rgba(255,255,255,0.14)", fg: colors.onDark }} />)}
        </View>
      </GreenHeader>
      {m ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Txt w="extrabold" size={19}>Rentabilidad</Txt>
          <View style={s.grid}>
            <Kpi label="Ingresos" value={money(m.income)} />
            <Kpi label="Gastos" value={money(m.expenses)} />
            <Kpi label="Utilidad" value={money(net)} tone={net >= 0 ? colors.selva : colors.danger} />
            <Kpi label="Por animal al mes" value={m.netPerAnimalMonth !== undefined ? money(m.netPerAnimalMonth) : "—"} tone={(m.netPerAnimalMonth ?? 0) >= 0 ? colors.selva : colors.danger} />
            {m.milkLiters ? <Kpi label="Leche producida" value={`${num(m.milkLiters, 0)} L`} /> : null}
            {m.milkLiters && m.expenses ? <Kpi label="Costo por litro" value={money(Math.round(m.expenses / m.milkLiters))} /> : null}
          </View>

          <Txt w="extrabold" size={19} style={{ marginTop: 6 }}>Hato</Txt>
          <View style={s.grid}>
            <Kpi label="Natalidad" value={m.birthRate !== undefined ? `${m.birthRate}%` : "—"} sub={`${m.births} partos`} />
            <Kpi label="Mortalidad" value={m.mortality !== undefined ? `${num(m.mortality)}%` : "—"} sub={`${m.deaths} muertes`} tone={m.deaths ? colors.danger : undefined} />
            <Kpi label="Ganancia de peso" value={m.avgDailyGain !== undefined ? `${num(m.avgDailyGain, 2)} kg/día` : "—"} sub="promedio del hato" />
            <Kpi label="Entre partos" value={m.calvingInterval !== undefined ? `${m.calvingInterval} días` : "—"} sub="meta: 365–400" />
          </View>

          <Card style={{ gap: 8 }}>
            <Txt w="semibold" size={11} color={colors.hoja} style={{ letterSpacing: 2.2 }}>INVENTARIO POR CATEGORÍA · {m.active}</Txt>
            {(Object.keys(CATEGORY) as Category[]).filter((c) => m.byCategory[c]).map((c) => (
              <View key={c} style={s.line}>
                <Txt size={15} style={{ width: 90 }}>{CATEGORY[c]}</Txt>
                <View style={s.track}><View style={[s.fill, { width: `${(m.byCategory[c]! / Math.max(1, m.active)) * 100}%` }]} /></View>
                <Txt w="bold" size={15} style={{ width: 28, textAlign: "right" }}>{m.byCategory[c]}</Txt>
              </View>
            ))}
          </Card>
          <Txt size={12} color={colors.textMuted}>Natalidad: partos sobre hembras de más de 2 años. Mortalidad: muertes y pérdidas sobre el total del hato.</Txt>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <View style={s.kpi}>
      <Txt size={13} color={colors.textMuted}>{label}</Txt>
      <Txt w="extrabold" size={19} color={tone ?? colors.text}>{value}</Txt>
      {sub ? <Txt size={12} color={colors.textMuted}>{sub}</Txt> : null}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 2, ...shadow },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.limaSoft, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.selva },
});
