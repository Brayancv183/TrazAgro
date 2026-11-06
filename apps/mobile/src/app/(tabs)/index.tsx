import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { addDays, canSeeMoney, colors, farmAlerts, fonts, noveltiesFor, plural, shadow, todayDay, type Alert, type Animal } from "@trazagro/shared";
import { loadFarmBundle } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { loadSession } from "../../lib/session";
import { useDbQuery } from "../../lib/useDb";
import { runSync, syncStatus } from "../../sync/engine";
import { Icon, type IconName } from "../../ui/Icon";
import { Button, EarTag, Empty, Fab, GreenHeader, Kicker, Sheet, Txt, Wave } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

type Backup = { kind: "none" } | { kind: "syncing" } | { kind: "ok"; pending: number } | { kind: "offline"; pending: number };

/** "¿Qué quieres anotar?" grid (SheetCrear.dc): 3 columns, tinted round icons. */
const TINT = { g: [colors.greenSoft, colors.selva], r: [colors.rosaSoft, colors.rosa], b: [colors.infoSoft, colors.info], y: [colors.warnSoft, colors.amberText], e: [colors.tierraSoft, colors.tierraDeep] } as const;
const CREATE: { icon: IconName; label: string; href: Href; tint: keyof typeof TINT; money?: boolean }[] = [
  { icon: "syringe", label: "Vacuna o tratamiento", href: { pathname: "/evento/nuevo", params: { kind: "vacuna" } }, tint: "g" },
  { icon: "scale", label: "Pesaje", href: { pathname: "/evento/nuevo", params: { kind: "pesaje" } }, tint: "b" },
  { icon: "tag", label: "Nuevo animal", href: "/animal/nuevo", tint: "e" },
  { icon: "heart", label: "Parto o servicio", href: "/reproduccion", tint: "r" },
  { icon: "move", label: "Mover de lote", href: "/lotes", tint: "g" },
  { icon: "money", label: "Gasto o ingreso", href: "/costos", tint: "y", money: true },
  { icon: "milk", label: "Leche del día", href: "/leche", tint: "e" },
  { icon: "calendar", label: "Tarea en agenda", href: "/agenda", tint: "y" },
  { icon: "box", label: "Compra de insumo", href: "/inventario", tint: "b" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

/** Where a route item leads: the animal, the ICA list, the inventory or the alert list. */
function targetOf(a: Alert): Href {
  if (a.animalId) return { pathname: "/animal/[id]", params: { id: a.animalId } };
  if (a.id === "ica") return "/ica";
  if (a.productId) return "/inventario";
  return "/alertas";
}

export default function InicioScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { farm, farms, role, refresh, selectFarm } = useFarm();
  const money = canSeeMoney(role);
  const [backup, setBackup] = useState<Backup>();
  const [creating, setCreating] = useState(false);
  const [picking, setPicking] = useState(false);
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
  const byId = new Map<string, Animal>((data?.animals ?? []).map((a) => [a.id, a]));
  const yearAgo = addDays(today, -365);
  const vaccinated = new Set(data?.events.filter((e) => e.type === "vacuna" && e.date >= yearAgo).map((e) => e.animalId));
  const pct = active.length ? Math.round((active.filter((a) => vaccinated.has(a.id)).length / active.length) * 100) : 0;
  const alerts = data?.farm ? farmAlerts(data.animals, data.events, data.products, noveltiesFor(data.farm, data.animals, data.events, today), today) : [];
  const route = alerts.slice(0, 3);
  const more = alerts.slice(3);

  const signal = !backup ? null
    : backup.kind === "offline" ? { text: `Sin señal · ${backup.pending}`, warn: true }
    : backup.kind === "none" ? { text: "Sin respaldo", warn: true }
    : backup.kind === "syncing" ? { text: "Sincronizando…", warn: false }
    : backup.pending ? { text: `${backup.pending} por subir`, warn: true } : { text: "Respaldado", warn: false };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 80 }}>
        <Hero
          farmName={farm?.name ?? ""} municipality={farm?.municipality ?? ""} canSwitch={farms.length > 1} onFarm={() => setPicking(true)}
          alerts={alerts.length} onAlerts={() => router.navigate("/alertas")}
          count={active.length} pct={pct} onRing={() => router.push(money ? "/metricas" : "/salud")}
          demo={!!farm?.isDemo} signal={signal} onSignal={() => router.push("/cuenta")} />

        <View style={s.main}>
          <Rise index={1} style={{ gap: 6 }}>
            <View style={s.sectionHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt w="extrabold" size={20}>Tu ruta de hoy</Txt>
                <View style={s.urgentPill}><Txt w="bold" size={11} color={colors.urgentText}>por urgencia</Txt></View>
              </View>
              <Tap accessibilityRole="link" onPress={() => router.push("/agenda")} style={{ minHeight: 44, justifyContent: "center" }}>
                <Txt w="bold" size={14} color={colors.link}>Agenda</Txt>
              </Tap>
            </View>

            {data && !route.length ? <Empty title="Nada urgente hoy" text="No hay retiros, vencimientos ni novedades pendientes." /> : null}
            <View>
              {route.length > 1 ? <DashedLine /> : null}
              {route.map((a, i) => (
                <RouteItem key={a.id} n={i + 1} alert={a} animal={a.animalId ? byId.get(a.animalId) : undefined} onPress={() => router.push(targetOf(a))} index={i} />
              ))}
            </View>
          </Rise>

          {more.length ? (
            <Rise index={4}>
              <Tap accessibilityRole="link" onPress={() => router.navigate("/alertas")} style={s.more}>
                <Txt w="semibold" size={14} style={{ flex: 1 }} numberOfLines={2}>
                  {`+ ${plural(more.length, "tarea más", "tareas más")} para hoy · ${more.slice(0, 2).map((m) => m.title.charAt(0).toLowerCase() + m.title.slice(1)).join(", ")}`}
                </Txt>
                <Icon name="chevron" color={colors.text} size={20} width={2.4} />
              </Tap>
            </Rise>
          ) : null}
        </View>
      </ScrollView>

      {role !== "solo_ver" ? <Fab accessibilityLabel="Crear registro" onPress={() => setCreating(true)} /> : null}

      <Sheet open={creating} onClose={() => setCreating(false)} title="¿Qué quieres anotar?">
        <View style={s.grid}>
          {CREATE.filter((c) => money || !c.money).map((c) => (
            <Tap key={c.label} accessibilityRole="button" accessibilityLabel={c.label} style={s.gridItem}
              onPress={() => { setCreating(false); router.push(c.href); }}>
              <View style={[s.gridIcon, { backgroundColor: TINT[c.tint][0] }]}><Icon name={c.icon} color={TINT[c.tint][1]} size={22} /></View>
              <Txt w="extrabold" size={13} style={{ textAlign: "center", lineHeight: 16 }}>{c.label}</Txt>
            </Tap>
          ))}
        </View>
      </Sheet>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Tus fincas">
        <View style={{ gap: 10 }}>
          {farms.map((f) => {
            const on = f.id === farm?.id;
            return (
              <Tap key={f.id} accessibilityRole="button" accessibilityLabel={`Trabajar en ${f.name}`} accessibilityState={{ selected: on }}
                onPress={async () => { setPicking(false); await selectFarm(f.id); }}
                style={[s.farmRow, on && { borderColor: colors.lima, backgroundColor: colors.greenSoft }]}>
                <View style={s.farmIcon}><Icon name="barn" color={colors.selva} size={22} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="bold" size={16}>{f.name}</Txt>
                  <Txt size={13} color={colors.textMuted}>{`${f.municipality} · ${plural(f.animalCount, "animal", "animales")}${f.isDemo ? " · prueba" : ""}`}</Txt>
                </View>
                {on ? <Icon name="check" color={colors.selva} size={22} width={2.6} /> : null}
              </Tap>
            );
          })}
          <Button kind="ghost" icon="gear" label="Administrar fincas" onPress={() => { setPicking(false); router.push("/fincas"); }} />
        </View>
      </Sheet>
    </View>
  );
}

/** Green hero from Main.dc: farm selector + bell, greeting, big herd count, status chips and the vaccination ring. */
function Hero({ farmName, municipality, canSwitch, onFarm, alerts, onAlerts, count, pct, onRing, demo, signal, onSignal }: {
  farmName: string; municipality: string; canSwitch: boolean; onFarm: () => void; alerts: number; onAlerts: () => void;
  count: number; pct: number; onRing: () => void; demo: boolean; signal: { text: string; warn: boolean } | null; onSignal: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <View style={[s.hero, { paddingTop: 18 + insets.top }]}>
        <View style={s.heroTop}>
          <Tap accessibilityRole="button" accessibilityLabel={`Finca ${farmName}. Cambiar de finca`} onPress={onFarm} style={{ minHeight: 44, justifyContent: "center" }}>
            <Kicker>{`FINCA · ${municipality.toUpperCase()}`}</Kicker>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Txt w="bold" size={19} color={colors.onDark}>{farmName}</Txt>
              {canSwitch ? <Icon name="down" color={colors.onDark} size={18} width={2.4} /> : null}
            </View>
          </Tap>
          <Tap accessibilityRole="button" accessibilityLabel={`Alertas, ${alerts}`} onPress={onAlerts} style={s.bell}>
            <Icon name="bell" color={colors.onDark} size={22} />
            {alerts ? <View style={s.bellCount}><Txt w="extrabold" size={11} color={colors.selva}>{alerts > 99 ? "99+" : alerts}</Txt></View> : null}
          </Tap>
        </View>

        <View style={s.heroBody}>
          <View style={{ flex: 1, gap: 6 }}>
            <Txt size={15} color={colors.onDarkMuted}>{greeting()}</Txt>
            <Txt w="extrabold" size={33} color={colors.onDark} style={{ lineHeight: 34, letterSpacing: -0.66 }}>
              {`${count} ${count === 1 ? "animal" : "animales"}\n`}<Txt w="extrabold" size={33} color={colors.lima}>bajo control</Txt>
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {demo ? (
                <View style={s.glassChip}><Icon name="info" color={colors.lima} size={14} width={2.4} /><Txt w="semibold" size={12} color={colors.onDark}>Finca de prueba</Txt></View>
              ) : null}
              {signal ? (
                <Tap accessibilityRole="link" onPress={onSignal} style={signal.warn ? s.signalChip : s.glassChip}>
                  {signal.warn ? null : <Icon name="sync" color={colors.lima} size={14} width={2.4} />}
                  <Txt w={signal.warn ? "bold" : "semibold"} size={12} color={signal.warn ? colors.signalText : colors.onDark}>{signal.text}</Txt>
                </Tap>
              ) : null}
            </View>
          </View>
          <Tap accessibilityRole="link" accessibilityLabel={`Vacunación al día: ${pct} por ciento`} onPress={onRing}>
            <Ring pct={pct} />
          </Tap>
        </View>
      </View>
      <Wave height={50} style={{ paddingTop: 3 }} />
    </View>
  );
}

/** The 146 px vaccination ring with its three lima dots and the location pin. */
function Ring({ pct }: { pct: number }) {
  const r = 62;
  const len = 2 * Math.PI * r;
  return (
    <Svg width={146} height={146} viewBox="0 0 160 160">
      <Circle cx={80} cy={80} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={10} />
      <Circle cx={80} cy={80} r={r} fill="none" stroke={colors.lima} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${(len * pct) / 100} ${len}`} transform="rotate(-90 80 80)" />
      <Circle cx={80} cy={18} r={7} fill={colors.lima} stroke={colors.selva} strokeWidth={3} />
      <Circle cx={18} cy={80} r={7} fill={colors.lima} stroke={colors.selva} strokeWidth={3} />
      <Circle cx={124} cy={124} r={7} fill={colors.lima} stroke={colors.selva} strokeWidth={3} />
      <Path d="M136 10c-6 0-10 4.5-10 10 0 7.5 10 16 10 16s10-8.5 10-16c0-5.5-4-10-10-10z" fill="#FFFFFF" />
      <Circle cx={136} cy={20} r={3.5} fill={colors.selva} />
      <SvgText x={80} y={84} textAnchor="middle" fontFamily={fonts.extrabold} fontSize={32} fontWeight="800" fill="#FFFFFF">{`${pct}%`}</SvgText>
      <SvgText x={80} y={104} textAnchor="middle" fontFamily={fonts.semibold} fontSize={12} fontWeight="600" fill={colors.onDarkMuted}>vacunados</SvgText>
    </Svg>
  );
}

/** Dotted pasto line behind the route's numbered nodes. */
function DashedLine() {
  return <View pointerEvents="none" style={s.dash} />;
}

function RouteItem({ n, alert, animal, onPress, index }: { n: number; alert: Alert; animal?: Animal; onPress: () => void; index: number }) {
  const urgent = alert.level === "alta";
  const tone = alert.level === "alta" ? colors.urgent : animal?.sex === "macho" ? colors.tierra : colors.link;
  return (
    <Rise index={index + 2} style={s.routeRow}>
      <View style={[s.node, urgent ? s.nodeUrgent : s.nodeIdle]}>
        <Txt w="extrabold" size={12} color={urgent ? colors.onDark : colors.text}>{n}</Txt>
      </View>
      <Tap accessibilityRole="link" accessibilityLabel={`${alert.title}. ${alert.detail}`} onPress={onPress} style={s.routeCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt w="bold" size={16}>{alert.title}</Txt>
          <Txt size={13} color={colors.textMuted} numberOfLines={2}>{alert.detail}</Txt>
        </View>
        {animal ? <EarTag code={animal.tagVisual} tone={tone} size={38} /> : (
          <View style={[s.routeIcon, { backgroundColor: urgent ? colors.dangerSoft : colors.limaSoft }]}>
            <Icon name={alert.productId ? "box" : alert.id === "ica" ? "report" : "alert"} color={urgent ? colors.urgent : colors.selva} size={20} />
          </View>
        )}
      </Tap>
    </Rise>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.selva },
  heroTop: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bell: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: colors.glassLine, alignItems: "center", justifyContent: "center" },
  bellCount: { position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.lima, borderWidth: 2, borderColor: colors.selva, alignItems: "center", justifyContent: "center" },
  heroBody: { paddingTop: 8, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  glassChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.glass },
  signalChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.signal },
  main: { paddingTop: 2, paddingHorizontal: 16, gap: 14 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  urgentPill: { backgroundColor: colors.dangerSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  dash: { position: "absolute", left: 21, top: 26, bottom: 26, width: 0, borderLeftWidth: 2, borderStyle: "dashed", borderColor: colors.pasto },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 5 },
  node: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", zIndex: 1 },
  nodeUrgent: { backgroundColor: colors.urgent, borderWidth: 5, borderColor: colors.dangerSoft },
  nodeIdle: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ring },
  routeCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingLeft: 14, paddingRight: 12, backgroundColor: colors.card, borderRadius: 20, ...shadow },
  routeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  more: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outline },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "31%", flexGrow: 1, alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, backgroundColor: colors.crema },
  gridIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  farmRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 20, backgroundColor: colors.crema, borderWidth: 2, borderColor: "transparent" },
  farmIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
});
