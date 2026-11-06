import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { canSeeMoney, colors, shadow } from "@trazagro/shared";
import { useFarm } from "../../lib/farm";
import { Icon, type IconName } from "../../ui/Icon";
import { GreenHeader, Txt } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { Segmented, TINT, type Tint } from "../../ui/finca/parts";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

interface Item { icon: IconName; label: string; href: Href; tint: Tint; money?: boolean; badge?: string }

/** Lima circles in the header (Mas.dc). */
const QUICK: { icon: IconName; label: string; href: Href }[] = [
  { icon: "syringe", label: "Registrar", href: "/evento/nuevo" },
  { icon: "scan", label: "Leer arete", href: "/escanear" },
  { icon: "scale", label: "Pesar", href: "/pesajes" },
  { icon: "map", label: "Mapa", href: "/mapa" },
];

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Anotar algo",
    items: [
      { icon: "syringe", label: "Vacuna o tratamiento", href: { pathname: "/evento/nuevo", params: { kind: "vacuna" } }, tint: "g" },
      { icon: "scale", label: "Pesaje", href: { pathname: "/evento/nuevo", params: { kind: "pesaje" } }, tint: "b" },
      { icon: "heart", label: "Parto o servicio", href: "/reproduccion", tint: "r" },
      { icon: "milk", label: "Leche", href: "/leche", tint: "e" },
    ],
  },
  {
    title: "Revisar mi hato",
    items: [
      { icon: "drop", label: "Salud y retiros", href: "/salud", tint: "g" },
      { icon: "calendar", label: "Agenda", href: "/agenda", tint: "y" },
      { icon: "chart", label: "Métricas", href: "/metricas", tint: "b", money: true },
      { icon: "note", label: "Reporte ICA", href: "/ica", tint: "y" },
    ],
  },
  {
    title: "Ubicar y mover",
    items: [
      { icon: "map", label: "Mapa GPS", href: "/mapa", tint: "b", badge: "Pronto" },
      { icon: "layers", label: "Lotes", href: "/lotes", tint: "g" },
    ],
  },
  {
    title: "Mi negocio",
    items: [
      { icon: "money", label: "Costos", href: "/costos", tint: "y", money: true },
      { icon: "box", label: "Inventario", href: "/inventario", tint: "e" },
      { icon: "store", label: "Tienda", href: "/tienda", tint: "g", badge: "Pronto" },
      { icon: "report", label: "Reportes", href: "/reportes", tint: "b" },
    ],
  },
  {
    title: "Mi cuenta",
    items: [
      { icon: "barn", label: "Mis fincas", href: "/fincas", tint: "g" },
      { icon: "users", label: "Usuarios", href: "/equipo", tint: "b" },
      { icon: "star", label: "Suscripción", href: "/suscripcion", tint: "e" },
      { icon: "sync", label: "Cuenta y respaldo", href: "/cuenta", tint: "y" },
      { icon: "chat", label: "VetConecta", href: "/vetconecta", tint: "r", badge: "Beta" },
      { icon: "gear", label: "Ajustes", href: "/ajustes", tint: "g" },
    ],
  },
];

export default function ModulosScreen() {
  const router = useRouter();
  const { role } = useFarm();
  const money = canSeeMoney(role);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 8 }}>
      <GreenHeader kicker="MÓDULOS" title="¿Qué quieres hacer?" waveHeight={40}>
        <View style={s.quick}>
          {QUICK.map((q) => (
            <View key={q.label} style={{ flex: 1 }}><Tap accessibilityRole="button" accessibilityLabel={q.label} onPress={() => router.push(q.href)} style={s.quickItem}>
              <View style={s.quickIcon}><Icon name={q.icon} color={colors.selva} size={24} /></View>
              <Txt w="semibold" size={12} color={colors.onDark} style={{ textAlign: "center" }}>{q.label}</Txt>
            </Tap></View>
          ))}
        </View>
      </GreenHeader>

      <View style={s.main}>
        <Rise index={0}>
          <View style={s.theme}>
            <Txt w="bold" size={15} style={{ flex: 1 }}>Apariencia</Txt>
            {/* Only the light theme exists today: "Noche" is shown as coming soon. */}
            <Segmented variant="tint" height={38} fontSize={14} style={{ width: 190 }} value="claro" onChange={() => {}}
              options={[{ id: "claro", label: "Claro" }, { id: "noche", label: "Noche", a11y: "Noche (pronto)", disabled: true }]} />
          </View>
        </Rise>

        {GROUPS.map((g, gi) => {
          const items = g.items.filter((i) => money || !i.money);
          if (!items.length) return null;
          return (
            <Rise key={g.title} index={gi + 1} style={{ gap: 8 }}>
              <Txt w="extrabold" size={17}>{g.title}</Txt>
              <View style={s.grid}>
                {items.map((i) => (
                  <View key={i.label} style={s.cell}><Tap accessibilityRole="button" accessibilityLabel={i.label} onPress={() => router.push(i.href)} style={s.pill}>
                    <View style={[s.pillIcon, { backgroundColor: TINT[i.tint][0] }]}><Icon name={i.icon} color={TINT[i.tint][1]} size={20} /></View>
                    <Txt w="semibold" size={14} style={{ flex: 1, lineHeight: 16 }} numberOfLines={2}>{i.label}</Txt>
                    {i.badge ? <View style={s.badge}><Txt w="bold" size={10} color={colors.warn}>{i.badge}</Txt></View> : null}
                  </Tap></View>
                ))}
              </View>
            </Rise>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  quick: { flexDirection: "row", gap: 8, marginTop: 14 },
  quickItem: { alignItems: "center", gap: 6 },
  quickIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
  main: { paddingHorizontal: 16, gap: 14 },
  theme: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingRight: 8, paddingLeft: 16, borderRadius: 26, backgroundColor: colors.card, ...shadow },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "48.8%" },
  pill: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, paddingLeft: 6, paddingRight: 10, backgroundColor: colors.card, borderRadius: 26, ...shadow, shadowOpacity: 0.07 },
  pillIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  badge: { backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
});
