import { ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { canSeeMoney, colors } from "@trazagro/shared";
import { useFarm } from "../../lib/farm";
import type { IconName } from "../../ui/Icon";
import { GreenHeader, MenuRow, Txt } from "../../ui/kit";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

interface Item { icon: IconName; title: string; detail: string; href: Href; badge?: string; tone?: string; money?: boolean }

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Hato",
    items: [
      { icon: "drop", title: "Salud y días de retiro", detail: "Vacunas, tratamientos y quién no puede salir", href: "/salud" },
      { icon: "heart", title: "Reproducción", detail: "Servicios, preñeces y partos esperados", href: "/reproduccion" },
      { icon: "scale", title: "Pesajes", detail: "Ganancia diaria por animal y por lote", href: "/pesajes" },
      { icon: "milk", title: "Leche", detail: "Litros por ordeño y por vaca", href: "/leche" },
      { icon: "layers", title: "Lotes y potreros", detail: "Agrupa y mueve animales", href: "/lotes" },
    ],
  },
  {
    title: "Finca",
    items: [
      { icon: "calendar", title: "Agenda", detail: "Lo que toca hacer esta semana", href: "/agenda" },
      { icon: "box", title: "Inventario de insumos", detail: "Vacunas, drogas, sal y herramientas", href: "/inventario" },
      { icon: "money", title: "Costos e ingresos", detail: "Contabilidad del mes por categoría", href: "/costos", tone: colors.tierra, money: true },
      { icon: "chart", title: "Métricas y rentabilidad", detail: "Natalidad, mortalidad, costo por animal", href: "/metricas", money: true },
      { icon: "share", title: "Reportes", detail: "Inventario, sanidad y finanzas para compartir", href: "/reportes" },
      { icon: "note", title: "Reporte ICA", detail: "Novedades para SINIGAN", href: "/ica" },
    ],
  },
  {
    title: "Equipo y cuenta",
    items: [
      { icon: "cow", title: "Mis fincas", detail: "Cambiar, editar o registrar otra", href: "/fincas" },
      { icon: "users", title: "Usuarios y permisos", detail: "Vaqueros, técnicos y administradores", href: "/equipo" },
      { icon: "check", title: "Cuenta y respaldo", detail: "Iniciar sesión y sincronizar", href: "/cuenta" },
      { icon: "star", title: "Plan TrazAgro", detail: "Gratis, Finca y Pro", href: "/suscripcion" },
      { icon: "gear", title: "Ajustes", detail: "Modo noche, privacidad y datos de prueba", href: "/ajustes" },
    ],
  },
  {
    title: "Servicios",
    items: [
      { icon: "chat", title: "VetConecta", detail: "Pregunta a un asistente veterinario", href: "/vetconecta", badge: "Beta" },
      { icon: "store", title: "Tienda agropecuaria", detail: "Insumos cerca de tu finca", href: "/tienda", badge: "Pronto" },
      { icon: "map", title: "Mapa y GPS", detail: "Potreros y collares de ubicación", href: "/mapa", badge: "Pronto" },
    ],
  },
];

export default function ModulosScreen() {
  const router = useRouter();
  const { farm, role } = useFarm();
  const money = canSeeMoney(role);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
      <GreenHeader kicker={farm?.name.toUpperCase() ?? "TRAZAGRO"} title="Módulos" />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {GROUPS.map((g) => (
          <View key={g.title} style={{ gap: 10, marginBottom: 8 }}>
            <Txt w="semibold" size={12} color={colors.textMuted} style={{ letterSpacing: 1.8 }}>{g.title.toUpperCase()}</Txt>
            {g.items.filter((i) => money || !i.money).map((i) => (
              <MenuRow key={i.title} icon={i.icon} title={i.title} detail={i.detail} badge={i.badge} tone={i.tone} onPress={() => router.push(i.href)} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
