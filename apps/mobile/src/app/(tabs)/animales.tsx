import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { animalLabel, categoryOf, colors, fonts, inWithdrawal, radius, shadow, todayDay, withdrawalFor, type Animal } from "@trazagro/shared";
import { getFarm, listAllAnimals, listFarmEvents, listLots, listProducts } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { useDbQuery } from "../../lib/useDb";
import { Icon } from "../../ui/Icon";
import { Chip, EarTag, Empty, GreenHeader, Txt } from "../../ui/kit";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

type Filter = "todos" | "hembras" | "machos" | "retiro" | `lote:${string}`;

export default function AnimalesScreen() {
  const { farm, role } = useFarm();
  const canEdit = role !== "solo_ver";
  const id = farm?.id ?? "";
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const { data } = useDbQuery(async (db) => {
    const [farm, all, events, products, lots] = await Promise.all([getFarm(db, id), listAllAnimals(db, id), listFarmEvents(db, id), listProducts(db, id), listLots(db, id)]);
    const animals = all.filter((a) => a.status === "activo").sort((x, y) => (x.tagVisual ?? x.name ?? "").localeCompare(y.tagVisual ?? y.name ?? ""));
    return { farm, all, animals, events, products, lots };
  }, [id]);

  const today = todayDay();
  const rows = useMemo(() => {
    if (!data) return [];
    const lotName = new Map(data.lots.map((l) => [l.id, l.name.split(" · ")[0]]));
    return data.animals.map((a) => {
      const ev = data.events.filter((e) => e.animalId === a.id);
      const births = ev.filter((e) => e.type === "parto").length;
      const w = inWithdrawal(withdrawalFor(ev, data.products), today);
      return { a, category: categoryOf(a.sex, a.birthDate, births, today), retiro: w.meat || w.milk, lot: a.lotId ? lotName.get(a.lotId) : undefined };
    });
  }, [data, today]);

  const shown = rows.filter(({ a, retiro }) => {
    if (filter === "hembras" && a.sex !== "hembra") return false;
    if (filter === "machos" && a.sex !== "macho") return false;
    if (filter === "retiro" && !retiro) return false;
    if (filter.startsWith("lote:") && a.lotId !== filter.slice(5)) return false;
    const needle = q.trim().toLowerCase();
    const bare = needle.replace(/\s/g, "");
    return !needle || [a.name, a.tagVisual].some((v) => v?.toLowerCase().includes(needle)) || (!!bare && !!a.rfid?.replace(/\s/g, "").includes(bare));
  });
  const enRetiro = rows.filter((r) => r.retiro).length;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.a.id}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 80 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <GreenHeader kicker={data?.farm?.name.toUpperCase() ?? ""} title={`Animales ${rows.length || ""}`}
              right={!canEdit ? undefined : (
                <Pressable accessibilityRole="button" accessibilityLabel="Registrar vacuna, pesaje o parto" style={s.register}
                  onPress={() => router.push({ pathname: "/evento/nuevo", params: { farmId: id } })}>
                  <Icon name="plus" color={colors.selva} size={18} />
                  <Txt w="bold" size={14} color={colors.selva}>Registrar</Txt>
                </Pressable>
              )}>
              <View style={s.search}>
                <Icon name="search" color={colors.textMuted} size={20} />
                <TextInput value={q} onChangeText={setQ} placeholder="Nombre, arete o RFID" placeholderTextColor="#8A938D"
                  style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, minHeight: 44 }} accessibilityLabel="Buscar animal" />
              </View>
            </GreenHeader>
            <View style={s.filters}>
              {(["todos", "hembras", "machos", "retiro"] as const).map((f) => (
                <Chip key={f} active={filter === f} onPress={() => setFilter(f)}
                  label={{ todos: "Todos", hembras: "Hembras", machos: "Machos", retiro: `En retiro ${enRetiro}` }[f]} />
              ))}
              {(data?.lots.length ?? 0) > 1 ? data!.lots.map((l) => (
                <Chip key={l.id} active={filter === `lote:${l.id}`} onPress={() => setFilter(filter === `lote:${l.id}` ? "todos" : `lote:${l.id}`)} label={l.name.split(" · ")[0]!} />
              )) : null}
            </View>
          </>
        }
        ListEmptyComponent={data ? <Empty title="No hay animales" text={q || filter !== "todos" ? "Prueba con otra búsqueda o filtro." : "Registra el primero con el botón de abajo."} /> : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item: { a, category, retiro, lot } }) => <AnimalRow a={a} category={category} retiro={retiro} lot={lot} />}
      />
      {canEdit ? <Pressable accessibilityRole="button" accessibilityLabel="Registrar un animal nuevo" style={s.fab}
        onPress={() => router.push({ pathname: "/animal/nuevo", params: { farmId: id } })}>
        <Icon name="plus" color={colors.onDark} />
        <Txt w="bold" size={16} color={colors.onDark}>Nuevo animal</Txt>
      </Pressable> : null}
    </View>
  );
}

function AnimalRow({ a, category, retiro, lot }: { a: Animal; category: string; retiro: boolean; lot?: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push({ pathname: "/animal/[id]", params: { id: a.id } })}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <EarTag code={a.tagVisual} tone={a.sex === "macho" ? colors.tierra : colors.selva} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={17}>{animalLabel(a)}{a.tagVisual ? <Txt w="medium" size={14} color={colors.textMuted}>  #{a.tagVisual}</Txt> : null}</Txt>
        <Txt size={13} color={colors.textMuted}>{[a.breed, category, lot].filter(Boolean).join(" · ")}</Txt>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {retiro ? <Chip label="Días de retiro" tone={{ bg: colors.warnSoft, fg: colors.warn }} /> : null}
        {!a.rfid ? <Txt size={12} color={colors.textMuted}>Sin RFID</Txt> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  search: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 16 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  row: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, flexDirection: "row", alignItems: "center", gap: 14, ...shadow },
  register: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.lima, flexDirection: "row", alignItems: "center", gap: 6 },
  fab: { position: "absolute", right: 18, bottom: TAB_BAR_SPACE, minHeight: 56, borderRadius: radius.pill, paddingHorizontal: 22, backgroundColor: colors.tierra, flexDirection: "row", gap: 8, alignItems: "center", ...shadow, shadowColor: "#4E342E", shadowOpacity: 0.35 },
});
