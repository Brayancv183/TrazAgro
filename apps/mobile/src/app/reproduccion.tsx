import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  addDays, animalLabel, colors, daysBetween, GESTATION_DAYS, monthsBetween, plural, REPRO_LABEL, reproStatus, shadow, shortDate, todayDay,
  type Animal, type ReproState, type ReproStatus,
} from "@trazagro/shared";
import { listAllAnimals, listAnimals, listFarmEvents, recordSimple } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { DateField, splitDay, toDay } from "../ui/DateField";
import { Icon, type IconName } from "../ui/Icon";
import { Banner, Button, Chip, EarTag, Empty, Field, GreenHeader, Sheet, Txt, tagTone } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { Badge, Bar, HeaderAction, Segmented, SectionLabel } from "../ui/campo/parts";

const STATE_TONE: Record<ReproState, { bg: string; fg: string }> = {
  prenada: { bg: colors.limaSoft, fg: colors.selva },
  servida: { bg: colors.infoSoft, fg: colors.info },
  parida: { bg: colors.rosaSoft, fg: colors.rosa },
  vacia: { bg: colors.warnSoft, fg: colors.warn },
};
const PINK = "#C2185B";

type Action = "servicio" | "diagnostico" | "secado";
type View4 = "calendario" | "prenez" | "crias" | "servicios";
const VIEWS: { id: View4; label: string }[] = [{ id: "calendario", label: "Calendario" }, { id: "prenez", label: "Preñeces" }, { id: "crias", label: "Crías" }, { id: "servicios", label: "Servicios" }];
type Cow = { cow: Animal; status: ReproStatus };
interface Row { key: string; short: string; title: string; detail: string; big: string; small: string; pct?: number; cow?: Cow; calfId?: string }

const inDays = (n: number) => (n <= 0 ? "Hoy" : n < 60 ? plural(n, "día", "días") : `${Math.round(n / 30)} meses`);

/** Reproducción y crías (Reproduccion.dc): counters, the cycle by view, and every breeding female with her actions. */
export default function ReproduccionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const farmId = useFarmId();
  const canEdit = useFarm().can("events");
  const today = todayDay();
  const [view, setView] = useState<View4>("calendario");
  const [filter, setFilter] = useState<ReproState | "todas">("todas");
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<Cow>();
  const [action, setAction] = useState<Action>();
  const [saved, setSaved] = useState<string>();
  const { data, reload } = useDbQuery(async (d) => {
    const [animals, events, everyone] = await Promise.all([listAnimals(d, farmId), listFarmEvents(d, farmId), listAllAnimals(d, farmId)]);
    const cows = animals
      .filter((a) => a.sex === "hembra" && monthsBetween(a.birthDate, today) >= 15)
      .map((cow) => ({ cow, status: reproStatus(events.filter((e) => e.animalId === cow.id), today) }));
    const byId = new Map(everyone.map((a) => [a.id, a]));
    const calves = everyone.filter((a) => a.origin === "nacido" && a.motherId && a.birthDate >= addDays(today, -365)).sort((x, y) => y.birthDate.localeCompare(x.birthDate));
    const birthsThisMonth = events.filter((e) => e.type === "parto" && e.date.slice(0, 7) === today.slice(0, 7)).length;
    const services = new Map(events.filter((e) => e.type === "servicio").map((e) => [`${e.animalId}:${e.date}`, e.notes ?? ""]));
    return { cows, calves, byId, birthsThisMonth, services };
  }, [farmId]);

  const cows = data?.cows ?? [];
  const list = cows.filter((r) => filter === "todas" || r.status.state === filter);
  const count = (st: ReproState) => cows.filter((r) => r.status.state === st).length;
  const how = (c: Cow) => {
    const n = c.status.lastService ? data?.services.get(`${c.cow.id}:${c.status.lastService}`) : undefined;
    if (!n) return undefined;
    const [kind, who] = n.split(": ");
    return `${kind === "ia" ? "Inseminación" : "Monta natural"}${who ? ` · ${kind === "ia" ? "" : "toro "}${who}` : ""}`;
  };
  const short = (a?: Animal) => (a?.tagVisual ? a.tagVisual.slice(-3) : "—");
  const name = (a: Animal) => [a.name, a.tagVisual && `#${a.tagVisual}`].filter(Boolean).join(" · ");

  function next(st: ReproStatus) {
    if (st.state === "prenada") return st.dried ? `Parto esperado ${shortDate(st.expectedCalving!, today)}` : `Secar ${shortDate(st.dryOffOn!, today)} · parto ${shortDate(st.expectedCalving!, today)}`;
    if (st.state === "servida") return `${st.checkOn! <= today ? "Ya se puede palpar" : `Palpar desde ${shortDate(st.checkOn!, today)}`} · servida ${shortDate(st.lastService!, today)}`;
    if (st.state === "vacia" && st.lastService) return `Vacía en la palpación · servida ${shortDate(st.lastService, today)}`;
    if (st.openDays !== undefined) return `${st.openDays} días abierta · parió ${shortDate(st.lastCalving!, today)}`;
    return "Sin servicios registrados";
  }

  function rows(): Row[] {
    const gest = (c: Cow) => Math.round((daysBetween(c.status.lastService!, today) / GESTATION_DAYS) * 100);
    if (view === "prenez") {
      return [
        ...cows.filter((c) => c.status.state === "prenada").sort((x, y) => x.status.expectedCalving!.localeCompare(y.status.expectedCalving!)).map((c) => {
          const left = daysBetween(today, c.status.expectedCalving!);
          return { key: c.cow.id, cow: c, short: short(c.cow), title: name(c.cow), detail: how(c) ?? `Servida ${shortDate(c.status.lastService!, today)}`, big: inDays(left), small: left >= 60 ? "para parto" : "para parto", pct: gest(c) };
        }),
        ...cows.filter((c) => c.status.state === "servida").map((c) => ({
          key: c.cow.id, cow: c, short: short(c.cow), title: name(c.cow), detail: `Confirmar preñez ${c.status.checkOn! <= today ? "ya" : `el ${shortDate(c.status.checkOn!, today)}`}`, big: "Revisar", small: "palpación", pct: 10,
        })),
      ];
    }
    if (view === "servicios") {
      return cows.filter((c) => c.status.lastService && (c.status.state === "servida" || c.status.state === "prenada")).sort((x, y) => y.status.lastService!.localeCompare(x.status.lastService!)).map((c) => ({
        key: c.cow.id, cow: c, short: short(c.cow), title: name(c.cow), detail: `${how(c) ?? "Servicio"} · ${shortDate(c.status.lastService!, today)}`,
        big: plural(daysBetween(c.status.lastService!, today), "día", "días"), small: "desde servicio",
      }));
    }
    if (view === "crias") {
      return (data?.calves ?? []).map((a) => {
        const mother = data?.byId.get(a.motherId!);
        const days = daysBetween(a.birthDate, today);
        return { key: a.id, calfId: a.id, short: short(a), title: `Cría de ${mother?.name ?? (mother?.tagVisual ? `#${mother.tagVisual}` : "madre")} · ${a.sex}`, detail: `Nació el ${shortDate(a.birthDate, today)}${a.name ? ` · ${a.name}` : ""}`, big: inDays(days), small: "de edad" };
      });
    }
    const out: (Row & { date: string })[] = [];
    for (const c of cows) {
      const st = c.status;
      if (st.state === "servida") {
        const d = daysBetween(today, st.checkOn!);
        out.push({ key: `p${c.cow.id}`, date: st.checkOn!, cow: c, short: short(c.cow), title: `${c.cow.name ?? `#${c.cow.tagVisual}`} · palpación`, detail: `${shortDate(st.checkOn!, today)} · 45 días después del servicio`, big: d <= 0 ? "Ya" : inDays(d), small: "para palpar", pct: Math.min(100, Math.round((daysBetween(st.lastService!, today) / 45) * 100)) });
      }
      if (st.state === "prenada") {
        if (!st.dried) {
          const d = daysBetween(today, st.dryOffOn!);
          out.push({ key: `s${c.cow.id}`, date: st.dryOffOn!, cow: c, short: short(c.cow), title: `${c.cow.name ?? `#${c.cow.tagVisual}`} · secado`, detail: `${shortDate(st.dryOffOn!, today)} · 60 días antes del parto`, big: d <= 0 ? "Ya" : inDays(d), small: "para secar" });
        }
        const d = daysBetween(today, st.expectedCalving!);
        out.push({ key: `c${c.cow.id}`, date: st.expectedCalving!, cow: c, short: short(c.cow), title: `${c.cow.name ?? `#${c.cow.tagVisual}`} · parto probable`, detail: `${shortDate(st.expectedCalving!, today)} · ${GESTATION_DAYS} días desde el servicio`, big: inDays(d), small: "para parto", pct: gest(c) });
      }
    }
    return out.sort((x, y) => x.date.localeCompare(y.date));
  }

  const shown = data ? rows() : [];
  const emptyText = { calendario: "Cuando registres servicios aparecen aquí la palpación, el secado y el parto.", prenez: "Ninguna preñada ni por palpar.", crias: "No hay crías nacidas en el último año.", servicios: "No hay servicios activos." }[view];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <GreenHeader back kicker={data ? `${plural(cows.length, "HEMBRA", "HEMBRAS")} EN LA FINCA` : " "} title="Reproducción y crías" waveHeight={40}
          right={canEdit ? <HeaderAction label="Servicio o parto" onPress={() => { setSaved(undefined); setPicking(true); }} /> : undefined} />

        <View style={s.main}>
          {saved ? <Banner icon="check" tone="ok" title={saved} /> : null}
          <Rise index={0} style={{ flexDirection: "row", gap: 10 }}>
            <View style={[s.stat, { backgroundColor: colors.selva }]}>
              <Txt w="extrabold" size={24} color={colors.onDark}>{count("prenada")}</Txt>
              <Txt w="bold" size={12} color={colors.onDarkMuted}>{count("prenada") === 1 ? "Preñada" : "Preñadas"}</Txt>
            </View>
            <View style={[s.stat, { backgroundColor: colors.card }, shadow]}>
              <Txt w="extrabold" size={24}>{count("vacia") + count("parida")}</Txt>
              <Txt w="bold" size={12} color={colors.textMuted}>Vacías</Txt>
            </View>
            <View style={[s.stat, { backgroundColor: colors.rosaSoft }]}>
              <Txt w="extrabold" size={24} color="#7A1530">{data?.birthsThisMonth ?? 0}</Txt>
              <Txt w="bold" size={12} color="#7A1530">Partos este mes</Txt>
            </View>
          </Rise>
          <Txt size={13} color={colors.textMuted} style={{ marginTop: -4 }}>
            {data ? `${plural(count("prenada"), "preñada", "preñadas")} · ${plural(count("servida"), "por palpar", "por palpar")} · ${plural(count("vacia") + count("parida"), "vacía", "vacías")}` : "Cargando…"}
          </Txt>

          <Rise index={1}><Segmented options={VIEWS} value={view} onChange={setView} /></Rise>

          <Rise index={2} key={view} style={{ gap: 10 }}>
            {data && !shown.length ? <Empty title="Nada por ahora" text={emptyText} /> : null}
            {shown.map((r) => (
              <Tap key={r.key} accessibilityRole="button" accessibilityLabel={`${r.title}. ${r.detail}. ${r.big} ${r.small}`}
                onPress={() => (r.calfId ? router.push({ pathname: "/animal/[id]", params: { id: r.calfId } }) : r.cow && (setSaved(undefined), setTarget(r.cow)))} style={s.row}>
                <Badge text={r.short} bg={colors.rosaSoft} fg={colors.rosa} size={48} />
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Txt w="extrabold" size={15}>{r.title}</Txt>
                  <Txt size={13} color={colors.textMuted}>{r.detail}</Txt>
                  {r.pct ? <View style={{ marginTop: 4 }}><Bar pct={r.pct} color={PINK} height={6} /></View> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt w="extrabold" size={16}>{r.big}</Txt>
                  <Txt size={11} color={colors.textMuted}>{r.small}</Txt>
                </View>
              </Tap>
            ))}
          </Rise>

          <Rise index={3} style={{ gap: 10 }}>
            <SectionLabel>Todas las hembras</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label="Todas" active={filter === "todas"} onPress={() => setFilter("todas")} />
              {(["prenada", "servida", "parida", "vacia"] as const).map((st) => <Chip key={st} label={`${REPRO_LABEL[st]} ${count(st)}`} active={filter === st} onPress={() => setFilter(st)} />)}
            </ScrollView>
            {data && !list.length ? <Empty title="Ninguna en este grupo" text="Las hembras de más de 15 meses aparecen aquí." /> : null}
            {list.map(({ cow, status }) => (
              <Tap key={cow.id} accessibilityRole="button" accessibilityLabel={`Registrar para ${animalLabel(cow)}`}
                onPress={() => { setSaved(undefined); setTarget({ cow, status }); }} style={s.row}>
                <EarTag code={cow.tagVisual} size={36} tone={tagTone(cow.sex)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="bold" size={16}>{animalLabel(cow)}</Txt>
                  <Txt size={13} color={colors.textMuted}>{next(status)}</Txt>
                </View>
                <View style={[s.badge, { backgroundColor: STATE_TONE[status.state].bg }]}>
                  <Txt w="bold" size={12} color={STATE_TONE[status.state].fg}>{REPRO_LABEL[status.state]}</Txt>
                </View>
              </Tap>
            ))}
          </Rise>

          <View style={s.soon}>
            <Icon name="gps" color={colors.tierraDeep} size={20} />
            <Txt size={13} color={colors.tierraDeep} style={{ flex: 1, lineHeight: 18 }}>Detección de celo con el collar: llega en una fase siguiente. Por ahora anota el servicio cuando lo veas.</Txt>
          </View>
        </View>
      </ScrollView>

      <Sheet open={picking} onClose={() => setPicking(false)} title="¿De cuál hembra?">
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 8 }}>
          {cows.map((c) => (
            <Tap key={c.cow.id} accessibilityRole="button" accessibilityLabel={`Elegir a ${animalLabel(c.cow)}`} onPress={() => { setPicking(false); setTarget(c); }} style={s.pickRow}>
              <EarTag code={c.cow.tagVisual} size={32} tone={tagTone(c.cow.sex)} />
              <Txt w="bold" size={16} style={{ flex: 1 }}>{animalLabel(c.cow)}</Txt>
              <Txt w="bold" size={12} color={STATE_TONE[c.status.state].fg}>{REPRO_LABEL[c.status.state]}</Txt>
            </Tap>
          ))}
        </ScrollView>
      </Sheet>

      <Sheet open={!!target && !action} onClose={() => setTarget(undefined)} title={target ? `${animalLabel(target.cow)}: ¿qué pasó?` : ""}>
        <View style={{ gap: 10 }}>
          {canEdit ? (
            <>
              <Option icon="heart" label="Servicio: monta o inseminación" onPress={() => setAction("servicio")} />
              {target?.status.lastService ? <Option icon="vet" label="Palpación: preñada o vacía" onPress={() => setAction("diagnostico")} /> : null}
              {target?.status.state === "prenada" && !target.status.dried ? <Option icon="milk" label="Secado" onPress={() => setAction("secado")} /> : null}
              <Option icon="tag" label="Parto: registrar la cría" onPress={() => { const id = target!.cow.id; setTarget(undefined); router.push({ pathname: "/animal/nuevo", params: { motherId: id } }); }} />
            </>
          ) : null}
          <Option icon="cow" label="Ver ficha" onPress={() => { const id = target!.cow.id; setTarget(undefined); router.push({ pathname: "/animal/[id]", params: { id } }); }} />
        </View>
      </Sheet>

      <Sheet open={!!target && !!action} onClose={() => setAction(undefined)} title={{ servicio: "Servicio", diagnostico: "Palpación", secado: "Secado" }[action ?? "servicio"]}>
        {target && action ? (
          <ReproForm action={action} after={action === "diagnostico" ? target.status.lastService : undefined} onSave={async (date, notes) => {
            await recordSimple(db, farmId, [target.cow.id], action, date, notes);
            setSaved(`Guardado para ${animalLabel(target.cow)}`);
            setAction(undefined);
            setTarget(undefined);
            reload();
          }} />
        ) : null}
      </Sheet>
    </View>
  );
}

function Option({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.option}>
      <View style={s.optionIc}><Icon name={icon} color={colors.rosa} size={20} /></View>
      <Txt w="bold" size={16} style={{ flex: 1 }}>{label}</Txt>
      <Icon name="chevron" color={colors.textMuted} size={18} />
    </Tap>
  );
}

function ReproForm({ action, after, onSave }: { action: Action; after?: string; onSave: (date: string, notes?: string) => void }) {
  const [date, setDate] = useState(splitDay(todayDay()));
  const [how, setHow] = useState<"monta" | "ia">("monta");
  const [who, setWho] = useState("");
  const [result, setResult] = useState<"preñada" | "vacia">("preñada");
  const day = toDay(date);
  const valid = !!day && day <= todayDay() && (!after || day >= after) && (action !== "servicio" || !!who.trim());
  return (
    <View style={{ gap: 12 }}>
      {action === "servicio" ? (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Monta" active={how === "monta"} onPress={() => setHow("monta")} />
            <Chip label="Inseminación" active={how === "ia"} onPress={() => setHow("ia")} />
          </View>
          <Field label={how === "monta" ? "Toro" : "Pajilla (código o raza)"} value={who} onChangeText={setWho} placeholder={how === "monta" ? "Ej: Capitán" : "Ej: Holstein 7HO1234"} />
        </>
      ) : null}
      {action === "diagnostico" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Preñada" active={result === "preñada"} onPress={() => setResult("preñada")} />
          <Chip label="Vacía" active={result === "vacia"} onPress={() => setResult("vacia")} />
        </View>
      ) : null}
      <DateField label="Fecha" value={date} onChange={setDate} />
      {day && after && day < after ? <Txt size={13} color={colors.danger}>{`La palpación va después del servicio (${shortDate(after)}).`}</Txt> : null}
      {day && day > todayDay() ? <Txt size={13} color={colors.danger}>La fecha no puede ser futura.</Txt> : null}
      <Button label="Guardar" disabled={!valid} onPress={() => onSave(day!, action === "servicio" ? `${how}: ${who.trim()}` : action === "diagnostico" ? result : undefined)} />
    </View>
  );
}

const s = StyleSheet.create({
  main: { paddingTop: 14, paddingHorizontal: 16, gap: 14 },
  stat: { flex: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 20, padding: 12, ...shadow },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  soon: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.tierraSoft },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 18, backgroundColor: colors.crema },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.crema },
  optionIc: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.rosaSoft, alignItems: "center", justifyContent: "center" },
});
