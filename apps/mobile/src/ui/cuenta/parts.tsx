import { useEffect, useState, type ReactNode } from "react";
import { Animated, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, type Role } from "@trazagro/shared";
import { Icon, type IconName } from "../Icon";
import { HeaderButton, Kicker, Txt, Wave } from "../kit";
import { EASE, Tap } from "../motion";

/** Section kicker inside white cards ("QUÉ PUEDE HACER CADA ROL"): 12 px, wide tracking, dark olive. */
export function SectionKicker({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}><Txt w="semibold" size={12} color="#33691E" style={{ letterSpacing: 2.4 }}>{children}</Txt></View>;
}

/** Hairline-separated row inside a white list card (min height 56, #EEF2E8 divider). */
export function ListRow({ children, last, style }: { children: ReactNode; last?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 }, !last && { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" }, style]}>{children}</View>;
}

/** White card with the mockups' two-layer soft shadow; `list` = 4/16 padding for row lists. */
export function SoftCard({ children, style, list }: { children: ReactNode; style?: StyleProp<ViewStyle>; list?: boolean }) {
  return <View style={[s.card, list ? { paddingVertical: 4, paddingHorizontal: 16 } : { padding: 16 }, style]}>{children}</View>;
}

/**
 * Two-option segmented control with a sliding selva pill (Login "Celular / Correo", Perfil "Permisos / Historial").
 * `track` = background of the rail.
 */
export function Segmented<T extends string>({ options, value, onChange, track = colors.tint, label }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; track?: string; label: string;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const x = useState(() => new Animated.Value(idx))[0];
  useEffect(() => { Animated.timing(x, { toValue: idx, duration: 380, easing: EASE, useNativeDriver: true }).start(); }, [idx, x]);
  const cell = options.length ? (w - 8 - (options.length - 1) * 4) / options.length : 0;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[s.seg, { backgroundColor: track }, track === colors.card && { borderWidth: 1, borderColor: colors.outline }]}>
      {w ? <Animated.View style={[s.segPill, { width: cell, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, cell + 4] }) }] }]} /> : null}
      {options.map((o) => (
        <View key={o.id} style={{ flex: 1 }}><Tap accessibilityRole="tab" accessibilityLabel={o.label} accessibilityState={{ selected: o.id === value }} aria-selected={o.id === value}
          onPress={() => onChange(o.id)} style={s.segTab}>
          <Txt w="bold" size={14} color={o.id === value ? colors.onDark : colors.textMuted}>{o.label}</Txt>
        </Tap></View>
      ))}
    </View>
  );
}

/** iOS-like switch from the mockups: 52×32 track, white 24 px knob sliding 20 px. */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  const v = useState(() => new Animated.Value(on ? 1 : 0))[0];
  useEffect(() => { Animated.timing(v, { toValue: on ? 1 : 0, duration: 280, easing: EASE, useNativeDriver: false }).start(); }, [on, v]);
  const bg = v.interpolate({ inputRange: [0, 1], outputRange: ["#D5D0C4", colors.selva] });
  return (
    <Tap accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} aria-checked={on}
      disabled={disabled || !onChange} onPress={() => onChange?.(!on)} hitSlop={8}>
      <Animated.View style={[s.track, { backgroundColor: bg }]}>
        <Animated.View style={[s.knob, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
      </Animated.View>
    </Tap>
  );
}

/** Role colors from Usuarios.dc. */
export const ROLE_TONE: Record<Role, { bg: string; fg: string }> = {
  dueno: { bg: colors.selva, fg: colors.onDark },
  administrador: { bg: colors.limaSoft, fg: colors.selva },
  tecnico: { bg: colors.infoSoft, fg: colors.info },
  vaquero: { bg: colors.tierraSoft, fg: colors.tierraDeep },
  solo_ver: { bg: colors.sand, fg: "#3E4640" },
};
export const ROLE_SHORT: Record<Role, string> = { dueno: "Dueño", administrador: "Administrador", tecnico: "Técnico", vaquero: "Vaquero", solo_ver: "Solo ver" };

export function RoleChip({ role, width }: { role: Role; width?: number }) {
  const t = ROLE_TONE[role];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, width, alignItems: "center", flexShrink: 0 }}>
      <Txt w="bold" size={11} color={t.fg}>{ROLE_SHORT[role]}</Txt>
    </View>
  );
}

/** Radio pill used for role pickers (40–42 px). */
export function RadioPill({ label, on, onPress, accessibilityLabel }: { label: string; on: boolean; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Tap accessibilityRole="radio" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ checked: on }} aria-checked={on} onPress={onPress}
      style={[s.radio, on ? { backgroundColor: colors.selva, borderColor: colors.selva } : null]}>
      <Txt w="bold" size={14} color={on ? colors.onDark : colors.text}>{label}</Txt>
    </Tap>
  );
}

/** Round avatar with initials. `pending` = dashed sand ring (invitation not accepted). */
export function Avatar({ name, size = 44, tone = "earth", pending }: { name: string; size?: number; tone?: "earth" | "lima"; pending?: boolean }) {
  const ini = initials(name);
  const bg = pending ? colors.sand : tone === "lima" ? colors.lima : colors.tierraSoft;
  const fg = pending ? colors.textMuted : tone === "lima" ? colors.selva : colors.tierraDeep;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0,
      borderWidth: pending ? 2 : 0, borderStyle: "dashed", borderColor: "#C9C2B3" }}>
      <Txt w="extrabold" size={Math.round(size * 0.3)} color={fg}>{ini}</Txt>
    </View>
  );
}
export function initials(name: string) {
  const words = name.replace(/[^\p{L}\d ]/gu, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (/^\d+$/.test(words.join(""))) return words.join("").slice(-2);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : words[0]!.slice(0, 2)).toUpperCase();
}

/** Rounded input from the mockups: 54–58 px pill on a tinted fill, optional bold prefix ("+57"). */
export function PillInput({ prefix, style, height = 56, fill = colors.tint, big, ...props }: TextInputProps & { prefix?: string; height?: number; fill?: string; big?: boolean }) {
  return (
    <View style={[s.pillInput, { height, borderRadius: height / 2, backgroundColor: fill }]}>
      {prefix ? (
        <>
          <Txt w="bold" size={big ? 17 : 16} color={colors.selva}>{prefix}</Txt>
          <View style={{ width: 1, height: 24, backgroundColor: colors.ring }} />
        </>
      ) : null}
      <TextInput placeholderTextColor="#9AA39D" {...props}
        style={[{ flex: 1, minWidth: 0, height: "100%", fontFamily: big ? fonts.semibold : fonts.regular, fontSize: big ? 18 : 16, color: colors.text, outlineStyle: "none" } as never, style]} />
    </View>
  );
}

/** Status card in the look of ToastSync.dc: round tinted icon, bold title, muted detail, small pill action. */
export function StatusCard({ icon, tone, title, detail, action, onAction, actionLabel, dark, bar, children }: {
  icon: "check" | "cloudOff" | "cloudOk" | "sync" | IconName; tone: "ok" | "warn" | "danger" | "dark"; title: string; detail?: string;
  action?: string; onAction?: () => void; actionLabel?: string; dark?: boolean; bar?: boolean; children?: ReactNode;
}) {
  const pal = { ok: [colors.greenSoft, colors.selva], warn: [colors.warnSoft, colors.amberText], danger: [colors.dangerSoft, colors.danger], dark: ["#43A047", colors.onDark] }[tone];
  return (
    <View style={[s.toast, dark && { backgroundColor: colors.text, shadowOpacity: 0.3 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={[s.toastIcon, { backgroundColor: pal[0] }]}>
          {icon === "cloudOff" || icon === "cloudOk" ? <Cloud off={icon === "cloudOff"} color={pal[1]!} /> : <Icon name={icon as IconName} color={pal[1]} size={20} width={icon === "check" ? 3 : 2} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt w="extrabold" size={15} color={dark ? colors.onDark : colors.text}>{title}</Txt>
          {detail ? <Txt size={13} color={dark ? colors.onDarkMuted : colors.textMuted}>{detail}</Txt> : null}
        </View>
        {action && onAction ? (
          <Tap accessibilityRole="button" accessibilityLabel={actionLabel ?? action} onPress={onAction}
            style={[s.toastBtn, { backgroundColor: dark ? colors.glass : tone === "ok" ? colors.sand : colors.selva }]}>
            <Txt w="extrabold" size={13} color={dark || tone !== "ok" ? colors.onDark : colors.text}>{action}</Txt>
          </Tap>
        ) : null}
      </View>
      {bar ? <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.link }} /> : null}
      {children}
    </View>
  );
}

function Cloud({ off, color }: { off: boolean; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.5 19H8a5 5 0 1 1 1.1-9.9A6 6 0 0 1 20 11a4 4 0 0 1-2.5 8z" />
      <Path d={off ? "M4 4l16 16" : "m9 13 2 2 4-4"} />
    </Svg>
  );
}

/** Glass tag on the green header ("Último ingreso: ayer…"). */
export function GlassTag({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: colors.glass, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}><Txt w="semibold" size={12} color={colors.onDark}>{children}</Txt></View>;
}

/**
 * Green header in the layout used by these mockups: top row (back + optional right slot), then kicker + title
 * (custom size), then any extra children, then the 40 px wave.
 */
export function CuentaHeader({ kicker, title, titleSize = 31, back = true, right, children, top, onBack }: {
  kicker?: string; title?: string; titleSize?: number; back?: boolean; right?: ReactNode; children?: ReactNode; top?: ReactNode; onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View>
      <View style={{ backgroundColor: colors.selva, paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 6, gap: 12 }}>
        {back || right || top ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46 }}>
            {back ? <HeaderButton icon="back" label="Volver" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))} /> : <View />}
            {top}
            {right ?? <View />}
          </View>
        ) : null}
        {kicker || title ? (
          <View style={{ gap: 4 }}>
            {kicker ? <Kicker>{kicker}</Kicker> : null}
            {title ? <Txt w="extrabold" size={titleSize} color={colors.onDark} style={{ letterSpacing: -0.6, lineHeight: titleSize * 1.08 }}>{title}</Txt> : null}
          </View>
        ) : null}
        {children}
      </View>
      <Wave height={40} />
    </View>
  );
}

/** Lima pill button for the header's right slot ("Agregar persona"). */
export function HeaderPill({ icon = "plus", label, onPress }: { icon?: IconName; label: string; onPress: () => void }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ height: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: colors.lima, flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={icon} color={colors.selva} size={18} width={2.4} />
      <Txt w="extrabold" size={14} color={colors.selva}>{label}</Txt>
    </Tap>
  );
}

/** Big success mark (lima disc with a selva check), for "Invitación enviada" / "Pedido enviado". */
export function DoneMark({ size = 72, tone = "ok" }: { size?: number; tone?: "ok" | "danger" }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone === "ok" ? colors.limaSoft : colors.dangerSoft, alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
      <Icon name={tone === "ok" ? "check" : "x"} color={tone === "ok" ? colors.selva : colors.danger} size={size / 2} width={2.6} />
    </View>
  );
}

/** Dotted orbit with three dots (Login, Onboarding done): the brand's "órbita conectada". */
export function Orbit({ width = 390, height = 300 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 390 300" style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
      <Ellipse cx={195} cy={130} rx={178} ry={118} fill="none" stroke={colors.ring} strokeWidth={2} strokeDasharray="2 10" strokeLinecap="round" />
      <Circle cx={30} cy={170} r={6} fill={colors.pasto} />
      <Circle cx={345} cy={56} r={6} fill={colors.link} />
      <Circle cx={330} cy={220} r={5} fill={colors.lima} />
    </Svg>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 22, shadowColor: colors.selva, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, position: "relative" },
  segPill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 999, backgroundColor: colors.selva, shadowColor: colors.selva, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  segTab: { height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  track: { width: 52, height: 32, borderRadius: 16 },
  knob: { position: "absolute", top: 4, left: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  radio: { height: 42, paddingHorizontal: 16, borderRadius: 21, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  pillInput: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20 },
  toast: { gap: 10, padding: 14, backgroundColor: colors.card, borderRadius: 22, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  toastIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  toastBtn: { height: 40, paddingHorizontal: 12, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
