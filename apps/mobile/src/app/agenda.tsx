import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { agenda, colors, shadow, shortDate, todayDay, type AgendaItem } from "@trazagro/shared";
import { loadFarmBundle } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Empty, GreenHeader, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { HeaderAction, SectionLabel } from "../ui/campo/parts";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
/** Colour bar per kind (Agenda.dc): vaccines amber, weighing blue, reproduction pink, inventory brown, end of withdrawal green. */
const BAR: Record<AgendaItem["kind"], string> = { salud: "#F9A825", pesaje: "#1976D2", reproduccion: "#C2185B", inventario: colors.tierra };
const barOf = (i: AgendaItem) => (i.id.startsWith("retiro") ? colors.link : BAR[i.kind]);
const HORIZON = 400;

/** What the item's "Hacer" leads to: the record form, the reproduction module, the animal or the inventory. */
function actionOf(i: AgendaItem): Href {
  const [kind] = i.id.split(":");
  if (i.animalId && kind === "vacuna") return { pathname: "/evento/nuevo", params: { kind: "vacuna", animalId: i.animalId } };
  if (i.animalId && kind === "peso") return { pathname: "/evento/nuevo", params: { kind: "pesaje", animalId: i.animalId } };
  if (i.kind === "reproduccion") return "/reproduccion";
  if (i.productId) return "/inventario";
  return { pathname: "/animal/[id]", params: { id: i.animalId! } };
}

/** Agenda sanitaria (Agenda.dc): month calendar with a dot per day that has work, and the chosen day's list. */
export default function AgendaScreen() {
  const router = useRouter();
  const farmId = useFarmId();
  const canEdit = useFarm().can("events");
  const today = todayDay();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const { data } = useDbQuery((d) => loadFarmBundle(d, farmId), [farmId]);
  const items = data ? agenda(data.animals, data.events, data.products, today, HORIZON) : [];
  const byDay = new Map<string, AgendaItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  const overdue = items.filter((i) => i.date < today);
  const dayItems = byDay.get(sel) ?? [];
  const next = items.filter((i) => i.date > today).slice(0, 1)[0];

  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (d: number) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7);
    setMonth(t);
  };

  function open(i: AgendaItem) {
    if (i.animalId) router.push({ pathname: "/animal/[id]", params: { id: i.animalId } });
    else if (i.productId) router.push("/inventario");
  }

  const dayTitle = `${sel === today ? "Hoy, " : ""}${Number(sel.slice(8))} de ${MONTHS[Number(sel.slice(5, 7)) - 1]!.toLowerCase()}`;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <GreenHeader back title="Agenda sanitaria" waveHeight={40}
        right={canEdit ? <HeaderAction label="Registrar" accessibilityLabel="Registrar vacuna, pesaje o tratamiento" onPress={() => router.push("/evento/nuevo")} /> : undefined} />

      <View style={s.main}>
        <Rise index={0} style={s.calendar}>
          <View style={s.calHead}>
            <Tap accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => shift(-1)} style={s.nav}><Txt w="extrabold" size={16}>‹</Txt></Tap>
            <Txt w="extrabold" size={16}>{`${MONTHS[m - 1]} ${y}`}</Txt>
            <Tap accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => shift(1)} style={s.nav}><Txt w="extrabold" size={16}>›</Txt></Tap>
          </View>
          <View style={s.week}>
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <Txt key={i} w="extrabold" size={11} color={colors.textMuted} style={s.weekDay}>{d}</Txt>)}
          </View>
          <View style={s.cells}>
            {cells.map((c, i) => {
              if (!c) return <View key={`b${i}`} style={s.cell} />;
              const ev = byDay.get(c);
              const on = c === sel, isToday = c === today;
              return (
                <View key={c} style={s.cell}>
                  <Tap accessibilityRole="button" accessibilityLabel={`${Number(c.slice(8))} de ${MONTHS[m - 1]!.toLowerCase()}${ev ? `, ${ev.length} ${ev.length === 1 ? "tarea" : "tareas"}` : ""}`}
                    accessibilityState={{ selected: on }} onPress={() => setSel(c)}
                    style={[s.day, on ? { backgroundColor: colors.selva } : isToday ? { backgroundColor: colors.greenSoft } : null]}>
                    <Txt w={on || isToday ? "extrabold" : "semibold"} size={14} color={on ? colors.onDark : isToday ? colors.selva : colors.text}>{Number(c.slice(8))}</Txt>
                    <View style={[s.dot, ev ? { backgroundColor: on ? colors.onDark : c < today ? colors.urgent : barOf(ev[0]!) } : null]} />
                  </Tap>
                </View>
              );
            })}
          </View>
        </Rise>

        <Rise index={1} style={{ gap: 10 }}>
          <Txt w="extrabold" size={17}>{dayTitle}</Txt>
          {dayItems.length ? dayItems.map((i) => <Task key={i.id} item={i} today={today} onOpen={() => open(i)} onDo={canEdit ? () => router.push(actionOf(i)) : undefined} />) : (
            <View style={s.none}>
              <Txt size={14} color={colors.textMuted} style={{ textAlign: "center" }}>
                {data ? (next && sel === today ? `Nada programado hoy. Lo próximo: ${next.title.charAt(0).toLowerCase()}${next.title.slice(1)}, el ${shortDate(next.date, today)}.` : "Nada programado este día.") : "Cargando…"}
              </Txt>
            </View>
          )}
        </Rise>

        {overdue.length ? (
          <Rise index={2} style={{ gap: 10 }}>
            <SectionLabel color={colors.danger}>{`Atrasado · ${overdue.length}`}</SectionLabel>
            {overdue.map((i) => <Task key={i.id} item={i} today={today} late onOpen={() => open(i)} onDo={canEdit ? () => router.push(actionOf(i)) : undefined} />)}
          </Rise>
        ) : null}
        {data && !items.length ? <Empty title="Nada pendiente" text="Cuando registres servicios, vacunas y pesajes, aquí verás lo que toca." /> : null}
        <Txt size={12} color={colors.textMuted} style={{ textAlign: "center" }}>{`Calculada de tus registros: vacunas cada 6 meses, pesajes cada 60 días, palpación, secado y parto.`}</Txt>
      </View>
    </ScrollView>
  );
}

function Task({ item, today, late, onOpen, onDo }: { item: AgendaItem; today: string; late?: boolean; onOpen: () => void; onDo?: () => void }) {
  return (
    <View style={s.task}>
      <View style={{ flex: 1 }}>
        <Tap accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.detail}`} onPress={onOpen} style={s.taskMain}>
          <View style={[s.bar, { backgroundColor: late ? colors.urgent : barOf(item) }]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt w="extrabold" size={15}>{item.title}</Txt>
            <Txt size={13} color={colors.textMuted}>{late ? `${item.detail} · desde el ${shortDate(item.date, today)}` : item.detail}</Txt>
          </View>
        </Tap>
      </View>
      {onDo ? (
        <Tap accessibilityRole="button" accessibilityLabel={`Hacer: ${item.title}`} onPress={onDo} hitSlop={6} style={s.doBtn}>
          <Txt w="extrabold" size={12} color={colors.link}>Hacer</Txt>
        </Tap>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  main: { paddingTop: 12, paddingHorizontal: 16, gap: 14 },
  calendar: { backgroundColor: colors.card, borderRadius: 24, padding: 14, gap: 8, ...shadow },
  calHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row" },
  weekDay: { flex: 1, textAlign: "center" },
  cells: { flexDirection: "row", flexWrap: "wrap", rowGap: 2 },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: "center", justifyContent: "center" },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  none: { padding: 18, borderRadius: 20, backgroundColor: colors.card },
  task: { flexDirection: "row", alignItems: "center", gap: 4, padding: 12, backgroundColor: colors.card, borderRadius: 20, ...shadow },
  taskMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  bar: { width: 6, alignSelf: "stretch", borderRadius: 3 },
  doBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
});
