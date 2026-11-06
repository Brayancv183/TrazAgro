import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { animalLabel, colors, fonts, shadow } from "@trazagro/shared";
import { loadHerd, type HerdRow } from "../../db/animales";
import { useFarm } from "../../lib/farm";
import { useDbQuery } from "../../lib/useDb";
import { Icon } from "../../ui/Icon";
import { Chip, EarTag, Empty, Fab, Kicker, Pill, tagTone, Txt, Wave } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { TAB_BAR_SPACE } from "../../ui/TabBar";
import { AnimalSheet } from "../../ui/animales/AnimalSheet";
import { FiltersSheet, passes, type FilterKey } from "../../ui/animales/FiltersSheet";

type Quick = "todos" | "hembras" | "machos" | "alerta" | "prenadas";
const QUICK: { id: Quick; label: string }[] = [
  { id: "todos", label: "Todos" }, { id: "hembras", label: "Hembras" }, { id: "machos", label: "Machos" },
  { id: "alerta", label: "Con alerta" }, { id: "prenadas", label: "Preñadas" },
];

export default function AnimalesScreen() {
  const { farm, role } = useFarm();
  const canEdit = role !== "solo_ver";
  const id = farm?.id ?? "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<Quick>("todos");
  const [on, setOn] = useState<Set<FilterKey>>(new Set());
  const [filtering, setFiltering] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const { data, reload } = useDbQuery((db) => loadHerd(db, id), [id]);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const lots = data?.lots ?? [];

  const bySheet = rows.filter((r) => passes(r, on, lots));
  const shown = bySheet.filter(({ a, alert, repro }) => {
    if (quick === "hembras" && a.sex !== "hembra") return false;
    if (quick === "machos" && a.sex !== "macho") return false;
    if (quick === "alerta" && !(alert && alert.tone !== "info")) return false;
    if (quick === "prenadas" && repro?.state !== "prenada") return false;
    const needle = q.trim().toLowerCase();
    const bare = needle.replace(/\s/g, "");
    return !needle || [a.name, a.tagVisual].some((v) => v?.toLowerCase().includes(needle)) || (!!bare && !!a.rfid?.replace(/\s/g, "").includes(bare));
  });
  const open = rows.find((r) => r.a.id === openId);

  const header = (
    <>
      <View style={[s.header, { paddingTop: insets.top + 20 }]}>
        <View style={s.headTop}>
          <View style={{ gap: 4, flex: 1 }}>
            <Kicker>{data?.farm?.name.toUpperCase() ?? " "}</Kicker>
            <Txt w="extrabold" size={32} color={colors.onDark} style={{ letterSpacing: -0.64, lineHeight: 34 }}>
              Animales{rows.length ? <Txt w="extrabold" size={32} color={colors.lima}>{` ${rows.length}`}</Txt> : null}
            </Txt>
          </View>
          {canEdit ? (
            <Tap accessibilityRole="link" accessibilityLabel="Importar animales" onPress={() => router.push("/ajustes")} style={s.import}>
              <Txt w="semibold" size={13} color={colors.onDark}>Importar</Txt>
            </Tap>
          ) : null}
        </View>
        <View style={s.searchRow}>
          <View style={s.search}>
            <Icon name="search" color={colors.textMuted} size={20} />
            <TextInput value={q} onChangeText={setQ} placeholder="Nombre, arete o RFID" placeholderTextColor="#8A938D"
              style={s.searchInput} accessibilityLabel="Buscar animal" />
          </View>
          <Tap accessibilityRole="button" accessibilityLabel={on.size ? `Más filtros, ${on.size} activos` : "Más filtros"} onPress={() => setFiltering(true)} style={s.filterBtn}>
            <Icon name="filter" color={colors.selva} size={22} width={2.2} />
            {on.size ? <View style={s.badge}><Txt w="extrabold" size={11} color={colors.lima}>{on.size}</Txt></View> : null}
          </Tap>
        </View>
      </View>
      <Wave height={44} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Filtro rápido" contentContainerStyle={s.chips} style={{ flexGrow: 0 }}>
        {QUICK.map((f) => (
          <Chip key={f.id} label={f.label} active={quick === f.id && !(f.id === "todos" && on.size > 0)} onPress={() => { setQuick(f.id); if (f.id === "todos") setOn(new Set()); }} />
        ))}
      </ScrollView>
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.a.id}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 80 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={data ? <Empty title="No hay animales" text={q || quick !== "todos" || on.size ? "Prueba con otra búsqueda o filtro." : "Registra el primero con el botón Nuevo."} /> : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item, index }) => <Row r={item} index={index} onPress={() => setOpenId(item.a.id)} />}
      />
      {canEdit ? <Fab label="Nuevo" accessibilityLabel="Registrar un animal nuevo" onPress={() => router.push({ pathname: "/animal/nuevo", params: { farmId: id } })} /> : null}

      <FiltersSheet open={filtering} onClose={() => setFiltering(false)} on={on} setOn={setOn} lots={lots} count={bySheet.length} total={rows.length} />
      <AnimalSheet row={open} onClose={() => setOpenId(undefined)} canEdit={canEdit} onChanged={reload} />
    </View>
  );
}

function Row({ r, index, onPress }: { r: HerdRow; index: number; onPress: () => void }) {
  const { a, alert } = r;
  const label = animalLabel(a);
  return (
    <Rise index={Math.min(index, 8) + 1} style={{ paddingHorizontal: 16 }}>
      <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${a.tagVisual ? ` ${a.tagVisual}` : ""}`} style={s.row}>
        <EarTag code={a.tagVisual} tone={tagTone(a.sex)} size={40} />
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Txt w="bold" size={17} numberOfLines={1}>{label}</Txt>
          <Txt size={13} color={colors.textMuted} numberOfLines={1}>{[a.breed ?? r.category.charAt(0).toUpperCase() + r.category.slice(1), r.lotShort ?? "Sin lote"].join(" · ")}</Txt>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          {a.rfid ? <Pill label="RFID" tone="earth" /> : <Pill label="Sin RFID" tone="muted" />}
          {alert ? <Pill label={alert.label} tone={alert.tone} /> : null}
        </View>
      </Tap>
    </Rise>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.selva, paddingHorizontal: 18, paddingBottom: 8 },
  headTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  import: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: colors.glassLine, alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", gap: 8, paddingTop: 14, marginHorizontal: -2 },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: 52, paddingHorizontal: 18, backgroundColor: colors.card, borderRadius: 26 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 15, color: colors.text, height: 50, outlineStyle: "none" } as object,
  filterBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.selva, borderWidth: 2, borderColor: colors.lima, alignItems: "center", justifyContent: "center" },
  chips: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 14, backgroundColor: colors.card, borderRadius: 22, ...shadow },
});
