import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, radius, shadow } from "@trazagro/shared";
import { Icon, type IconName } from "./Icon";
import { EASE, Tap } from "./motion";

type Weight = keyof typeof fonts;

export function Txt({ children, w = "regular", size = 15, color = colors.text, style, numberOfLines }: {
  children: ReactNode; w?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts[w], fontSize: size, color }, style]}>{children}</Text>;
}

export function Kicker({ children, color = colors.lima }: { children: ReactNode; color?: string }) {
  return <Txt w="semibold" size={11} color={color} style={{ letterSpacing: 2.4 }}>{children}</Txt>;
}

/** The grass wave under every green header: pasto band over the cream page. */
export function Wave({ height = 44, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.selva, height, marginTop: -1, overflow: "hidden" }, style]}>
      <Svg width="100%" height={height + 1} viewBox="0 0 390 56" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0 }}>
        <Path d="M0 56V26C70 2 150 6 220 28s120 26 170 2v26z" fill={colors.pasto} />
        <Path d="M0 56V40C90 16 170 22 250 40s110 14 140 4v12z" fill={colors.crema} />
      </Svg>
    </View>
  );
}

/** Round 46 px glass button for the green header (back, share, edit...). */
export function HeaderButton({ icon, label, onPress, size = 46 }: { icon: IconName; label: string; onPress: () => void; size?: number }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: colors.glassLine, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} color={colors.onDark} size={22} />
    </Tap>
  );
}

/**
 * Green header from the mockups: 11 px lima kicker with wide tracking, 32 px extrabold title (an optional
 * `accent` part in lima, like "Animales 48"), optional back button / right slot, then the grass wave.
 */
export function GreenHeader({ kicker, title, accent, back, right, children, waveHeight = 44 }: {
  kicker?: string; title: string; accent?: string; back?: boolean; right?: ReactNode; children?: ReactNode; waveHeight?: number;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View>
      <View style={[s.header, { paddingTop: insets.top + 18 }]}>
        {back || right ? (
          <View style={s.headerTop}>
            {back ? <HeaderButton icon="back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} /> : <View />}
            {right}
          </View>
        ) : null}
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <Txt w="extrabold" size={32} color={colors.onDark} style={{ letterSpacing: -0.64, lineHeight: 36 }}>
          {title}{accent ? <Txt w="extrabold" size={32} color={colors.lima}>{` ${accent}`}</Txt> : null}
        </Txt>
        {children}
      </View>
      <Wave height={waveHeight} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Ear tag from the mockups: tag silhouette with its hole, last 3 digits in white. Green for females, brown for males. */
export function EarTag({ code, tone = colors.link, size = 40 }: { code?: string; tone?: string; size?: number }) {
  const label = code ? code.slice(-3) : "-";
  const h = size * 1.15;
  return (
    <View style={{ width: size, height: h }} accessibilityLabel={code ? `Arete ${code}` : "Sin arete"}>
      <Svg width={size} height={h} viewBox="0 0 40 46">
        <Path d="M20 2a7 7 0 0 1 7 7v3h7a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4h7V9a7 7 0 0 1 7-7z" fill={tone} />
        <Circle cx={20} cy={9} r={2.6} fill="#FFFFFF" />
      </Svg>
      <Txt w="extrabold" size={Math.round(size * 0.3)} color={colors.onDark} style={{ position: "absolute", left: 0, right: 0, top: h * 0.42, textAlign: "center" }}>{label}</Txt>
    </View>
  );
}

/** Ear-tag color by sex, as in the mockups. */
export const tagTone = (sex?: string) => (sex === "macho" ? colors.tierra : colors.link);

/** Filter / choice chip: 38 px pill; selected = selva with white text, idle = white with a hairline. */
export function Chip({ label, active, onPress, tone }: { label: string; active?: boolean; onPress?: () => void; tone?: { bg: string; fg: string } }) {
  const bg = tone ? tone.bg : active ? colors.selva : colors.card;
  const fg = tone ? tone.fg : active ? colors.onDark : colors.text;
  const body = <Txt w="semibold" size={14} color={fg}>{label}</Txt>;
  const style = [s.chip, { backgroundColor: bg, borderColor: active || tone ? bg : colors.outline }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} aria-selected={!!active} style={style}>
      {body}
    </Tap>
  );
}

export type PillTone = "warn" | "danger" | "info" | "ok" | "earth" | "muted";
const PILL: Record<PillTone, { bg: string; fg: string }> = {
  warn: { bg: colors.signal, fg: colors.signalText },
  danger: { bg: colors.urgent, fg: colors.onDark },
  info: { bg: colors.infoSoft, fg: colors.info },
  ok: { bg: colors.limaSoft, fg: colors.selva },
  earth: { bg: colors.tierraSoft, fg: colors.tierraDeep },
  muted: { bg: colors.sand, fg: colors.textMuted },
};

/** Small status label (11 px bold pill): "Dias de espera", "RFID", "Prenada"... */
export function Pill({ label, tone = "ok" }: { label: string; tone?: PillTone }) {
  const p = PILL[tone];
  return (
    <View style={{ backgroundColor: p.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Txt w="bold" size={11} color={p.fg}>{label}</Txt>
    </View>
  );
}

export function Button({ label, onPress, kind = "primary", icon, disabled, style }: {
  label: string; onPress: () => void; kind?: "primary" | "lime" | "soft" | "danger" | "earth" | "ghost"; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const pal = {
    primary: [colors.selva, colors.onDark], lime: [colors.lima, colors.selva], soft: [colors.limaSoft, colors.selva],
    danger: [colors.urgent, colors.onDark], earth: [colors.tierra, colors.onDark], ghost: [colors.sand, colors.text],
  }[kind];
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
      style={[s.btn, { backgroundColor: pal[0] }, style]}>
      {icon ? <Icon name={icon} color={pal[1]} size={20} width={2.4} /> : null}
      <Txt w="bold" size={16} color={pal[1]}>{label}</Txt>
    </Tap>
  );
}

/** Floating brown action button: round (+) or extended with a label ("Nuevo"). Sits above the tab bar. */
export function Fab({ label, accessibilityLabel, onPress, bottom = 98 }: { label?: string; accessibilityLabel: string; onPress: () => void; bottom?: number }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={[s.fab, { bottom }, label ? { paddingLeft: 16, paddingRight: 20 } : { width: 58, height: 58, borderRadius: 29 }]}>
      <Icon name="plus" color={colors.onDark} size={label ? 22 : 26} width={2.4} />
      {label ? <Txt w="bold" size={15} color={colors.onDark}>{label}</Txt> : null}
    </Tap>
  );
}

export function Banner({ icon, title, text, tone = "warn" }: { icon: IconName; title: string; text?: string; tone?: "warn" | "ok" | "danger" }) {
  const pal = { warn: [colors.warnSoft, colors.warn], ok: [colors.limaSoft, colors.selva], danger: [colors.dangerSoft, colors.danger] }[tone];
  return (
    <View style={[s.banner, { backgroundColor: pal[0] }]}>
      <Icon name={icon} color={pal[1]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={15} color={pal[1]}>{title}</Txt>
        {text ? <Txt size={13} color={pal[1]}>{text}</Txt> : null}
      </View>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt w="semibold" size={14} color={colors.textMuted}>{label}</Txt>
      <TextInput placeholderTextColor="#9AA39D" {...props}
        style={[s.input, { fontFamily: fonts.semibold }, props.style]} />
    </View>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 6 }}>
      <Txt w="bold" size={17}>{title}</Txt>
      <Txt size={14} color={colors.textMuted} style={{ textAlign: "center" }}>{text}</Txt>
    </View>
  );
}

/** Tappable list row: round icon, title, optional detail and a chevron. */
export function MenuRow({ icon, title, detail, onPress, tone = colors.selva, badge }: {
  icon: IconName; title: string; detail?: string; onPress: () => void; tone?: string; badge?: string;
}) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={s.menuRow}>
      <View style={[s.menuIcon, { backgroundColor: tone === colors.selva ? colors.limaSoft : `${tone}1F` }]}><Icon name={icon} color={tone} size={20} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={16}>{title}</Txt>
        {detail ? <Txt size={13} color={colors.textMuted}>{detail}</Txt> : null}
      </View>
      {badge ? <View style={s.badge}><Txt w="bold" size={11} color={colors.warn}>{badge}</Txt></View> : null}
      <Icon name="chevron" color={colors.textMuted} size={18} />
    </Tap>
  );
}

/**
 * Bottom sheet from the mockups: white, 30 px top corners, grip, 22 px title with a round close button.
 * The scrim fades in (0.3 s) while the sheet slides up (0.42 s, iOS curve); closing plays it backwards.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const v = useRef(new Animated.Value(0)).current;
  const [h, setH] = useState(600);
  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(v, { toValue: 1, duration: 420, easing: EASE, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(v, { toValue: 0, duration: 260, easing: EASE, useNativeDriver: true }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: v }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>
      <Animated.View onLayout={(e) => setH(e.nativeEvent.layout.height)} accessibilityViewIsModal
        style={[s.sheet, { paddingBottom: insets.bottom + 28, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [h, 0] }) }] }]}>
        <View style={s.grip} />
        <View style={s.sheetHead}>
          <Txt w="extrabold" size={22} style={{ flex: 1 }}>{title}</Txt>
          <Tap accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={s.sheetClose}>
            <Icon name="x" color={colors.text} size={18} width={2.4} />
          </Tap>
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 12, minHeight: 64, ...shadow },
  menuIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  badge: { backgroundColor: colors.warnSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%", backgroundColor: colors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 16, gap: 16, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 40, shadowOffset: { width: 0, height: -10 }, elevation: 24 },
  grip: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.grip },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: colors.selva, paddingHorizontal: 18, paddingBottom: 0, gap: 4 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: 16, ...shadow },
  chip: { height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btn: { minHeight: 56, borderRadius: 28, paddingHorizontal: 22, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  fab: { position: "absolute", right: 18, height: 56, borderRadius: 28, backgroundColor: colors.tierra, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#4D342E", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  banner: { flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.md, alignItems: "flex-start" },
  input: { minHeight: 54, borderRadius: radius.pill, paddingHorizontal: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, fontSize: 16, color: colors.text },
});
