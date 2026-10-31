import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, radius, shadow } from "@trazagro/shared";
import { Icon, type IconName } from "./Icon";

type Weight = keyof typeof fonts;

export function Txt({ children, w = "regular", size = 15, color = colors.text, style, numberOfLines }: {
  children: ReactNode; w?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts[w], fontSize: size, color }, style]}>{children}</Text>;
}

export function Kicker({ children, color = colors.lima }: { children: ReactNode; color?: string }) {
  return <Txt w="semibold" size={11} color={color} style={{ letterSpacing: 2.4 }}>{children}</Txt>;
}

/** Green header with the lime grass wave that every main screen uses. */
export function GreenHeader({ kicker, title, back, right, children }: {
  kicker?: string; title: string; back?: boolean; right?: ReactNode; children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        {back || right ? (
          <View style={s.headerTop}>
            {back ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.roundBtn} hitSlop={8}>
                <Icon name="back" color={colors.onDark} />
              </Pressable>
            ) : <View />}
            {right}
          </View>
        ) : null}
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <Txt w="extrabold" size={30} color={colors.onDark} style={{ letterSpacing: -0.6, marginTop: 2 }}>{title}</Txt>
        {children}
      </View>
      <View style={{ backgroundColor: colors.selva, height: 34, marginTop: -1, overflow: "hidden" }}>
        <Svg width="100%" height={36} viewBox="0 0 390 56" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0 }}>
          <Path d="M0 56V26C70 2 150 6 220 28s120 26 170 2v26z" fill={colors.pasto} />
          <Path d="M0 56V40C90 16 170 22 250 40s110 14 140 4v12z" fill={colors.crema} />
        </Svg>
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Ear-tag shaped chip with the animal's number. */
export function EarTag({ code, tone = colors.selva, size = 46 }: { code?: string; tone?: string; size?: number }) {
  const label = code ? code.slice(-3) : "—";
  return (
    <View style={{ width: size, height: size * 1.12, alignItems: "center" }} accessibilityLabel={code ? `Arete ${code}` : "Sin arete"}>
      <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size, borderWidth: 3, borderColor: tone, marginBottom: -3 }} />
      <View style={{ flex: 1, alignSelf: "stretch", backgroundColor: tone, borderRadius: size * 0.22, alignItems: "center", justifyContent: "center" }}>
        <Txt w="extrabold" size={size * 0.34} color={colors.onDark}>{label}</Txt>
      </View>
    </View>
  );
}

export function Chip({ label, active, onPress, tone }: { label: string; active?: boolean; onPress?: () => void; tone?: { bg: string; fg: string } }) {
  const bg = tone ? tone.bg : active ? colors.selva : colors.card;
  const fg = tone ? tone.fg : active ? colors.onDark : colors.text;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={label} accessibilityState={{ selected: !!active }} aria-selected={!!active}
      style={[s.chip, { backgroundColor: bg, borderColor: active || tone ? bg : colors.line }]}>
      <Txt w="semibold" size={13} color={fg}>{label}</Txt>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = "primary", icon, disabled, style }: {
  label: string; onPress: () => void; kind?: "primary" | "lime" | "soft" | "danger"; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const pal = {
    primary: [colors.selva, colors.onDark], lime: [colors.lima, colors.selva], soft: [colors.limaSoft, colors.selva], danger: [colors.danger, colors.onDark],
  }[kind];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: pal[0], opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
      {icon ? <Icon name={icon} color={pal[1]} size={20} /> : null}
      <Txt w="bold" size={16} color={pal[1]}>{label}</Txt>
    </Pressable>
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
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [s.menuRow, pressed && { opacity: 0.85 }]}>
      <View style={[s.menuIcon, { backgroundColor: tone === colors.selva ? colors.limaSoft : `${tone}1F` }]}><Icon name={icon} color={tone} size={20} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={16}>{title}</Txt>
        {detail ? <Txt size={13} color={colors.textMuted}>{detail}</Txt> : null}
      </View>
      {badge ? <View style={s.badge}><Txt w="bold" size={11} color={colors.warn}>{badge}</Txt></View> : null}
      <Icon name="chevron" color={colors.textMuted} size={18} />
    </Pressable>
  );
}

/** Bottom sheet over a dimmed background. Tapping outside closes it. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.grip} />
        <Txt w="extrabold" size={22} style={{ marginBottom: 8 }}>{title}</Txt>
        {children}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, minHeight: 64, ...shadow },
  menuIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  badge: { backgroundColor: colors.warnSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  scrim: { flex: 1, backgroundColor: "rgba(12,48,16,0.45)" },
  sheet: { backgroundColor: colors.crema, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 10 },
  grip: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 6 },
  header: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6, gap: 6 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  btn: { minHeight: 56, borderRadius: radius.pill, paddingHorizontal: 22, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.md, alignItems: "flex-start" },
  input: { minHeight: 54, borderRadius: radius.pill, paddingHorizontal: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, fontSize: 16, color: colors.text },
});
