import { useEffect, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadow } from "@trazagro/shared";
import { Icon, type IconName } from "../Icon";
import { Kicker, Txt, Wave } from "../kit";
import { EASE, Tap } from "../motion";

/** Olive used by the mockups for small uppercase section labels ("O ELIGE DE LA LISTA", "HOY"). */
export const OLIVE = "#33691E";
/** Hairline between rows inside a white card. */
export const HAIR = "#EEF2E8";

/** 12 px uppercase label with wide tracking. */
export function SectionLabel({ children, color = OLIVE }: { children: ReactNode; color?: string }) {
  return <Txt w="semibold" size={12} color={color} style={{ letterSpacing: 2.4, textTransform: "uppercase" }}>{children}</Txt>;
}

/** Round 46 px outlined header button (close / back) drawn like the mockups. */
export function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={s.round}>
      <Icon name={icon} color={colors.onDark} size={icon === "x" ? 20 : 22} width={icon === "x" ? 2.4 : 2.2} />
    </Tap>
  );
}

/** Lima 48 px action in the header's top-right corner ("+ Registrar", "+ Servicio o parto"). */
export function HeaderAction({ label, onPress, icon = "plus", accessibilityLabel }: { label: string; onPress: () => void; icon?: IconName; accessibilityLabel?: string }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={s.headerAction}>
      <Icon name={icon} color={colors.selva} size={18} width={2.6} />
      <Txt w="extrabold" size={14} color={colors.selva}>{label}</Txt>
    </Tap>
  );
}

/**
 * Selva header used by the flows (Registrar, Nuevo pesaje, Corral): a top row with a round button, a centred
 * kicker and an optional right slot, then free content and the 40 px grass wave.
 */
export function FlowHeader({ left, kicker, right, children, gap = 12 }: { left?: ReactNode; kicker?: string; right?: ReactNode; children?: ReactNode; gap?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <View style={[s.flowHeader, { paddingTop: insets.top + 16, gap }]}>
        <View style={s.flowTop}>
          {left ?? <View style={{ width: 46 }} />}
          {kicker ? <Kicker>{kicker}</Kicker> : null}
          {right ?? <View style={{ width: 46 }} />}
        </View>
        {children}
      </View>
      <Wave height={40} />
    </View>
  );
}

/**
 * Segmented control with a sliding pill (Escanear's "Modo de lectura", Reproducción's views). `dark` is the
 * glass version used on the camera screen.
 */
export function Segmented<T extends string>({ options, value, onChange, dark, style }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; dark?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const x = useState(() => new Animated.Value(idx))[0];
  useEffect(() => {
    Animated.timing(x, { toValue: idx, duration: 380, easing: EASE, useNativeDriver: true }).start();
  }, [idx, x]);
  const n = options.length;
  const cell = w ? (w - (dark ? 0 : 2) - 8 - (n - 1) * 4) / n : 0;
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[dark ? s.segDark : s.segLight, style]}>
      {cell ? (
        <Animated.View pointerEvents="none" style={[dark ? s.pillDark : s.pillLight, { width: cell, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, cell + 4] }) }] }]} />
      ) : null}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <View key={o.id} style={{ flex: 1 }}>
            <Tap accessibilityRole="tab" accessibilityLabel={o.label} accessibilityState={{ selected: on }} aria-selected={on}
              onPress={() => onChange(o.id)} style={s.segCell}>
              <Txt w="bold" size={13} color={dark ? (on ? colors.selva : "#DDE7DE") : on ? colors.onDark : colors.textMuted} numberOfLines={1}>{o.label}</Txt>
            </Tap>
          </View>
        );
      })}
    </View>
  );
}

/** "¡Guardado!" mark: lima disc, dotted orbit, three satellites and the check. */
export function SavedMark({ size = 130 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Circle cx={80} cy={80} r={62} fill={colors.limaSoft} />
      <Circle cx={80} cy={80} r={74} fill="none" stroke={colors.pasto} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" />
      <Circle cx={80} cy={6} r={6} fill={colors.link} />
      <Circle cx={6} cy={80} r={6} fill={colors.lima} />
      <Circle cx={132} cy={132} r={6} fill={colors.link} />
      <Path d="M54 82l18 18 36-38" fill="none" stroke={colors.selva} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Thin rounded progress bar. */
export function Bar({ pct, color, track = colors.sand, height = 8 }: { pct: number; color: string; track?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** Round initials / short-number badge (44–48 px) used in the history lists. */
export function Badge({ text, bg, fg, size = 44 }: { text: string; bg: string; fg: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Txt w="extrabold" size={size >= 48 ? 14 : 13} color={fg}>{text}</Txt>
    </View>
  );
}

/** Small tinted pill with free colours ("RECOMENDADO", "PRONTO", "Leche"). */
export function Tag({ label, bg, fg, size = 11 }: { label: string; bg: string; fg: string; size?: number }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: size > 11 ? 10 : 8, paddingVertical: size > 11 ? 5 : 4, alignSelf: "center" }}>
      <Txt w={size > 11 ? "extrabold" : "bold"} size={size} color={fg}>{label}</Txt>
    </View>
  );
}

/** Floating selva bar at the bottom of a flow: "Atrás" on the left and the lima main action. */
export function FlowBar({ back, onBack, backDisabled, next, onNext }: { back: string; onBack: () => void; backDisabled?: boolean; next: string; onNext: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.flowBar, { bottom: Math.max(insets.bottom, 16) }]}>
      <Tap accessibilityRole="button" accessibilityLabel={back} onPress={onBack} style={[s.flowBack, backDisabled && { opacity: 0.4 }]}>
        <Txt w="bold" size={15} color={colors.onDark}>{back}</Txt>
      </Tap>
      <View style={{ flex: 1 }}>
        <Tap accessibilityRole="button" accessibilityLabel={next} onPress={onNext} style={s.flowNext}>
          <Txt w="extrabold" size={16} color={colors.selva}>{next}</Txt>
        </Tap>
      </View>
    </View>
  );
}

export const cardShadow = shadow;

/** Tap that takes a share of a row (Pressable itself must flex, not only its inner view). */
export function Grow({ children, flex = 1 }: { children: ReactNode; flex?: number }) {
  return <View style={{ flex }}>{children}</View>;
}

/** Removes the browser focus ring on web text inputs (the field already shows its own border). */
export const noOutline = { outlineStyle: "none" } as unknown as object;

const s = StyleSheet.create({
  round: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: colors.glassLine, alignItems: "center", justifyContent: "center" },
  headerAction: { height: 48, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.lima, flexDirection: "row", alignItems: "center", gap: 6 },
  flowHeader: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6 },
  flowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  segDark: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)" },
  segLight: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outline },
  pillDark: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 10, backgroundColor: colors.card, shadowColor: colors.selva, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  pillLight: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 999, backgroundColor: colors.selva, shadowColor: colors.selva, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  segCell: { height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  flowBar: { position: "absolute", left: 14, right: 14, height: 68, paddingHorizontal: 8, borderRadius: 34, backgroundColor: colors.selva, flexDirection: "row", alignItems: "center", gap: 8,
    shadowColor: colors.selva, shadowOpacity: 0.4, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  flowBack: { height: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center" },
  flowNext: { height: 52, borderRadius: 26, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
});
