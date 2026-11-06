import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { addDays, animalLabel, colors, plural, shadow, shortDate, todayDay, type AnimalEvent } from "@trazagro/shared";
import { waitingList } from "../db/campo";
import { listAnimals, listFarmEvents, listProducts } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { Chip, Empty, GreenHeader, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { Badge, Bar, HeaderAction, SectionLabel, Tag } from "../ui/campo/parts";

type HealthType = "vacuna" | "tratamiento" | "desparasitacion";
const HEALTH: HealthType[] = ["vacuna", "tratamiento", "desparasitacion"];
const META: Record<HealthType, { label: string; short: string; bg: string; fg: string }> = {
  vacuna: { label: "Vacuna", short: "VA", bg: colors.greenSoft, fg: colors.selva },
  tratamiento: { label: "Tratamiento", short: "TR", bg: colors.dangerSoft, fg: colors.danger },
  desparasitacion: { label: "Desparasitación", short: "DP", bg: colors.tierraSoft, fg: colors.tierraDeep },
};
const FILTERS: { id: HealthType | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" }, { id: "vacuna", label: "Vacunas" }, { id: "tratamiento", label: "Tratamientos" }, { id: "desparasitacion", label: "Desparasitación" },
];

/** Salud del hato (Salud.dc) with the withdrawal list (DiasEspera.dc) and the clinical history. */
export default function SaludScreen() {
  const router = useRouter();
  const farmId = useFarmId();
  const { farm, can } = useFarm();
  const canEdit = can("events");
  const today = todayDay();
  const [filter, setFilter] = useState<HealthType | "todos">("todos");
  const { data } = useDbQuery(async (d) => {
    const [animals, events, products] = await Promise.all([listAnimals(d, farmId), listFarmEvents(d, farmId), listProducts(d, farmId)]);
    return { animals, events, products };
  }, [farmId]);

  const animals = data?.animals ?? [];
  const events = data?.events ?? [];
  const products = data?.products ?? [];
  const byId = new Map(animals.map((a) => [a.id, a]));
  const waiting = data ? waitingList(animals, events, products, today) : [];
  const yearAgo = addDays(today, -365);
  const vaccinated = new Set(events.filter((e) => e.type === "vacuna" && e.date >= yearAgo).map((e) => e.animalId));
  const covered = animals.filter((a) => vaccinated.has(a.id)).length;
  const pct = animals.length ? Math.round((covered / animals.length) * 100) : 0;
  const health = events.filter((e) => (HEALTH as string[]).includes(e.type) && byId.has(e.animalId));
  const thisMonth = health.filter((e) => e.date.slice(0, 7) === today.slice(0, 7)).length;
  const recent = groupHistory(health.filter((e) => e.date >= addDays(today, -90) && (filter === "todos" || e.type === filter)));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <GreenHeader back kicker={farm?.name.toUpperCase() ?? ""} title="Salud del hato" waveHeight={40}
        right={canEdit ? <HeaderAction label="Registrar" accessibilityLabel="Registrar vacuna o tratamiento" onPress={() => router.push({ pathname: "/evento/nuevo", params: { kind: "vacuna" } })} /> : undefined} />

      <View style={s.main}>
        <Rise index={0} style={s.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Txt w="extrabold" size={15}>Vacunación al día</Txt>
            <Txt w="extrabold" size={22} color={colors.selva}>{animals.length ? `${pct}%` : "—"}</Txt>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`Vacunación al día: ${pct} por ciento`}>
            <Bar pct={pct} color={colors.link} track={colors.greenSoft} height={10} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Stat value={thisMonth} label="eventos este mes" />
            <Stat value={waiting.length} label="en días de espera" color={waiting.length ? colors.danger : undefined} />
            <Stat value={animals.length - covered} label="por vacunar (1 año)" color={animals.length - covered ? colors.amberText : undefined} />
          </View>
        </Rise>

        <Rise index={1} style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <SectionLabel>{`Días de espera · ${plural(waiting.length, "animal", "animales")}`}</SectionLabel>
            <Txt size={13} color={colors.textMuted}>Animales tratados que todavía no pueden venderse para carne o leche.</Txt>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[s.tile, { backgroundColor: colors.warnSoft }]}>
              <Icon name="drop" color={colors.amberText} size={22} />
              <Txt w="extrabold" size={28} color={colors.amberText}>{waiting.filter((w) => w.milk).length}</Txt>
              <Txt w="bold" size={13} color={colors.amberText}>Sin vender leche</Txt>
            </View>
            <View style={[s.tile, { backgroundColor: colors.dangerSoft }]}>
              <Icon name="alert" color={colors.urgentText} size={22} />
              <Txt w="extrabold" size={28} color={colors.urgentText}>{waiting.filter((w) => w.meat).length}</Txt>
              <Txt w="bold" size={13} color={colors.urgentText}>Sin sacrificio</Txt>
            </View>
          </View>
          {data && !waiting.length ? <Empty title="Ninguno en espera" text="Toda la leche y la carne se pueden vender." /> : null}
          {waiting.map((w) => {
            const kind = w.milk && w.meat ? "Leche y carne" : w.milk ? "Leche" : "Carne";
            const red = w.meat;
            return (
              <Tap key={w.animal.id} accessibilityRole="button" accessibilityLabel={`${animalLabel(w.animal)}: ${kind}, libre el ${shortDate(w.until, today)}`}
                onPress={() => router.push({ pathname: "/animal/[id]", params: { id: w.animal.id } })} style={s.waitCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Badge text={w.animal.tagVisual ? w.animal.tagVisual.slice(-3) : "—"} bg={colors.greenSoft} fg={colors.selva} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt w="extrabold" size={16}>{[w.animal.name, w.animal.tagVisual && `#${w.animal.tagVisual}`].filter(Boolean).join(" · ")}</Txt>
                    <Txt size={13} color={colors.textMuted}>{[w.product, shortDate(w.applied, today)].filter(Boolean).join(" · ")}</Txt>
                  </View>
                  <Tag label={kind} size={12} bg={red ? colors.dangerSoft : colors.warnSoft} fg={red ? colors.urgentText : colors.amberText} />
                </View>
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Txt size={13} color={colors.textMuted}>Faltan <Txt w="bold" size={13}>{w.daysLeft === 0 ? "menos de 1 día" : plural(w.daysLeft, "día", "días")}</Txt></Txt>
                    <Txt w="bold" size={13}>{`Libre el ${shortDate(addDays(w.until, 1), today)}`}</Txt>
                  </View>
                  <Bar pct={w.pct} color={red ? colors.urgent : "#F9A825"} />
                  {w.milk && w.meat ? (
                    <Txt size={12} color={colors.textMuted}>{`Leche hasta ${shortDate(w.milkUntil!, today)} · Carne hasta ${shortDate(w.meatUntil!, today)}`}</Txt>
                  ) : null}
                </View>
              </Tap>
            );
          })}
        </Rise>

        <Rise index={2} style={{ gap: 10 }}>
          <SectionLabel>Historial · últimos 90 días</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FILTERS.map((f) => <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />)}
          </ScrollView>
          {data && !recent.length ? <Empty title="Sin registros" text="Las vacunas y tratamientos que anotes aparecen aquí." /> : null}
          {recent.slice(0, 40).map((g) => {
            const m = META[g.type];
            const p = products.find((x) => x.id === g.productId);
            const one = g.animalIds.length === 1 ? byId.get(g.animalIds[0]!) : undefined;
            const who = one
              ? [one.name, one.tagVisual && `#${one.tagVisual}`].filter(Boolean).join(" · ")
              : `${plural(g.animalIds.length, "animal", "animales")} · ${g.animalIds.slice(0, 3).map((id) => byId.get(id)?.name ?? `#${byId.get(id)?.tagVisual ?? "?"}`).join(", ")}${g.animalIds.length > 3 ? "…" : ""}`;
            const body = (
              <>
                <Badge text={m.short} bg={m.bg} fg={m.fg} />
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Txt w="extrabold" size={15}>{p ? `${m.label} · ${p.name}` : m.label}</Txt>
                  <Txt size={13} color={colors.textMuted}>{who}</Txt>
                  {g.dose || g.notes ? <Txt size={12} color={colors.textMuted}>{[g.dose && `${g.dose}${g.animalIds.length > 1 ? " c/u" : ""}`, g.notes].filter(Boolean).join(" · ")}</Txt> : null}
                </View>
                <Txt w="bold" size={12} color={colors.textMuted}>{shortDate(g.date, today)}</Txt>
              </>
            );
            return one ? (
              <Tap key={g.key} accessibilityRole="button" accessibilityLabel={`${m.label} de ${animalLabel(one)}`} onPress={() => router.push({ pathname: "/animal/[id]", params: { id: one.id } })} style={s.hist}>{body}</Tap>
            ) : <View key={g.key} style={s.hist}>{body}</View>;
          })}
        </Rise>
        <Txt size={12} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 18 }}>El tiempo de espera se calcula solo con el producto que registras.</Txt>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label, color = colors.text }: { value: number; label: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt w="extrabold" size={18} color={color}>{value}</Txt>
      <Txt size={12} color={colors.textMuted}>{label}</Txt>
    </View>
  );
}

interface HistoryGroup { key: string; type: HealthType; date: string; productId?: string; dose?: string; notes?: string; animalIds: string[] }

/** One row per application: the same product, dose and day given to several animals reads as one job. */
function groupHistory(events: AnimalEvent[]): HistoryGroup[] {
  const map = new Map<string, HistoryGroup>();
  for (const e of events) {
    const key = [e.type, e.date, e.productId ?? "", e.dose ?? "", e.notes ?? "", e.createdAt.slice(0, 16)].join("|");
    const g = map.get(key) ?? { key, type: e.type as HealthType, date: e.date, productId: e.productId, dose: e.dose, notes: e.notes, animalIds: [] };
    g.animalIds.push(e.animalId);
    map.set(key, g);
  }
  return [...map.values()].sort((x, y) => y.date.localeCompare(x.date));
}

const s = StyleSheet.create({
  main: { paddingTop: 14, paddingHorizontal: 16, gap: 18 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 12, ...shadow },
  tile: { flex: 1, borderRadius: 22, padding: 16, gap: 4 },
  waitCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 12, ...shadow },
  hist: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 20, ...shadow },
});
