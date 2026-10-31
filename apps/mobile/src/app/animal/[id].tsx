import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { animalLabel,
  addDays, ageText, canWrite, categoryOf, colors, inWithdrawal, num, radius, REPRO_LABEL, reproStatus, shadow, shortDate, todayDay, weightSummary, withdrawalFor,
  type AnimalEvent, type EventType, type Product,
} from "@trazagro/shared";
import { getAnimal, listChildren, listEvents, listLots, listMilk, listProducts } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { shareText } from "../../lib/share";
import { useDbQuery } from "../../lib/useDb";
import { Icon, type IconName } from "../../ui/Icon";
import { Banner, Button, Card, Chip, EarTag, Empty, GreenHeader, Txt } from "../../ui/kit";

const EVENT_UI: Record<EventType, { label: string; icon: IconName; bg: string; fg: string }> = {
  vacuna: { label: "Vacuna", icon: "syringe", bg: colors.limaSoft, fg: colors.selva },
  tratamiento: { label: "Tratamiento", icon: "drop", bg: colors.rosaSoft, fg: colors.rosa },
  desparasitacion: { label: "Desparasitación", icon: "bug", bg: colors.tierraSoft, fg: colors.tierra },
  pesaje: { label: "Pesaje", icon: "scale", bg: colors.infoSoft, fg: colors.info },
  parto: { label: "Parto", icon: "heart", bg: colors.rosaSoft, fg: colors.rosa },
  servicio: { label: "Servicio", icon: "heart", bg: colors.rosaSoft, fg: colors.rosa },
  diagnostico: { label: "Palpación", icon: "heart", bg: colors.rosaSoft, fg: colors.rosa },
  secado: { label: "Secado", icon: "milk", bg: colors.infoSoft, fg: colors.info },
  traslado: { label: "Cambio de lote", icon: "layers", bg: colors.tint, fg: colors.textMuted },
  baja: { label: "Baja", icon: "note", bg: colors.dangerSoft, fg: colors.danger },
  nota: { label: "Nota", icon: "note", bg: colors.tint, fg: colors.textMuted },
  reporte_ica: { label: "Reportado al ICA", icon: "check", bg: colors.limaSoft, fg: colors.selva },
};

const METHOD = { bascula: "báscula", foto: "estimado por foto", manual: "escrito a mano" } as const;

const STATUS_LABEL = { activo: "activo", vendido: "vendido", muerto: "murió", sacrificado: "sacrificado", perdido: "perdido o robado", trasladado: "trasladado a otra finca" } as const;

export default function FichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { roleOf } = useFarm();
  const { data } = useDbQuery(async (db) => {
    const animal = await getAnimal(db, id);
    if (!animal) return null;
    const [events, children, products, lots, mother, milk] = await Promise.all([
      listEvents(db, id), listChildren(db, id), listProducts(db, animal.farmId), listLots(db, animal.farmId),
      animal.motherId ? getAnimal(db, animal.motherId) : Promise.resolve(null), listMilk(db, animal.farmId, addDays(todayDay(), -6)),
    ]);
    return { animal, events, children, products, lot: lots.find((l) => l.id === animal.lotId), mother, milk: milk.filter((m) => m.animalId === id) };
  }, [id]);

  if (data === null) return <View style={{ flex: 1 }}><GreenHeader back title="No encontrado" /><Empty title="Este animal no existe" text="Puede que se haya dado de baja." /></View>;
  if (!data) return <GreenHeader back title="Cargando…" />;

  const { animal: a, events, children, products, lot, mother, milk } = data;
  const today = todayDay();
  const births = events.filter((e) => e.type === "parto").length;
  const category = categoryOf(a.sex, a.birthDate, births, today);
  const w = withdrawalFor(events, products);
  const active = inWithdrawal(w, today);
  const exitEvent = events.find((e) => e.type === "baja");
  const weight = weightSummary(events);
  const repro = a.sex === "hembra" && births + events.filter((e) => e.type === "servicio").length > 0 ? reproStatus(events, today) : undefined;
  const milkDays = new Set(milk.map((m) => m.date)).size;
  const milkAvg = milkDays ? milk.reduce((n, m) => n + m.liters, 0) / milkDays : undefined;
  const label = animalLabel(a);
  const editable = a.status === "activo" && canWrite(roleOf(a.farmId), "animals");

  function share() {
    const lines = [
      `${label}${a.tagVisual ? ` · arete ${a.tagVisual}` : ""}${a.rfid ? ` · RFID ${a.rfid}` : ""}`,
      `${category}, ${a.breed ?? "raza no registrada"}, ${ageText(a.birthDate, today)} (nació ${shortDate(a.birthDate)})`,
      weight.lastKg ? `Último peso: ${num(weight.lastKg)} kg (${shortDate(weight.lastDate!)})` : "",
      active.meat || active.milk ? `EN RETIRO hasta ${shortDate((w.meatUntil ?? w.milkUntil)!)}` : "Sin días de retiro activos",
      "",
      "Historial:",
      ...events.slice(0, 15).map((e) => `· ${shortDate(e.date)} ${EVENT_UI[e.type].label}${e.notes ? ` · ${e.notes}` : ""}`),
      "",
      "Ficha generada con TrazAgro",
    ];
    shareText(`Ficha de ${label}`, lines.filter((l, i) => l !== "" || i > 3).join("\n")).catch(() => {});
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <GreenHeader back kicker={a.tagVisual ? `ARETE #${a.tagVisual}` : "SIN ARETE"} title={label}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Compartir ficha" onPress={share} style={s.headBtn}><Icon name="share" color={colors.onDark} size={20} /></Pressable>
              {editable ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Editar datos" onPress={() => router.push({ pathname: "/animal/editar", params: { id: a.id } })} style={s.headBtn}>
                  <Icon name="edit" color={colors.onDark} size={20} />
                </Pressable>
              ) : null}
            </View>
          }>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
            <EarTag code={a.tagVisual} tone={colors.lima} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="semibold" size={14} color={colors.onDarkMuted}>{a.rfid ? `RFID ${a.rfid}` : "Sin chip RFID registrado"}</Txt>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Chip label={category[0]!.toUpperCase() + category.slice(1)} tone={{ bg: colors.lima, fg: colors.selva }} />
                {a.breed ? <Chip label={a.breed} tone={{ bg: "rgba(255,255,255,0.14)", fg: colors.onDark }} /> : null}
              </View>
            </View>
          </View>
        </GreenHeader>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          {a.status !== "activo" ? (
            <Banner icon="note" tone="danger" title={`Salió de la finca: ${STATUS_LABEL[a.status]}`}
              text={exitEvent ? `${shortDate(exitEvent.date, today)} · ${exitEvent.notes ?? ""}` : undefined} />
          ) : null}
          {a.status === "activo" && (active.meat || active.milk) ? (
            <Banner icon="drop" tone="warn" title="En días de retiro"
              text={[active.milk && `Leche: no vender hasta el ${shortDate(w.milkUntil!, today)}`, active.meat && `Carne: no sacrificar ni vender para carne hasta el ${shortDate(w.meatUntil!, today)}`].filter(Boolean).join("\n")} />
          ) : null}

          <View style={s.grid}>
            <Stat label="Edad" value={ageText(a.birthDate, today)} sub={`Nació ${shortDate(a.birthDate, today)}`} />
            <Stat label="Peso" value={weight.lastKg ? `${num(weight.lastKg)} kg` : "—"}
              sub={weight.dailyGainKg !== undefined ? `${weight.dailyGainKg >= 0 ? "▲" : "▼"} ${num(Math.abs(weight.dailyGainKg), 2)} kg/día` : weight.lastDate ? shortDate(weight.lastDate, today) : "Sin pesajes"} />
            {a.sex === "hembra" ? <Stat label="Partos" value={String(births)} sub={births ? `Último: ${shortDate(events.find((e) => e.type === "parto")!.date, today)}` : "Ninguno"} /> : null}
            <Stat label="Lote" value={lot?.name.split(" · ")[0] ?? "—"} sub={lot?.purpose ?? ""} />
            {repro ? (
              <Stat label="Reproducción" value={REPRO_LABEL[repro.state]}
                sub={repro.state === "prenada" ? `Parto: ${shortDate(repro.expectedCalving!, today)}` : repro.state === "servida" ? `Palpar: ${shortDate(repro.checkOn!, today)}` : repro.openDays !== undefined ? `${repro.openDays} días abierta` : ""} />
            ) : null}
            {milkAvg !== undefined ? <Stat label="Leche" value={`${num(milkAvg)} L`} sub="Promedio diario, 7 días" /> : null}
          </View>

          <Card style={{ gap: 2 }}>
            <Txt w="semibold" size={11} color={colors.hoja} style={{ letterSpacing: 2.2, marginBottom: 6 }}>FAMILIA Y ORIGEN</Txt>
            <Line k="Origen" v={a.origin === "nacido" ? "Nació en la finca" : "Comprado"} />
            <Line k="Madre" v={mother ? `${mother.name ?? ""} #${mother.tagVisual ?? ""}` : "No registrada"} href={mother ? mother.id : undefined} />
            {a.sireNote ? <Line k="Padre" v={a.sireNote} /> : null}
            {children.length ? children.map((c, i) => <Line key={c.id} k={i === 0 ? "Crías" : ""} v={`${c.name ?? ""} #${c.tagVisual ?? ""}`} href={c.id} />) : a.sex === "hembra" ? <Line k="Crías" v="Ninguna" /> : null}
          </Card>

          <Txt w="extrabold" size={20} style={{ marginTop: 4 }}>Trazabilidad</Txt>
          {events.length === 0 ? <Empty title="Sin registros todavía" text="Las vacunas, pesajes y partos que anotes aparecen aquí." /> : (
            <Card style={{ paddingVertical: 4 }}>
              {events.map((e, i) => <EventRow key={e.id} e={e} products={products} today={today} last={i === events.length - 1} />)}
            </Card>
          )}
          {editable ? (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/animal/baja", params: { id: a.id } })} style={s.exit}>
              <Txt w="bold" size={15} color={colors.danger}>Dar de baja: venta, muerte o sacrificio</Txt>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      {editable ? (
        <View style={s.bar}>
          <Button kind="lime" icon="plus" label="Registrar vacuna, pesaje o parto" style={{ flex: 1, minHeight: 52 }}
            onPress={() => router.push({ pathname: "/evento/nuevo", params: { farmId: a.farmId, animalId: a.id } })} />
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={s.stat}>
      <Txt size={13} color={colors.textMuted}>{label}</Txt>
      <Txt w="extrabold" size={22}>{value}</Txt>
      <Txt size={12} color={colors.textMuted} numberOfLines={1}>{sub}</Txt>
    </View>
  );
}

function Line({ k, v, href }: { k: string; v: string; href?: string }) {
  const router = useRouter();
  const body = (
    <View style={s.line}>
      <Txt size={15} color={colors.textMuted}>{k}</Txt>
      <Txt w="bold" size={15} color={href ? colors.hoja : colors.text}>{v}</Txt>
    </View>
  );
  return href ? <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/animal/[id]", params: { id: href } })}>{body}</Pressable> : body;
}

function EventRow({ e, products, today, last }: { e: AnimalEvent; products: Product[]; today: string; last: boolean }) {
  const ui = EVENT_UI[e.type];
  const product = products.find((p) => p.id === e.productId);
  const detail =
    e.type === "pesaje" ? `${num(e.weightKg ?? 0)} kg${e.weightMethod ? ` · ${METHOD[e.weightMethod]}` : ""}` :
    e.type === "parto" ? (e.calfId ? "Cría registrada en la finca" : "Parto registrado") :
    e.type === "servicio" ? (e.notes ?? "").replace(/^monta: /, "Monta con ").replace(/^ia: /, "Inseminación · ") :
    e.type === "diagnostico" ? (e.notes === "preñada" ? "Preñada" : "Vacía") :
    e.type === "traslado" ? `Pasó a ${e.notes ?? "otro lote"}` :
    e.type === "reporte_ica" ? `${(e.notes ?? "").charAt(0).toUpperCase()}${(e.notes ?? "").slice(1)} registrado en SINIGAN` :
    [product?.name, e.dose].filter(Boolean).join(" · ") || e.notes || "";
  return (
    <View style={[s.event, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      <View style={[s.evIcon, { backgroundColor: ui.bg }]}><Icon name={ui.icon} color={ui.fg} size={20} /></View>
      <View style={{ flex: 1 }}>
        <Txt w="bold" size={15}>{ui.label}</Txt>
        {detail ? <Txt size={13} color={colors.textMuted}>{detail}</Txt> : null}
      </View>
      <Txt w="semibold" size={13} color={colors.textMuted}>{shortDate(e.date, today)}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  headBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  exit: { minHeight: 52, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.dangerSoft, alignItems: "center", justifyContent: "center", marginTop: 4 },
  bar: { position: "absolute", left: 14, right: 14, bottom: 18, minHeight: 68, borderRadius: 34, backgroundColor: colors.selva, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, ...shadow },
  stat: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 2, ...shadow },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 12 },
  event: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  evIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
