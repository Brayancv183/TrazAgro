import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { animalLabel, colors, exitCheck, money, shortDate, todayDay, withdrawalFor, type ExitPurpose } from "@trazagro/shared";
import { countActive, shortLot } from "../../db/animales";
import { addPhoto } from "../../db/photos";
import { getAnimal, listEvents, listLots, listProducts, recordExit, transferAnimal, type ExitReason } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { RequireWrite } from "../../ui/NoPermission";
import { useDbQuery } from "../../lib/useDb";
import { DateField, splitDay, toDay } from "../../ui/DateField";
import { Icon } from "../../ui/Icon";
import { Kicker, Txt } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { CheckLine, ChoiceCard, DashedButton, FlexTap, Note, RadioRow, WizField } from "../../ui/animales/parts";
import { pickPhoto } from "../../ui/animales/photo";

type Reason = ExitReason | "traslado";

const REASONS: { id: Reason; label: string; sub: string; purpose?: ExitPurpose; photo: string }[] = [
  { id: "venta_cria", label: "Se vendió para cría o leche", sub: "A otra finca o a feria", purpose: "venta_cria", photo: "Foto de la factura o guía ICA" },
  { id: "venta_carne", label: "Se vendió para carne", sub: "Va para matadero", purpose: "venta_carne", photo: "Foto de la factura o guía ICA" },
  { id: "sacrificio", label: "Sacrificio", sub: "Consumo o matadero", purpose: "sacrificio", photo: "Foto del soporte (opcional)" },
  { id: "murio", label: "Murió", sub: "Enfermedad, accidente…", photo: "Foto o certificado (opcional)" },
  { id: "perdido", label: "Perdido o robado", sub: "No se encuentra", photo: "Foto de la denuncia (opcional)" },
  { id: "traslado", label: "Pasó a otra de mis fincas", sub: "Sigue siendo tuyo", purpose: "venta_cria", photo: "Foto de la guía de movilización" },
];

/** "Dar de baja" (SheetBaja.dc). A full screen dressed as the sheet: dark scrim on top, white panel with the grip. */
function BajaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const today = todayDay();
  const { farms, refresh, can } = useFarm();
  const canMoney = can("movements");
  const [reason, setReason] = useState<Reason>();
  const [toFarm, setToFarm] = useState<string>();
  const [date, setDate] = useState(splitDay(today));
  const [buyer, setBuyer] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [warned, setWarned] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ income?: number; movedTo?: string; lotLeft?: number; active: number }>();

  const { data } = useDbQuery(async (d) => {
    const animal = await getAnimal(d, id);
    if (!animal) return null;
    const lots = await listLots(d, animal.farmId);
    return { animal, events: await listEvents(d, id), products: await listProducts(d, animal.farmId), lot: lots.find((l) => l.id === animal.lotId) };
  }, [id]);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/animales"));

  if (!data) {
    return <Panel onBack={back}><Txt w="extrabold" size={24}>{data === null ? "No encontrado" : "Cargando…"}</Txt></Panel>;
  }

  const { animal: a, events, products, lot } = data;
  const label = animalLabel(a);
  const full = `${label}${a.name && a.tagVisual ? ` #${a.tagVisual}` : ""}`;
  const day = toDay(date);
  const w = withdrawalFor(events, products);
  const choice = REASONS.find((r) => r.id === reason);
  const check = choice?.purpose && day ? exitCheck(w, day, choice.purpose) : { allowed: true, mustWarnBuyer: false };
  const sale = reason === "venta_cria" || reason === "venta_carne";
  const amount = Number(price.replace(/\D/g, "")) || 0;
  const origin = farms.find((f) => f.id === a.farmId);
  const destinations = farms.filter((f) => f.id !== a.farmId && f.isDemo === origin?.isDemo);
  const blocked = !check.allowed;
  const until = w.meatUntil ? shortDate(w.meatUntil, today) : "";

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
        if (photo) await addPhoto(db, { farmId: dest.id, animalId: a.id, uri: photo, note: "Guía de movilización" });
        await refresh();
        return setDone({ movedTo: dest.name, active: await countActive(db, a.farmId), lotLeft: lot ? await countActive(db, a.farmId, lot.id) : undefined });
      } catch {
        return setError("No se pudo guardar. Intenta de nuevo.");
      }
    }
    try {
      await recordExit(db, { animal: a, reason, date: day, price: sale ? amount : undefined, buyer: sale ? buyer.trim() || undefined : undefined, notes: notes.trim() || undefined });
      if (photo) await addPhoto(db, { farmId: a.farmId, animalId: a.id, uri: photo, note: choice?.label });
      setDone({ income: sale && amount > 0 ? amount : undefined, active: await countActive(db, a.farmId), lotLeft: lot ? await countActive(db, a.farmId, lot.id) : undefined });
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    }
  }

  if (a.status !== "activo" && !done) {
    return (
      <Panel onBack={back}>
        <Head kicker="DAR DE BAJA" title={`${full} ya no está activo`} />
        <Note icon="info" tone="warn">Su historial sigue guardado en la ficha.</Note>
        <Btn label="Volver" kind="soft" onPress={back} />
      </Panel>
    );
  }

  if (done) {
    const sub = `Motivo: ${(choice?.label ?? "").toLowerCase()} · ${shortDate(day!, today)}`;
    return (
      <Panel onBack={() => router.dismissTo("/animales")}>
        <Rise style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Txt w="extrabold" size={24}>{done.movedTo ? `${label} pasó a ${done.movedTo}` : `${label} quedó dad${a.sex === "macho" ? "o" : "a"} de baja`}</Txt>
            <Txt size={14} color={colors.textMuted}>{sub}</Txt>
          </View>
          {done.income ? (
            <Tap accessibilityRole="link" accessibilityLabel="Ver ingreso en Costos" onPress={() => router.push("/costos")} style={s.income}>
              <View style={s.incomeIcon}><Icon name="money" color={colors.selva} size={22} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="semibold" size={12} color={colors.lima} style={{ letterSpacing: 1.7 }}>INGRESO AUTOMÁTICO</Txt>
                <Txt w="extrabold" size={18} color={colors.onDark}>{`+ ${money(done.income)}`}</Txt>
                <Txt size={12} color={colors.onDarkMuted}>En Costos › Venta de animales</Txt>
              </View>
            </Tap>
          ) : null}
          <View style={s.list}>
            {[
              lot ? `Salió del ${shortLot(lot)} (ahora ${done.lotLeft ?? 0} ${done.lotLeft === 1 ? "animal" : "animales"})` : "Salió de los animales activos",
              `Animales activos: ${done.active}`,
              done.movedTo ? `Sigue con todo su historial en ${done.movedTo}` : "Su historial queda guardado en su ficha",
              "Recuerda reportar la salida al ICA",
            ].map((t, i, arr) => (
              <View key={t} style={[s.listRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#EAE6DC" }]}>
                <Icon name={i === arr.length - 1 ? "report" : "check"} color={i === arr.length - 1 ? colors.warn : colors.link} size={18} width={2.4} />
                <Txt size={14} style={{ flex: 1 }}>{t}</Txt>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {done.income && canMoney ? <Btn flex={1} kind="soft" label="Ver en Costos" onPress={() => router.push("/costos")} /> : <Btn flex={1} kind="soft" label="Reporte ICA" onPress={() => router.push("/ica")} />}
            <Btn flex={1} label="Volver a los animales" onPress={() => router.dismissTo("/animales")} />
          </View>
        </Rise>
      </Panel>
    );
  }

  return (
    <Panel onBack={back}>
      <Head kicker="DAR DE BAJA" title={`¿Qué pasó con ${full}?`} />
      <View role="group" accessibilityLabel="Motivo" style={s.grid}>
        {REASONS.map((r) => (
          <View key={r.id} style={s.cell}>
            <ChoiceCard danger label={r.label} sub={r.sub} on={reason === r.id} onPress={() => { setError(undefined); setReason(r.id); setWarned(false); }} style={{ flex: 1 }} />
          </View>
        ))}
      </View>
      <DateField label="Fecha" value={date} onChange={(v) => { setError(undefined); setDate(v); }} />

      {sale ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><WizField label="¿A quién?" value={buyer} onChangeText={setBuyer} placeholder="Ej: Finca El Porvenir" /></View>
          {canMoney ? <View style={{ flex: 1 }}><WizField label="Precio de venta" value={price} onChangeText={(t) => setPrice(t.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="Ej: 2800000" /></View> : null}
        </View>
      ) : null}
      {sale && canMoney && amount > 0 ? <Txt size={13} color={colors.textMuted}>Se anota un ingreso de {money(amount)} en Costos.</Txt> : null}
      {reason === "traslado" ? (
        destinations.length ? (
          <View style={{ gap: 8 }}>
            <Txt w="semibold" size={14} color={colors.textMuted}>¿A qué finca pasa?</Txt>
            {destinations.map((f) => <RadioRow key={f.id} label={f.name} sub={f.municipality} on={toFarm === f.id} onPress={() => { setError(undefined); setToFarm(f.id); }} />)}
          </View>
        ) : <Note icon="info" tone="warn">No tienes otra finca. Regístrala en Módulos › Mis fincas.</Note>
      ) : null}
      {reason && reason !== "traslado" && !sale ? (
        <WizField label={reason === "murio" ? "Causa (si la sabes)" : "Nota (opcional)"} value={notes} onChangeText={setNotes} placeholder="Ej: picadura de culebra" />
      ) : null}
      {choice ? <DashedButton height={48} label={photo ? "Foto lista" : choice.photo} done={!!photo} onPress={async () => { const u = await pickPhoto("camera"); if (u) setPhoto(u); }} /> : null}

      {blocked || check.mustWarnBuyer ? (
        <View accessibilityRole="alert" style={s.wd}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="drop" color={colors.warn} size={20} />
            <Txt w="extrabold" size={15} color={colors.signalText} style={{ flex: 1 }}>{blocked ? "No se puede: está en días de retiro de carne" : `${label} está en días de retiro`}</Txt>
          </View>
          <Txt size={14} color={colors.signalText} style={{ lineHeight: 20 }}>
            {[w.milkUntil && `Leche hasta el ${shortDate(w.milkUntil, today)}`, w.meatUntil && `carne hasta el ${until}`].filter(Boolean).join(" · ")}.
            {blocked ? ` La carne puede tener residuos: espera a esa fecha o véndela para cría.` : " Solo puedes venderla para cría o leche, no para carne."}
          </Txt>
          {check.mustWarnBuyer ? <CheckLine label={`Le avisé al comprador y no va para sacrificio antes del ${until || "fin del retiro"}`} on={warned} onPress={() => { setError(undefined); setWarned(!warned); }} /> : null}
        </View>
      ) : null}

      <Note icon="check" tone="tint">{`Saldrá ${lot ? `del ${shortLot(lot)} y ` : ""}de los animales activos. Su trazabilidad se guarda y las métricas del hato se actualizan solas.`}</Note>
      {error ? <Note icon="alert" tone="danger">{error}</Note> : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn flex={1} kind="sand" label="Cancelar" onPress={back} />
        <FlexTap flex={1.4} accessibilityRole="button" accessibilityLabel="Confirmar baja" disabled={blocked}
          onPress={confirm} style={[s.btn, { backgroundColor: blocked ? "#B5AE9F" : colors.danger }]}>
          <Txt w="bold" size={15} color={blocked ? colors.text : colors.onDark}>{blocked ? `Bloqueado hasta ${until}` : "Confirmar baja"}</Txt>
        </FlexTap>
      </View>
    </Panel>
  );
}

/** The sheet look: scrim above (tap to go back), white panel with 30 px corners and the grip. */
function Panel({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.crema }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,25,17,0.55)" }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onBack} style={{ minHeight: insets.top + 48, flexGrow: 1 }} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.grip} />
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Head({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Kicker color={colors.danger}>{kicker}</Kicker>
      <Txt w="extrabold" size={24}>{title}</Txt>
    </View>
  );
}

function Btn({ label, onPress, kind = "primary", flex }: { label: string; onPress: () => void; kind?: "primary" | "soft" | "sand"; flex?: number }) {
  const pal = { primary: [colors.selva, colors.onDark], soft: ["#E8EFE0", colors.selva], sand: [colors.sand, colors.text] }[kind];
  return (
    <FlexTap flex={flex ?? 0} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[s.btn, { backgroundColor: pal[0] }]}>
      <Txt w="bold" size={15} color={pal[1]} style={{ textAlign: "center" }}>{label}</Txt>
    </FlexTap>
  );
}

const s = StyleSheet.create({
  sheet: { maxHeight: "92%", backgroundColor: colors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 16, gap: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 40, shadowOffset: { width: 0, height: -10 }, elevation: 24 },
  grip: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.grip },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "48.5%", flexGrow: 1 },
  wd: { gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.warnSoft },
  btn: { minHeight: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  income: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.selva },
  incomeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
  list: { backgroundColor: colors.crema, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 14 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
});

export default function Screen() {
  return <RequireWrite table="animals"><BajaScreen /></RequireWrite>;
}
