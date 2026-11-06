import { StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@trazagro/shared";
import { Icon, type IconName } from "./Icon";
import { Txt } from "./kit";
import { Pop, Tap } from "./motion";

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: "/", label: "Inicio", icon: "home" },
  { path: "/animales", label: "Animales", icon: "tag" },
  { path: "/escanear", label: "Escanear arete", icon: "scan" },
  { path: "/alertas", label: "Alertas", icon: "bell" },
  { path: "/modulos", label: "Módulos", icon: "grid" },
];

/** Space a screen leaves at the bottom so its content clears the floating bar. */
export const TAB_BAR_SPACE = 110;

/**
 * Floating 68 px selva bar from the mockups (TabBar.dc): 48 px tabs in #C8E6C9; the active one grows into
 * a lima pill with its label and pops in; Escanear is the white 52 px circle in the middle.
 */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { bottom: Math.max(insets.bottom, 16) }]} accessibilityRole="tablist" accessibilityLabel="Navegación principal">
      {TABS.map((t) => {
        const on = pathname === t.path;
        if (t.path === "/escanear") {
          return (
            <Tap key={t.path} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
              onPress={() => router.navigate(t.path as never)} style={s.scan} scaleTo={0.92}>
              <Icon name="scan" color={colors.selva} size={24} width={2.2} />
            </Tap>
          );
        }
        return (
          <Tap key={t.path} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
            onPress={() => router.navigate(t.path as never)} scaleTo={0.92}>
            {on ? (
              <Pop deps={[pathname]} style={[s.tab, s.tabOn]}>
                <Icon name={t.icon} color={colors.selva} size={21} width={2.2} />
                <Txt w="bold" size={13} color={colors.selva}>{t.label}</Txt>
              </Pop>
            ) : (
              <View style={[s.tab, { width: 48 }]}>
                <Icon name={t.icon} color={colors.onDarkMuted} size={21} width={2.2} />
              </View>
            )}
          </Tap>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute", left: 14, right: 14, height: 68, borderRadius: 34, backgroundColor: colors.selva,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10,
    shadowColor: colors.selva, shadowOpacity: 0.4, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 12,
  },
  tab: { height: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  tabOn: { backgroundColor: colors.lima, paddingHorizontal: 14 },
  scan: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.onDark, alignItems: "center", justifyContent: "center" },
});
