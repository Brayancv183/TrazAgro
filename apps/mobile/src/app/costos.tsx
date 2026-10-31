import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  colors, EXPENSE_CATEGORIES, INCOME_CATEGORIES, money, monthName, monthSummary, radius, shiftMonth, shortDate, todayDay,
  type MovementKind,
} from "@trazagro/shared";
import { createMovement, getFarm, listMovements } from "../db/repo";
import { useFarmId } from "../lib/farm";
import { RequireWrite } from "../ui/NoPermission";
import { useDbQuery } from "../lib/useDb";
import { DateField, splitDay, toDay } from "../ui/DateField";
import { Icon } from "../ui/Icon";
import { Banner, Button, Card, Chip, Empty, Field, GreenHeader, Txt } from "../ui/kit";

function CostosScreen() {
  const { farmId: farmParam } = useLocalSearchParams<{ farmId?: string }>();
  const farmId = useFarmId(farmParam);
  const db = useSQLiteContext();
  const today = todayDay();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [form, setForm] = useState<MovementKind>();
  const { data, reload } = useDbQuery(async (d) => ({ farm: await getFarm(d, farmId), movements: await listMovements(d, farmId) }), [farmId]);

  const sum = monthSummary(data?.movements ?? [], month);
  const maxCat = Math.max(1, ...sum.byCategory.map((c) => c.amount));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker={`UTILIDAD · ${monthName(month).toUpperCase()}`} title={money(sum.profit)}>
          <View style={s.months}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => setMonth(shiftMonth(month, -1))} style={s.monthBtn}>
              <Icon name="back" color={colors.onDark} size={18} />
            </Pressable>
            <Txt w="semibold" size={15} color={colors.onDark} style={{ flex: 1, textAlign: "center" }}>{data?.farm?.name ?? ""}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" disabled={month >= today.slice(0, 7)}
              onPress={() => setMonth(shiftMonth(month, 1))} style={[s.monthBtn, month >= today.slice(0, 7) && { opacity: 0.35 }]}>
              <Icon name="chevron" color={colors.onDark} size={18} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <Total label="Ingresos" value={sum.income} />
            <Total label="Gastos" value={sum.expense} />
          </View>
        </GreenHeader>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button kind={form === "gasto" ? "primary" : "soft"} label="Gasto" icon="plus" onPress={() => setForm(form === "gasto" ? undefined : "gasto")} style={{ flex: 1 }} />
            <Button kind={form === "ingreso" ? "primary" : "soft"} label="Ingreso" icon="plus" onPress={() => setForm(form === "ingreso" ? undefined : "ingreso")} style={{ flex: 1 }} />
          </View>
          {form ? <MovementForm key={form} kind={form} onSave={async (input) => {
            await createMovement(db, { farmId, kind: form, ...input });
            setForm(undefined);
            setMonth(input.date.slice(0, 7));
            reload();
          }} /> : null}

          <Txt w="extrabold" size={20}>¿En qué se va la plata?</Txt>
          {!sum.byCategory.length ? <Empty title="Sin movimientos este mes" text="Anota un gasto o un ingreso. Las ventas y compras de animales se anotan solas." /> : (
            <Card style={{ gap: 12 }}>
              {sum.byCategory.map((c) => (
                <View key={`${c.kind}:${c.category}`} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Txt w="semibold" size={15}>{c.category}</Txt>
                    <Txt w="bold" size={15} color={c.kind === "ingreso" ? colors.hoja : colors.text}>{c.kind === "ingreso" ? "+" : ""}{money(c.amount)}</Txt>
                  </View>
                  <View style={s.track}><View style={[s.fill, { width: `${(c.amount / maxCat) * 100}%`, backgroundColor: c.kind === "ingreso" ? colors.pasto : colors.tierra }]} /></View>
                </View>
              ))}
            </Card>
          )}

          {sum.movements.length ? (
            <>
              <Txt w="extrabold" size={20}>Movimientos</Txt>
              <Card style={{ paddingVertical: 4 }}>
                {sum.movements.map((m, i) => (
                  <View key={m.id} style={[s.mov, i < sum.movements.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                    <View style={{ flex: 1 }}>
                      <Txt w="bold" size={15}>{m.description || m.category}</Txt>
                      <Txt size={13} color={colors.textMuted}>{m.category} · {shortDate(m.date, today)}</Txt>
                    </View>
                    <Txt w="extrabold" size={15} color={m.kind === "ingreso" ? colors.hoja : colors.danger}>{m.kind === "ingreso" ? "+" : "−"}{money(m.amount)}</Txt>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.total}>
      <Txt size={13} color={colors.onDarkMuted}>{label}</Txt>
      <Txt w="extrabold" size={18} color={colors.onDark}>{money(value)}</Txt>
    </View>
  );
}

function MovementForm({ kind, onSave }: { kind: MovementKind; onSave: (m: { category: string; amount: number; date: string; description: string }) => Promise<void> }) {
  const cats = kind === "gasto" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const [category, setCategory] = useState(cats[0]!);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(splitDay(todayDay()));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();

  async function save() {
    const value = Number(amount.replace(/\D/g, ""));
    const day = toDay(date);
    if (!(value > 0)) return setError("Escribe el valor.");
    if (!day || day > todayDay()) return setError("Revisa la fecha.");
    await onSave({ category, amount: value, date: day, description: description.trim() });
  }

  return (
    <Card style={{ gap: 12 }}>
      <Txt w="bold" size={17}>{kind === "gasto" ? "Nuevo gasto" : "Nuevo ingreso"}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {cats.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
      </View>
      <Field label="Valor" value={amount} onChangeText={(t) => { setError(undefined); setAmount(t.replace(/\D/g, "")); }} keyboardType="number-pad" placeholder="Ej: 320000" />
      {Number(amount) > 0 ? <Txt size={13} color={colors.textMuted}>{money(Number(amount))}</Txt> : null}
      <Field label="Detalle (opcional)" value={description} onChangeText={setDescription} placeholder={kind === "gasto" ? "Ej: Sal mineralizada, 4 bultos" : "Ej: Leche de la quincena"} />
      <DateField label="Fecha" value={date} onChange={(v) => { setError(undefined); setDate(v); }} />
      <Banner icon="note" tone="ok" title="Foto del recibo: muy pronto" text="Por ahora escribe el valor a mano." />
      {error ? <Banner icon="note" tone="danger" title={error} /> : null}
      <Button label={kind === "gasto" ? "Guardar gasto" : "Guardar ingreso"} onPress={save} />
    </Card>
  );
}

const s = StyleSheet.create({
  months: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  total: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.md, padding: 12 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.tint, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  mov: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
});

// The farm's books are only for the owner and administrators.
export default function Screen() {
  return <RequireWrite table="movements"><CostosScreen /></RequireWrite>;
}
