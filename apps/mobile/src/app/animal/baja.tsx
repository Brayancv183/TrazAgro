import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { colors, exitCheck, money, radius, shortDate, todayDay, withdrawalFor, type ExitPurpose } from "@trazagro/shared";
import { getAnimal, listEvents, listProducts, recordExit, transferAnimal, type ExitReason } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { useDbQuery } from "../../lib/useDb";
import { DateField, splitDay, toDay } from "../../ui/DateField";
import { Icon } from "../../ui/Icon";
import { Banner, Button, Chip, Field, GreenHeader, Txt } from "../../ui/kit";

type Reason = ExitReason | "traslado";

const REASONS: { id: Reason; label: string; purpose?: ExitPurpose }[] = [
  { id: "venta_cria", label: "Se vendió para cría o leche", purpose: "venta_cria" },
  { id: "venta_carne", label: "Se vendió para carne", purpose: "venta_carne" },
  { id: "sacrificio", label: "Sacrificio", purpose: "sacrificio" },
  { id: "murio", label: "Murió" },
  { id: "perdido", label: "Perdido o robado" },
  { id: "traslado", label: "Pasó a otra de mis fincas", purpose: "venta_cria" },
];

export default function BajaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const today = todayDay();
  const { farms, refresh } = useFarm();
  const [reason, setReason] = useState<Reason>();
  const [toFarm, setToFarm] = useState<string>();
  const [date, setDate] = useState(splitDay(today));
  const [buyer, setBuyer] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [warned, setWarned] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ income?: number; movedTo?: string }>();

  const { data } = useDbQuery(async (d) => {
    const animal = await getAnimal(d, id);
    if (!animal) return null;
    return { animal, events: await listEvents(d, id), products: await listProducts(d, animal.farmId) };
  }, [id]);
  if (!data) return <GreenHeader back title={data === null ? "No encontrado" : "Cargando…"} />;

  const { animal: a, events, products } = data;
  const label = a.name ?? `#${a.tagVisual}`;
  const day = toDay(date);
  const w = withdrawalFor(events, products);
  const choice = REASONS.find((r) => r.id === reason);
  const check = choice?.purpose && day ? exitCheck(w, day, choice.purpose) : { allowed: true, mustWarnBuyer: false };
  const sale = reason === "venta_cria" || reason === "venta_carne";
  const amount = Number(price.replace(/\D/g, "")) || 0;
  const origin = farms.find((f) => f.id === a.farmId);
  const destinations = farms.filter((f) => f.id !== a.farmId && f.isDemo === origin?.isDemo);

  async function confirm() {
    if (!reason) return setError("Elige qué pasó.");
    if (!day || day > today) return setError("Revisa la fecha.");
    if (!check.allowed) return setError("No se puede mientras esté en días de retiro de carne.");
    if (check.mustWarnBuyer && !warned) return setError("Confirma que le avisaste al comprador de los días de retiro.");
    if (reason === "traslado") {
      const dest = destinations.find((f) => f.id === toFarm);
      if (!dest) return setError("Elige a qué finca pasa.");
      try {
        await transferAnimal(db, a, dest, day);
        await refresh();
        return setDone({ movedTo: dest.name });
      } catch {
        return setError("No se pudo guardar. Intenta de nuevo.");
      }
    }
    try {
      await recordExit(db, { animal: a, reason, date: day, price: sale ? amount : undefined, buyer: sale ? buyer.trim() || undefined : undefined, notes: notes.trim() || undefined });
      setDone({ income: sale && amount > 0 ? amount : undefined });
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    }
  }

  if (a.status !== "activo" && !done) {
    return (
      <View style={{ flex: 1 }}>
        <GreenHeader back kicker="DAR DE BAJA" title={label} />
        <View style={{ padding: 16 }}><Banner icon="note" tone="warn" title={`${label} ya no está activo en la finca`} /></View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={{ flex: 1 }}>
        <GreenHeader kicker="DAR DE BAJA" title="Listo" />
        <View style={{ padding: 16, gap: 14 }}>
          <Txt w="extrabold" size={22} style={{ textAlign: "center" }}>{done.movedTo ? `${label} pasó a ${done.movedTo}` : `${label} salió de la finca`}</Txt>
          <Txt size={15} color={colors.textMuted} style={{ textAlign: "center" }}>Su historial queda guardado y deja de contar en el hato y en las alertas.</Txt>
          {done.income ? <Banner icon="check" tone="ok" title={`Ingreso de ${money(done.income)} anotado en Costos`} text="Como Venta de animales." /> : null}
          <Banner icon="note" tone="warn" title="Recuerda reportar la salida al ICA" text="Queda en tu lista del reporte ICA." />
          <Button label="Volver a los animales" onPress={() => router.dismissTo("/animales")} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker="DAR DE BAJA" title={`¿Qué pasó con ${label}?`} />
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <View style={s.row}>
            {REASONS.map((r) => <Chip key={r.id} label={r.label} active={reason === r.id} onPress={() => { setError(undefined); setReason(r.id); setWarned(false); }} />)}
          </View>
          <DateField label="Fecha" value={date} onChange={(v) => { setError(undefined); setDate(v); }} />

          {!check.allowed ? (
            <Banner icon="drop" tone="danger" title="No se puede: está en días de retiro de carne"
              text={`La carne puede tener residuos hasta el ${shortDate(w.meatUntil!, today)}. Espera a esa fecha o véndela para cría.`} />
          ) : null}
          {check.mustWarnBuyer ? (
            <>
              <Banner icon="drop" tone="warn" title={`${label} está en días de retiro`}
                text={[w.milkUntil && `Leche hasta el ${shortDate(w.milkUntil, today)}`, w.meatUntil && `carne hasta el ${shortDate(w.meatUntil, today)}`].filter(Boolean).join(" · ")} />
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: warned }} onPress={() => { setError(undefined); setWarned(!warned); }} style={s.check}>
                <View style={[s.box, warned && { backgroundColor: colors.selva, borderColor: colors.selva }]}>{warned ? <Icon name="check" color={colors.onDark} size={16} width={3} /> : null}</View>
                <Txt w="semibold" size={15} style={{ flex: 1 }}>Le avisé al comprador y no va para sacrificio antes de esa fecha</Txt>
              </Pressable>
            </>
          ) : null}

          {sale ? (
            <>
              <Field label="¿A quién?" value={buyer} onChangeText={setBuyer} placeholder="Ej: Finca El Porvenir" />
              <Field label="Precio de venta" value={price} onChangeText={(t) => setPrice(t.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="Ej: 2800000" />
              {amount > 0 ? <Txt size={13} color={colors.textMuted}>Se anota un ingreso de {money(amount)} en Costos.</Txt> : null}
            </>
          ) : null}
          {reason === "traslado" ? (
            destinations.length ? (
              <View style={s.row}>{destinations.map((f) => <Chip key={f.id} label={f.name} active={toFarm === f.id} onPress={() => setToFarm(f.id)} />)}</View>
            ) : <Banner icon="note" tone="warn" title="No tienes otra finca" text="Registra la otra finca en Módulos → Mis fincas." />
          ) : null}
          {reason && reason !== "traslado" ? <Field label={reason === "murio" ? "Causa (si la sabes)" : "Nota (opcional)"} value={notes} onChangeText={setNotes} placeholder="Ej: picadura de culebra" /> : null}

          {error ? <Banner icon="note" tone="danger" title={error} /> : null}
          <Button kind="danger" label="Confirmar baja" onPress={confirm} disabled={!check.allowed} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  check: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.card, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: colors.line },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
});
