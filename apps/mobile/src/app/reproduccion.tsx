import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { animalLabel,
  colors, monthsBetween, plural, radius, REPRO_LABEL, reproStatus, shadow, shortDate, todayDay,
  type Animal, type ReproState, type ReproStatus,
} from "@trazagro/shared";
import { listAnimals, listFarmEvents, recordSimple } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { DateField, splitDay, toDay } from "../ui/DateField";
import { Banner, Button, Chip, EarTag, Empty, Field, GreenHeader, Sheet, Txt } from "../ui/kit";

const STATE_TONE: Record<ReproState, { bg: string; fg: string }> = {
  prenada: { bg: colors.limaSoft, fg: colors.selva },
  servida: { bg: colors.infoSoft, fg: colors.info },
  parida: { bg: colors.rosaSoft, fg: colors.rosa },
  vacia: { bg: colors.warnSoft, fg: colors.warn },
};

type Action = "servicio" | "diagnostico" | "secado";

/** Breeding females with their cycle: service, pregnancy check, dry-off and calving. */
export default function ReproduccionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const farmId = useFarmId();
  const canEdit = useFarm().can("events");
  const today = todayDay();
  const [filter, setFilter] = useState<ReproState | "todas">("todas");
  const [target, setTarget] = useState<{ cow: Animal; status: ReproStatus }>();
  const [action, setAction] = useState<Action>();
  const [saved, setSaved] = useState<string>();
  const { data, reload } = useDbQuery(async (d) => {
    const [animals, events] = await Promise.all([listAnimals(d, farmId), listFarmEvents(d, farmId)]);
    return animals
      .filter((a) => a.sex === "hembra" && monthsBetween(a.birthDate, today) >= 15)
      .map((cow) => ({ cow, status: reproStatus(events.filter((e) => e.animalId === cow.id), today) }));
  }, [farmId]);

  const rows = (data ?? []).filter((r) => filter === "todas" || r.status.state === filter);
  const count = (st: ReproState) => (data ?? []).filter((r) => r.status.state === st).length;

  function next(st: ReproStatus) {
    if (st.state === "prenada") return st.dried ? `Parto esperado ${shortDate(st.expectedCalving!, today)}` : `Secar ${shortDate(st.dryOffOn!, today)} · parto ${shortDate(st.expectedCalving!, today)}`;
    if (st.state === "servida") return `${st.checkOn! <= today ? "Ya se puede palpar" : `Palpar desde ${shortDate(st.checkOn!, today)}`} · servida ${shortDate(st.lastService!, today)}`;
    if (st.state === "vacia" && st.lastService) return `Vacía en la palpación · servida ${shortDate(st.lastService, today)}`;
    if (st.openDays !== undefined) return `${st.openDays} días abierta · parió ${shortDate(st.lastCalving!, today)}`;
    return "Sin servicios registrados";
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <GreenHeader back kicker="HATO" title="Reproducción">
          <Txt w="medium" size={15} color={colors.onDarkMuted}>
            {data ? `${plural(count("prenada"), "preñada", "preñadas")} · ${plural(count("servida"), "por palpar", "por palpar")} · ${plural(count("vacia") + count("parida"), "vacía", "vacías")}` : "Cargando…"}
          </Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {saved ? <Banner icon="check" tone="ok" title={saved} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Todas" active={filter === "todas"} onPress={() => setFilter("todas")} />
            {(["prenada", "servida", "parida", "vacia"] as const).map((st) => <Chip key={st} label={`${REPRO_LABEL[st]} ${count(st)}`} active={filter === st} onPress={() => setFilter(st)} />)}
          </View>
          {data && !rows.length ? <Empty title="Ninguna en este grupo" text="Las hembras de más de 15 meses aparecen aquí." /> : null}
          {rows.map(({ cow, status }) => (
            <Pressable key={cow.id} accessibilityRole="button" accessibilityLabel={`Registrar para ${animalLabel(cow)}`}
              onPress={() => { setSaved(undefined); setTarget({ cow, status }); }} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
              <EarTag code={cow.tagVisual} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="bold" size={16}>{animalLabel(cow)}</Txt>
                <Txt size={13} color={colors.textMuted}>{next(status)}</Txt>
              </View>
              <View style={[s.badge, { backgroundColor: STATE_TONE[status.state].bg }]}>
                <Txt w="bold" size={12} color={STATE_TONE[status.state].fg}>{REPRO_LABEL[status.state]}</Txt>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Sheet open={!!target && !action} onClose={() => setTarget(undefined)} title={target ? `${animalLabel(target.cow)}: ¿qué pasó?` : ""}>
        {canEdit ? (
          <>
            <Button kind="soft" label="Servicio: monta o inseminación" onPress={() => setAction("servicio")} />
            {target?.status.lastService ? <Button kind="soft" label="Palpación: preñada o vacía" onPress={() => setAction("diagnostico")} /> : null}
            {target?.status.state === "prenada" && !target.status.dried ? <Button kind="soft" label="Secado" onPress={() => setAction("secado")} /> : null}
            <Button kind="soft" label="Parto: registrar la cría" onPress={() => { const id = target!.cow.id; setTarget(undefined); router.push({ pathname: "/animal/nuevo", params: { motherId: id } }); }} />
          </>
        ) : null}
        <Button kind="soft" label="Ver ficha" onPress={() => { const id = target!.cow.id; setTarget(undefined); router.push({ pathname: "/animal/[id]", params: { id } }); }} />
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
