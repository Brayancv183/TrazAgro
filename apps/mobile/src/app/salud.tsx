import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { animalLabel, addDays, colors, inWithdrawal, plural, radius, shadow, shortDate, todayDay, withdrawalFor } from "@trazagro/shared";
import { listAnimals, listFarmEvents, listProducts } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { Button, Card, EarTag, Empty, GreenHeader, Txt } from "../ui/kit";

const HEALTH = ["vacuna", "tratamiento", "desparasitacion"] as const;
const LABEL = { vacuna: "Vacuna", tratamiento: "Tratamiento", desparasitacion: "Desparasitación" } as const;

/** Who is in withdrawal (can't sell milk or meat), vaccination coverage and the last health records. */
export default function SaludScreen() {
  const router = useRouter();
  const farmId = useFarmId();
  const canEdit = useFarm().can("events");
  const today = todayDay();
  const { data } = useDbQuery(async (d) => {
    const [animals, events, products] = await Promise.all([listAnimals(d, farmId), listFarmEvents(d, farmId), listProducts(d, farmId)]);
    return { animals, events, products };
  }, [farmId]);

  const animals = data?.animals ?? [];
  const events = data?.events ?? [];
  const products = data?.products ?? [];
  const inRetiro = animals
    .map((a) => {
      const w = withdrawalFor(events.filter((e) => e.animalId === a.id), products);
      return { a, w, on: inWithdrawal(w, today) };
    })
    .filter((x) => x.on.milk || x.on.meat);
  const yearAgo = addDays(today, -365);
  const vaccinated = new Set(events.filter((e) => e.type === "vacuna" && e.date >= yearAgo).map((e) => e.animalId));
  const covered = animals.filter((a) => vaccinated.has(a.id)).length;
  const dewormed = new Set(events.filter((e) => e.type === "desparasitacion" && e.date >= addDays(today, -120)).map((e) => e.animalId));
  const recent = events.filter((e) => (HEALTH as readonly string[]).includes(e.type) && e.date >= addDays(today, -90)).sort((x, y) => y.date.localeCompare(x.date));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker="HATO" title="Salud">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>{data ? `${plural(inRetiro.length, "animal en retiro", "animales en retiro")}` : "Cargando…"}</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat value={animals.length ? `${Math.round((covered / animals.length) * 100)}%` : "—"} label="vacunados en el año" />
          <Stat value={animals.length ? `${Math.round((animals.filter((a) => dewormed.has(a.id)).length / animals.length) * 100)}%` : "—"} label="desparasitados (4 meses)" />
        </View>
        {canEdit ? <Button icon="syringe" label="Registrar vacuna o tratamiento" onPress={() => router.push({ pathname: "/evento/nuevo", params: { kind: "vacuna" } })} /> : null}

        <Txt w="extrabold" size={19} style={{ marginTop: 6 }}>En días de retiro</Txt>
        <Txt size={13} color={colors.textMuted}>No vender su leche ni sacrificarlos hasta la fecha indicada.</Txt>
        {data && !inRetiro.length ? <Empty title="Ninguno en retiro" text="Toda la leche y la carne se pueden vender." /> : null}
        {inRetiro.map(({ a, w, on }) => (
          <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/animal/[id]", params: { id: a.id } })} style={s.row}>
            <EarTag code={a.tagVisual} size={38} tone={colors.warn} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="bold" size={16}>{animalLabel(a)}</Txt>
              <Txt size={13} color={colors.warn}>{[on.milk && `Leche hasta ${shortDate(w.milkUntil!, today)}`, on.meat && `Carne hasta ${shortDate(w.meatUntil!, today)}`].filter(Boolean).join(" · ")}</Txt>
            </View>
            <Icon name="chevron" color={colors.textMuted} size={18} />
          </Pressable>
        ))}

        <Txt w="extrabold" size={19} style={{ marginTop: 6 }}>Últimos 90 días</Txt>
        {data && !recent.length ? <Empty title="Sin registros" text="Las vacunas y tratamientos que anotes aparecen aquí." /> : null}
        {recent.length ? (
          <Card style={{ paddingVertical: 4 }}>
            {recent.slice(0, 30).map((e, i) => {
              const a = animals.find((x) => x.id === e.animalId);
              const p = products.find((x) => x.id === e.productId);
              return (
                <View key={e.id} style={[s.line, i < Math.min(recent.length, 30) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                  <View style={{ flex: 1 }}>
                    <Txt w="bold" size={15}>{LABEL[e.type as keyof typeof LABEL]} · {a?.name ?? `#${a?.tagVisual ?? "?"}`}</Txt>
                    <Txt size={13} color={colors.textMuted}>{[p?.name, e.dose].filter(Boolean).join(" · ") || e.notes || ""}</Txt>
                  </View>
                  <Txt w="semibold" size={13} color={colors.textMuted}>{shortDate(e.date, today)}</Txt>
                </View>
              );
            })}
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Txt w="extrabold" size={26}>{value}</Txt>
      <Txt size={13} color={colors.textMuted}>{label}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
});
