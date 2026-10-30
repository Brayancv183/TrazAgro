import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Circle } from "react-native-svg";
import { addDays, canSeeMoney, colors, farmAlerts, noveltiesFor, plural, radius, shadow, todayDay, type AlertLevel } from "@trazagro/shared";
import { loadFarmBundle } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { loadSession } from "../../lib/session";
import { useDbQuery } from "../../lib/useDb";
import { runSync, syncStatus } from "../../sync/engine";
import { Icon, type IconName } from "../../ui/Icon";
import { Button, Empty, GreenHeader, Kicker, MenuRow, Sheet, Txt } from "../../ui/kit";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

type Backup = { kind: "none" } | { kind: "syncing" } | { kind: "ok"; pending: number } | { kind: "offline"; pending: number };

const LEVEL_COLOR: Record<AlertLevel, string> = { alta: colors.danger, media: colors.warn, info: colors.info };

const CREATE: { icon: IconName; title: string; detail: string; href: Href; money?: boolean }[] = [
  { icon: "tag", title: "Animal", detail: "Nacido en la finca o comprado", href: "/animal/nuevo" },
  { icon: "syringe", title: "Vacuna o tratamiento", detail: "A uno o a varios animales", href: { pathname: "/evento/nuevo", params: { kind: "vacuna" } } },
  { icon: "scale", title: "Pesaje", detail: "Báscula o cinta", href: { pathname: "/evento/nuevo", params: { kind: "pesaje" } } },
  { icon: "heart", title: "Parto", detail: "Registra la cría con su madre", href: { pathname: "/evento/nuevo", params: { kind: "parto" } } },
  { icon: "milk", title: "Leche del día", detail: "Litros de ordeño", href: "/leche" },
  { icon: "money", title: "Gasto o ingreso", detail: "Para saber cuánto deja la finca", href: "/costos", money: true },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default function InicioScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { farm, farms, role, refresh } = useFarm();
  const money = canSeeMoney(role);
  const [backup, setBackup] = useState<Backup>();
  const [creating, setCreating] = useState(false);
  const today = todayDay();
  const { data, reload } = useDbQuery(async (d) => (farm ? loadFarmBundle(d, farm.id) : null), [farm?.id]);

  // Sync quietly whenever Inicio comes into focus; failures (no signal) just show the pending count.
  useFocusEffect(useCallback(() => {
    let alive = true;
    refresh();
    (async () => {
      const session = await loadSession();
      if (!session) return alive && setBackup({ kind: "none" });
      setBackup({ kind: "syncing" });
      try {
        const r = await runSync(db, session.token);
        if (r.pulled) { reload(); refresh(); }
        if (alive) setBackup({ kind: "ok", pending: (await syncStatus(db)).pending });
      } catch {
        if (alive) setBackup({ kind: "offline", pending: (await syncStatus(db)).pending });
      }
    })();
    return () => { alive = false; };
  }, [db, reload, refresh]));

  if (farm === null) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
        <GreenHeader kicker="TRAZAGRO" title="Bienvenido" />
        <Empty title="Todavía no tienes fincas" text="Registra tu finca para empezar a llevar tus animales." />
        <View style={{ paddingHorizontal: 16 }}><Button icon="plus" label="Registrar mi finca" onPress={() => router.push("/finca/nueva")} /></View>
      </ScrollView>
    );
  }

  const active = data?.animals.filter((a) => a.status === "activo") ?? [];
  const yearAgo = addDays(today, -365);
  const vaccinated = new Set(data?.events.filter((e) => e.type === "vacuna" && e.date >= yearAgo).map((e) => e.animalId));
  const pct = active.length ? Math.round((active.filter((a) => vaccinated.has(a.id)).length / active.length) * 100) : 0;
  const alerts = data?.farm ? farmAlerts(data.animals, data.events, data.products, noveltiesFor(data.farm, data.animals, data.events, today), today) : [];
  const route = alerts.slice(0, 4);

  const backupText = !backup ? "" : {
    none: "Sin respaldo",
    syncing: "Sincronizando…",
    ok: backup.kind === "ok" && backup.pending ? `${backup.pending} por subir` : "Respaldado",
    offline: `Sin señal · ${backup.kind === "offline" ? backup.pending : 0}`,
  }[backup.kind];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 70 }}>
        <GreenHeader title={greeting()}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cuenta y respaldo" onPress={() => router.push("/cuenta")} style={s.pill}>
                <View style={[s.dot, { backgroundColor: backup?.kind === "ok" ? colors.lima : backup?.kind === "none" ? "#FFD166" : colors.onDarkMuted }]} />
                <Txt w="semibold" size={13} color={colors.onDark}>{backupText || "Cuenta"}</Txt>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Alertas ${alerts.length}`} onPress={() => router.navigate("/alertas")} style={s.bell}>
                <Icon name="bell" color={colors.onDark} size={20} />
                {alerts.length ? <View style={s.bellCount}><Txt w="extrabold" size={11} color={colors.onDark}>{alerts.length}</Txt></View> : null}
              </Pressable>
            </View>
          }>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar de finca" onPress={() => router.push("/fincas")} style={{ alignSelf: "flex-start" }}>
            <Kicker>{farm ? `FINCA · ${farm.municipality.toUpperCase()}` : ""}</Kicker>
            <Txt w="bold" size={18} color={colors.onDark}>{farm?.name ?? "…"}{farms.length > 1 ? "  ▾" : ""}</Txt>
          </Pressable>
        </GreenHeader>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          {farm?.isDemo ? (
            <View style={s.demo}>
              <Icon name="note" color={colors.warn} size={18} />
              <Txt size={13} color={colors.warn} style={{ flex: 1 }}>Estás en la finca de prueba. Registra la tuya desde Módulos → Mis fincas.</Txt>
            </View>
          ) : null}

          <View style={s.hero}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="extrabold" size={40} style={{ letterSpacing: -1 }}>{active.length}</Txt>
              <Txt w="semibold" size={15} color={colors.textMuted}>{active.length === 1 ? "animal bajo control" : "animales bajo control"}</Txt>
              <Pressable onPress={() => router.navigate("/animales")} accessibilityRole="link" style={{ marginTop: 8 }}>
                <Txt w="bold" size={14} color={colors.selva}>Ver el hato →</Txt>
              </Pressable>
            </View>
            <Ring pct={pct} />
          </View>

          <View style={s.sectionHead}>
            <Txt w="extrabold" size={19}>Tu ruta de hoy</Txt>
            <Txt size={13} color={colors.textMuted}>por urgencia</Txt>
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="link" onPress={() => router.push("/agenda")}><Txt w="bold" size={14} color={colors.selva}>Agenda</Txt></Pressable>
          </View>
          {data && !route.length ? <Empty title="Nada urgente" text="No hay retiros, vencimientos ni novedades pendientes." /> : null}
          {route.map((a, i) => (
            <Pressable key={a.id} accessibilityRole="button" style={({ pressed }) => [s.task, pressed && { opacity: 0.85 }]}
              onPress={() => (a.animalId ? router.push({ pathname: "/animal/[id]", params: { id: a.animalId } }) : a.id === "ica" ? router.push("/ica") : a.productId ? router.push("/inventario") : router.navigate("/alertas"))}>
              <View style={[s.num, { backgroundColor: LEVEL_COLOR[a.level] }]}><Txt w="extrabold" size={14} color={colors.onDark}>{i + 1}</Txt></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="bold" size={15}>{a.title}</Txt>
                <Txt size={13} color={colors.textMuted} numberOfLines={2}>{a.detail}</Txt>
              </View>
              <Icon name="chevron" color={colors.textMuted} size={18} />
            </Pressable>
          ))}
          {alerts.length > route.length ? (
            <Pressable accessibilityRole="link" onPress={() => router.navigate("/alertas")} style={{ alignSelf: "center", padding: 8 }}>
              <Txt w="bold" size={14} color={colors.selva}>{`+${plural(alerts.length - route.length, "tarea más", "tareas más")}`}</Txt>
            </Pressable>
          ) : null}

          <Txt w="extrabold" size={19} style={{ marginTop: 6 }}>Accesos rápidos</Txt>
          <View style={s.quickGrid}>
            <Quick icon="note" label="Reporte ICA" onPress={() => router.push("/ica")} />
            {money ? <Quick icon="money" label="Costos" onPress={() => router.push("/costos")} /> : <Quick icon="heart" label="Reproducción" onPress={() => router.push("/reproduccion")} />}
            <Quick icon="milk" label="Leche" onPress={() => router.push("/leche")} />
            {money ? <Quick icon="chart" label="Métricas" onPress={() => router.push("/metricas")} /> : <Quick icon="scale" label="Pesajes" onPress={() => router.push("/pesajes")} />}
          </View>
        </View>
      </ScrollView>

      {role !== "solo_ver" ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Crear registro" onPress={() => setCreating(true)} style={s.fab}>
          <Icon name="plus" color={colors.onDark} size={28} />
        </Pressable>
      ) : null}

      <Sheet open={creating} onClose={() => setCreating(false)} title="¿Qué quieres registrar?">
        {CREATE.filter((c) => money || !c.money).map((c) => (
          <MenuRow key={c.title} icon={c.icon} title={c.title} detail={c.detail} onPress={() => { setCreating(false); router.push(c.href); }} />
        ))}
      </Sheet>
    </View>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }} accessibilityLabel={`${pct}% vacunados en el último año`}>
      <Svg width={96} height={96} style={{ position: "absolute" }}>
        <Circle cx={48} cy={48} r={r} stroke={colors.limaSoft} strokeWidth={10} fill="none" />
        <Circle cx={48} cy={48} r={r} stroke={colors.selva} strokeWidth={10} fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 48 48)" />
      </Svg>
      <Txt w="extrabold" size={20}>{pct}%</Txt>
      <Txt size={10} color={colors.textMuted}>vacunados</Txt>
    </View>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.quick, pressed && { opacity: 0.85 }]}>
      <Icon name={icon} color={colors.selva} />
      <Txt w="bold" size={14}>{label}</Txt>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.14)", flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  bellCount: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  demo: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.warnSoft, padding: 12, borderRadius: radius.md },
  hero: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, ...shadow },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  task: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quick: { flexBasis: "47%", flexGrow: 1, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, ...shadow },
  fab: { position: "absolute", right: 22, bottom: TAB_BAR_SPACE, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.tierra, alignItems: "center", justifyContent: "center", ...shadow, shadowColor: "#4E342E", shadowOpacity: 0.35 },
});
