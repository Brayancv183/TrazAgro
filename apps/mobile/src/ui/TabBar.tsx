import { Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "@trazagro/shared";
import { Icon, type IconName } from "./Icon";
import { Txt } from "./kit";

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: "/", label: "Inicio", icon: "home" },
  { path: "/animales", label: "Animales", icon: "tag" },
  { path: "/escanear", label: "Escanear", icon: "scan" },
  { path: "/alertas", label: "Alertas", icon: "bell" },
  { path: "/modulos", label: "Módulos", icon: "grid" },
];

export const TAB_BAR_SPACE = 110;

/** Floating green bar from the design: the active tab grows into a lime pill, Escanear sits in the middle. */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { bottom: Math.max(insets.bottom, 12) }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = pathname === t.path;
        if (t.path === "/escanear") {
          return (
            <Pressable key={t.path} accessibilityRole="tab" accessibilityLabel="Escanear arete" accessibilityState={{ selected: on }}
              onPress={() => router.navigate(t.path as never)} style={s.scan}>
              <Icon name="scan" color={colors.selva} size={26} />
            </Pressable>
          );
        }
        return (
          <Pressable key={t.path} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
            onPress={() => router.navigate(t.path as never)} style={[s.tab, on && s.tabOn]}>
            <Icon name={t.icon} color={on ? colors.selva : colors.onDarkMuted} size={22} />
            {on ? <Txt w="bold" size={13} color={colors.selva}>{t.label}</Txt> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: "absolute", left: 14, right: 14, height: 68, borderRadius: 34, backgroundColor: colors.selva, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, shadowColor: colors.selvaDeep, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  tab: { height: 48, minWidth: 48, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  tabOn: { backgroundColor: colors.lima, paddingHorizontal: 14 },
  scan: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.onDark, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.lima },
});
