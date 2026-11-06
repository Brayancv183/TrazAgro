import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors, EXPENSE_CATEGORIES, fonts, INCOME_CATEGORIES, money, monthName, plural, shadow, shiftMonth, shortDate, todayDay,
  type MovementKind,
} from "@trazagro/shared";
import { periodRange, periodSummary, type CatGroup, type Period } from "../db/finca";
import { createMovement, getFarm, listAnimals, listMilk, listMovements } from "../db/repo";
import { useFarmId } from "../lib/farm";
import { RequireWrite } from "../ui/NoPermission";
import { useDbQuery } from "../lib/useDb";
import { DateField, splitDay, toDay } from "../ui/DateField";
import { Icon } from "../ui/Icon";
import { Button, Empty, HeaderButton, Kicker, Sheet, Txt, Wave } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { Segmented } from "../ui/finca/parts";

const PALETTE = [colors.link, colors.tierra, "#1976D2", colors.rosa, colors.warn, "#B0A898"];
const PERIOD_NAME: Record<Period, string> = { mes: "Mes", tri: "Trim.", ano: "Año" };

/** Costos.dc + SheetMovimiento.dc: profit of the period, breakdown by category → movements, and the new-movement sheet. */
function CostosScreen() {
  const { farmId: farmParam } = useLocalSearchParams<{ farmId?: string }>();
  const farmId = useFarmId(farmParam);
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = todayDay();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [period, setPeriod] = useState<Period>("mes");
  const [kind, setKind] = useState<"gastos" | "ingresos">("gastos");
  const [open, setOpen] = useState<string>();
  const [form, setForm] = useState<MovementKind>();
  const [saved, setSaved] = useState<{ kind: MovementKind; amount: number; category: string }>();
  const { data, reload } = useDbQuery(async (d) => ({
    farm: await getFarm(d, farmId), movements: await listMovements(d, farmId), animals: await listAnimals(d, farmId), milk: await listMilk(d, farmId, "0000"),
  }), [farmId]);

  const { from, to } = periodRange(period, month);
  const sum = periodSummary(data?.movements ?? [], from, to);
  const groups = kind === "gastos" ? sum.gastos : sum.ingresos;
  const total = kind === "gastos" ? sum.expense : sum.income;
  const cat = groups.find((g) => g.category === open);
  const months = period === "mes" ? 1 : period === "tri" ? 3 : 12;
  const active = (data?.animals ?? []).filter((a) => a.status === "activo").length;
  const liters = (data?.milk ?? []).filter((m) => m.date >= from && m.date <= to).reduce((n, m) => n + m.liters, 0);
  const isCurrent = month >= today.slice(0, 7);
  const label = period === "mes" ? monthName(month) : period === "tri" ? `${monthName(shiftMonth(month, -2)).split(" ")[0]} – ${monthName(month)}` : isCurrent ? "últimos 12 meses" : `12 meses a ${monthName(month)}`;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View style={s.headerTop}>
            <HeaderButton icon="back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
            <Segmented variant="glass" height={38} style={{ width: 200 }} value={period} onChange={(p) => { setPeriod(p); setOpen(undefined); }}
              options={(Object.keys(PERIOD_NAME) as Period[]).map((p) => ({ id: p, label: PERIOD_NAME[p] }))} />
          </View>
          <View style={{ gap: 4 }}>
            <View style={s.kickerRow}>
              <View style={{ flex: 1 }}><Kicker>{`UTILIDAD · ${label.toUpperCase()}`}</Kicker></View>
              <Tap accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => setMonth(shiftMonth(month, -1))} style={s.monthBtn}>
                <Icon name="back" color={colors.onDark} size={16} />
              </Tap>
              <Tap accessibilityRole="button" accessibilityLabel="Mes siguiente" disabled={isCurrent} onPress={() => setMonth(shiftMonth(month, 1))} style={s.monthBtn}>
                <Icon name="chevron" color={colors.onDark} size={16} />
              </Tap>
            </View>
            <Txt w="extrabold" size={38} color={sum.profit < 0 ? "#FFCDD2" : colors.onDark} style={{ letterSpacing: -0.76, lineHeight: 42 }}>{money(sum.profit)}</Txt>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Total label="Ingresos" value={sum.income} />
            <Total label="Gastos" value={sum.expense} />
          </View>
        </View>
        <Wave height={40} />

        <View style={s.main}>
          <Rise index={0} style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Tap accessibilityRole="button" accessibilityLabel="Gasto" onPress={() => { setSaved(undefined); setForm("gasto"); }} style={[s.newBtn, { backgroundColor: colors.dangerSoft }]}>
                <Icon name="minus" color={colors.urgentText} size={18} width={2.6} />
                <Txt w="bold" size={15} color={colors.urgentText}>Gasto</Txt>
              </Tap>
            </View>
            <View style={{ flex: 1 }}>
              <Tap accessibilityRole="button" accessibilityLabel="Ingreso" onPress={() => { setSaved(undefined); setForm("ingreso"); }} style={[s.newBtn, { backgroundColor: colors.limaSoft }]}>
                <Icon name="plus" color={colors.selva} size={18} width={2.6} />
                <Txt w="bold" size={15} color={colors.selva}>Ingreso</Txt>
              </Tap>
            </View>
          </Rise>

          <Rise index={1}>
            <View style={s.card}>
              <View style={s.cardHead}>
                <Txt w="extrabold" size={16} style={{ flex: 1, lineHeight: 19 }} numberOfLines={2}>
                  {cat ? cat.category : kind === "gastos" ? "¿En qué se va la plata?" : "¿De dónde entra la plata?"}
                </Txt>
                <Segmented variant="tint" height={34} style={{ width: 156 }} value={kind} onChange={(k) => { setKind(k); setOpen(undefined); }}
                  options={[{ id: "gastos", label: "Gastos" }, { id: "ingresos", label: "Ingresos" }]} />
              </View>
              {cat ? (
                <View style={s.crumbs}>
                  <Tap accessibilityRole="button" accessibilityLabel="Todo" onPress={() => setOpen(undefined)} style={[s.crumb, { backgroundColor: colors.tint }]}>
                    <Txt w="bold" size={13} color={colors.selva}>Todo</Txt>
                  </Tap>
                  <Txt size={13} color="#A0A8A2">›</Txt>
                  <View style={[s.crumb, { backgroundColor: colors.selva }]}><Txt w="bold" size={13} color={colors.onDark}>{cat.category}</Txt></View>
                </View>
              ) : null}

              {!groups.length ? (
                <Empty title="Sin movimientos" text="Anota un gasto o un ingreso. Las ventas y compras de animales se anotan solas." />
              ) : cat ? (
                <Breakdown color={PALETTE[groups.indexOf(cat) % PALETTE.length]!} rows={cat.items.map((m) => ({
                  key: m.id, name: m.description || m.category, sub: shortDate(m.date, today), amount: m.amount, sign: m.kind === "ingreso" ? "+" : "−",
                }))} total={cat.amount} />
              ) : (
                <Breakdown rows={groups.map((g: CatGroup, i) => ({
                  key: g.category, name: g.category, sub: `${total ? Math.round((g.amount / total) * 100) : 0} % · ${plural(g.items.length, "movimiento", "movimientos")}`,
                  amount: g.amount, color: PALETTE[i % PALETTE.length], onPress: () => setOpen(g.category),
                }))} total={total} />
              )}
              {groups.length ? (
                <Txt size={12} color={colors.textMuted} style={{ textAlign: "center" }}>
                  {cat ? "Cada movimiento con su fecha y detalle" : "Toca una categoría para ver cada movimiento"}
                </Txt>
              ) : null}
            </View>
          </Rise>

          <Rise index={2}>
            <Tap accessibilityRole="link" accessibilityLabel="Rentabilidad y métricas" onPress={() => router.push("/metricas")} style={s.rent}>
              <View style={s.rentIcon}><Icon name="chart" color={colors.selva} size={22} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="extrabold" size={15} color={colors.onDark}>Rentabilidad y métricas</Txt>
                <Txt size={12} color={colors.onDarkMuted}>Natalidad, ganancia de peso y utilidad por animal</Txt>
              </View>
              <Icon name="chevron" color={colors.lima} size={20} />
            </Tap>
          </Rise>

          <Rise index={3} style={{ flexDirection: "row", gap: 10 }}>
            <Mini label="Costo por animal" value={active && sum.expense ? money(Math.round(sum.expense / active / months)) : "—"} sub="al mes" />
            <Mini label="Costo por litro" value={liters && sum.expense ? money(Math.round(sum.expense / liters)) : "—"} sub={liters ? "promedio" : "sin leche anotada"} />
          </Rise>
        </View>
      </ScrollView>

      <Sheet open={!!form} onClose={() => setForm(undefined)} title={saved ? "" : "Nuevo movimiento"}>
        {saved ? (
          <View accessibilityRole="summary" style={{ alignItems: "center", gap: 10, paddingVertical: 4 }}>
            <View style={s.doneIcon}><Icon name="check" color={colors.selva} size={36} width={2.6} /></View>
            <Txt w="extrabold" size={24}>{saved.kind === "gasto" ? "Gasto guardado" : "Ingreso guardado"}</Txt>
            <Txt size={14} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 21 }}>{`${money(saved.amount)} en ${saved.category}. Ya aparece en el desglose de Costos.`}</Txt>
            <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 6 }}>
              <View style={{ flex: 1 }}><Button kind="soft" label="Otro" onPress={() => setSaved(undefined)} /></View>
              <View style={{ flex: 1.4 }}><Button label="Ver en Costos" onPress={() => setForm(undefined)} /></View>
            </View>
          </View>
        ) : form ? (
          <MovementForm key={form} kind={form} onKind={setForm} onSave={async (input) => {
            await createMovement(db, { farmId, kind: form, ...input });
            setMonth(input.date.slice(0, 7));
            setKind(form === "gasto" ? "gastos" : "ingresos");
            setOpen(undefined);
            setSaved({ kind: form, amount: input.amount, category: input.category });
            reload();
          }} />
        ) : null}
      </Sheet>
    </View>
  );
}

function Breakdown({ rows, total, color }: { rows: { key: string; name: string; sub: string; amount: number; color?: string; sign?: string; onPress?: () => void }[]; total: number; color?: string }) {
  const tone = (r: { color?: string }, i: number) => ({ backgroundColor: r.color ?? color, opacity: Math.max(0.35, 1 - i * 0.15) });
  return (
    <>
      <View style={s.stack}>
        {rows.map((r, i) => <View key={r.key} style={[{ flex: total ? Math.max(r.amount / total, 0.01) : 1 }, tone(r, i)]} />)}
      </View>
      <View>
        {rows.map((r, i) => {
          const body = (
            <>
              <View style={[s.dot, tone(r, i)]} />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt w="semibold" size={15} numberOfLines={1}>{r.name}</Txt>
                <Txt size={12} color={colors.textMuted}>{r.sub}</Txt>
              </View>
              <Txt w="extrabold" size={15}>{`${r.sign ?? ""}${money(r.amount)}`}</Txt>
              {r.onPress ? <Icon name="chevron" color="#A0A8A2" size={18} /> : null}
            </>
          );
          const style = [s.row, i < rows.length - 1 && s.rowLine];
          return r.onPress
            ? <Tap key={r.key} accessibilityRole="button" accessibilityLabel={`${r.name}: ${money(r.amount)}`} onPress={r.onPress} style={style}>{body}</Tap>
            : <View key={r.key} style={style}>{body}</View>;
        })}
      </View>
    </>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.total}>
      <Txt size={12} color={colors.onDarkMuted}>{label}</Txt>
      <Txt w="extrabold" size={17} color={colors.onDark}>{money(value)}</Txt>
    </View>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={s.mini}>
      <Txt size={12} color={colors.textMuted}>{label}</Txt>
      <Txt w="extrabold" size={18}>{value}</Txt>
      <Txt size={11} color={colors.textMuted}>{sub}</Txt>
    </View>
  );
}

function MovementForm({ kind, onKind, onSave }: { kind: MovementKind; onKind: (k: MovementKind) => void; onSave: (m: { category: string; amount: number; date: string; description: string }) => Promise<void> }) {
  const cats = kind === "gasto" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const [category, setCategory] = useState(cats[0]!);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(splitDay(todayDay()));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const accent = kind === "gasto" ? colors.danger : colors.selva;

  async function save() {
    const value = Number(amount.replace(/\D/g, ""));
    const day = toDay(date);
    if (!(value > 0)) return setError("Escribe el valor.");
    if (!day || day > todayDay()) return setError("Revisa la fecha.");
    await onSave({ category, amount: value, date: day, description: description.trim() });
  }

  return (
    <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
      <Segmented variant="tint" height={36} fontSize={14} pillColor={accent} value={kind} onChange={onKind}
        options={[{ id: "gasto", label: "Gasto" }, { id: "ingreso", label: "Ingreso" }]} />
      <View style={s.amount}>
        <Txt w="extrabold" size={26} color={colors.textMuted}>$</Txt>
        <TextInput value={amount.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} onChangeText={(t) => { setError(undefined); setAmount(t.replace(/\D/g, "")); }}
          keyboardType="number-pad" placeholder="Ej: 320000" placeholderTextColor="#9AA39D" accessibilityLabel="Valor"
          style={[s.amountInput, { fontFamily: fonts.extrabold }]} />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Categoría" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {cats.map((c) => {
          const on = category === c;
          return (
            <Tap key={c} accessibilityRole="radio" accessibilityLabel={c} accessibilityState={{ selected: on, checked: on }} aria-checked={on}
              onPress={() => setCategory(c)} style={[s.cat, on ? { backgroundColor: accent, borderColor: accent } : null]}>
              <Txt w="semibold" size={14} color={on ? colors.onDark : colors.text}>{c}</Txt>
            </Tap>
          );
        })}
      </View>
      <TextInput value={description} onChangeText={setDescription} accessibilityLabel="Detalle (opcional)" placeholderTextColor="#9AA39D"
        placeholder={kind === "gasto" ? "Ej: Sal mineralizada, 4 bultos" : "Ej: Leche de la quincena"} style={[s.detail, { fontFamily: fonts.regular }]} />
      <DateField label="Fecha" value={date} onChange={(v) => { setError(undefined); setDate(v); }} />
      <View style={s.photo} accessibilityLabel="Foto del recibo: muy pronto">
        <Icon name="camera" color={colors.selva} size={22} />
        <View style={{ flex: 1 }}>
          <Txt w="bold" size={14} color={colors.selva}>Foto del recibo: muy pronto</Txt>
          <Txt size={12} color={colors.textMuted}>Por ahora escribe el valor a mano.</Txt>
        </View>
      </View>
      {error ? <Txt w="semibold" size={14} color={colors.danger}>{error}</Txt> : null}
      <Button kind={kind === "gasto" ? "danger" : "primary"} label={kind === "gasto" ? "Guardar gasto" : "Guardar ingreso"} onPress={save} style={{ backgroundColor: accent }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6, gap: 12 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.glassLine, alignItems: "center", justifyContent: "center" },
  total: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 },
  main: { paddingHorizontal: 16, gap: 12 },
  newBtn: { height: 54, borderRadius: 27, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16, gap: 12, ...shadow },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  crumbs: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  crumb: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center" },
  stack: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 6 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rent: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.selva },
  rentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
  mini: { flex: 1, backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 2, ...shadow },
  amount: { flexDirection: "row", alignItems: "center", gap: 6, height: 64, paddingHorizontal: 20, borderRadius: 32, backgroundColor: colors.crema },
  amountInput: { flex: 1, minWidth: 0, fontSize: 28, color: colors.text },
  cat: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, justifyContent: "center" },
  detail: { height: 50, paddingHorizontal: 18, borderRadius: 25, backgroundColor: colors.crema, fontSize: 15, color: colors.text },
  photo: { minHeight: 60, borderRadius: 22, borderWidth: 2, borderStyle: "dashed", borderColor: "#C5D4B8", backgroundColor: "#F6FBF3", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
});

// The farm's books are only for the owner and administrators.
export default function Screen() {
  return <RequireWrite table="movements"><CostosScreen /></RequireWrite>;
}
