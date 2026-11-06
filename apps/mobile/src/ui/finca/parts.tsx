// Small pieces shared by the farm screens (Módulos, Fincas, Lotes, Inventario, Costos, Métricas, Reportes, ICA).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, shadow } from "@trazagro/shared";
import { Icon, type IconName } from "../Icon";
import { Txt } from "../kit";
import { EASE, Tap } from "../motion";

/** The mockups' tint pairs [background, foreground]. */
export const TINT = {
  g: [colors.limaSoft, colors.selva], r: [colors.rosaSoft, colors.rosa], b: [colors.infoSoft, colors.info],
  y: [colors.warnSoft, colors.warn], e: [colors.tierraSoft, colors.tierra],
} as const;
export type Tint = keyof typeof TINT;

/**
 * Segmented control with a sliding selva pill (Inventario tabs, Costos Gastos/Ingresos, Rentabilidad).
 * `variant`: "white" (white track with hairline), "tint" (F1F7EC track), "glass" (on the green header, lime pill).
 */
export function Segmented<T extends string>({ options, value, onChange, variant = "white", height = 40, fontSize = 13, pillColor, style }: {
  options: { id: T; label: string; a11y?: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void;
  variant?: "white" | "tint" | "glass"; height?: number; fontSize?: number; pillColor?: string; style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const v = useRef(new Animated.Value(idx)).current;
  useEffect(() => { Animated.timing(v, { toValue: idx, duration: 380, easing: EASE, useNativeDriver: true }).start(); }, [idx, v]);
  const pad = variant === "tint" ? 3 : 4, gap = variant === "tint" ? 2 : 4;
  const seg = w ? (w - pad * 2 - gap * (options.length - 1)) / options.length : 0;
  const glass = variant === "glass";
  const pill = pillColor ?? (glass ? colors.lima : colors.selva);
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[s.segTrack, { padding: pad, gap }, variant === "white" && s.segWhite, variant === "tint" && { backgroundColor: colors.tint }, glass && { backgroundColor: colors.glass }, style]}>
      {seg ? (
        <Animated.View pointerEvents="none" style={[s.segPill, { top: pad, bottom: pad, left: pad, width: seg, backgroundColor: pill },
          glass ? null : s.segShadow, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, seg + gap] }) }] }]} />
      ) : null}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <View key={o.id} style={{ flex: 1 }}><Tap accessibilityRole="tab" accessibilityLabel={o.a11y ?? o.label} accessibilityState={{ selected: on, disabled: o.disabled }} aria-selected={on}
            disabled={o.disabled} onPress={() => onChange(o.id)} style={{ height, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }}>
            <Txt w="bold" size={fontSize} numberOfLines={1} color={on ? (glass ? colors.selva : colors.onDark) : glass ? colors.onDark : colors.textMuted}>{o.label}</Txt>
          </Tap></View>
        );
      })}
    </View>
  );
}

/** White (or lima) 48 px rounded-square header action: "Ver en mapa", "Reporte", "Agregar". */
export function HeaderAction({ icon, label, onPress, lime }: { icon: IconName; label: string; onPress: () => void; lime?: boolean }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[s.headerAction, lime ? { backgroundColor: colors.lima } : { backgroundColor: colors.card, ...shadow }]}>
      <Icon name={icon} color={lime ? colors.selva : colors.link} size={18} width={lime ? 2.6 : 2.2} />
      <Txt w="extrabold" size={14} color={lime ? colors.selva : colors.text}>{label}</Txt>
    </Tap>
  );
}

/** Mockup input: 13 px muted label over a 56 px white pill with a hairline. */
export function FField({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt w="semibold" size={13} color={colors.textMuted}>{label}</Txt>
      <TextInput placeholderTextColor="#9AA39D" accessibilityLabel={label} {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: colors.selva, borderWidth: 2, paddingHorizontal: 19 }, props.style]} />
      {hint ? <Txt size={12} color={colors.textMuted}>{hint}</Txt> : null}
    </View>
  );
}

/** Small stat tile (value 17 px extrabold over an 11 px label), on cream or on the green card. */
export function StatBox({ value, label, dark, tone }: { value: string | number; label: string; dark?: boolean; tone?: string }) {
  return (
    <View style={[s.stat, { backgroundColor: dark ? "rgba(255,255,255,0.1)" : colors.crema }]}>
      <Txt w="extrabold" size={17} color={tone ?? (dark ? colors.onDark : colors.text)} numberOfLines={1}>{value}</Txt>
      <Txt w="bold" size={11} color={dark ? colors.onDark : colors.textMuted} numberOfLines={1}>{label}</Txt>
    </View>
  );
}

/** 12 px extrabold state chip ("Rotar pronto", "Abierta", "Por agotarse"). */
export function StateChip({ label, bg, fg, radius = 999 }: { label: string; bg: string; fg: string; radius?: number }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius, paddingHorizontal: radius < 20 ? 8 : 10, paddingVertical: radius < 20 ? 4 : 5 }}>
      <Txt w="extrabold" size={radius < 20 ? 11 : 12} color={fg}>{label}</Txt>
    </View>
  );
}

/** Floating green action bar at the bottom of a form (Registro): secondary glass button + lima main button. */
export function ActionBar({ backLabel, onBack, label, onPress, disabled }: { backLabel?: string; onBack?: () => void; label: string; onPress: () => void; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { bottom: 16 + insets.bottom }]}>
      {backLabel && onBack ? (
        <Tap accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={s.barBack}>
          <Txt w="bold" size={15} color={colors.onDark}>{backLabel}</Txt>
        </Tap>
      ) : null}
      <View style={{ flex: 1 }}><Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={s.barMain}>
        <Txt w="extrabold" size={16} color={colors.selva}>{label}</Txt>
      </Tap></View>
    </View>
  );
}

/** Section heading in caps (12 px, wide tracking, dark green) — "GENERADOS HACE POCO". */
export function CapsTitle({ children }: { children: ReactNode }) {
  return <Txt w="semibold" size={12} color="#33691E" style={{ letterSpacing: 2.4 }}>{children}</Txt>;
}

const s = StyleSheet.create({
  segTrack: { flexDirection: "row", borderRadius: 999, position: "relative" },
  segWhite: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outline },
  segPill: { position: "absolute", borderRadius: 999 },
  segShadow: { shadowColor: colors.selva, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  headerAction: { height: 48, paddingHorizontal: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { height: 56, borderRadius: 28, paddingHorizontal: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outline, fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  stat: { flex: 1, borderRadius: 14, padding: 10 },
  bar: { position: "absolute", left: 14, right: 14, height: 68, paddingHorizontal: 8, backgroundColor: colors.selva, borderRadius: 34, flexDirection: "row", alignItems: "center", gap: 8,
    shadowColor: colors.selva, shadowOpacity: 0.4, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  barBack: { height: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center" },
  barMain: { height: 52, borderRadius: 26, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
});
