import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Animated, ScrollView, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import { colors, fonts, shadow } from "@trazagro/shared";
import { Icon, type IconName } from "../Icon";
import { Kicker, Sheet, Txt, Wave } from "../kit";
import { EASE, Tap } from "../motion";

/** Tap that takes `flex` of its row (Tap puts its style on an inner view, so flex must sit on a wrapper). */
export function FlexTap({ flex = 1, ...props }: Parameters<typeof Tap>[0] & { flex?: number }) {
  return <View style={{ flex }}><Tap {...props} /></View>;
}

/** Mockup text field: 56 px white pill with a hairline, 16 px semibold text, label above in 14 px muted. */
export function WizField({ label, inputRef, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; inputRef?: Ref<any> }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6, flex: (style as ViewStyle | undefined)?.flex }}>
      <Txt w="semibold" size={14} color={colors.textMuted}>{label}</Txt>
      <TextInput ref={inputRef} placeholderTextColor="#9AA39D" accessibilityLabel={label} {...props}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }} onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        style={[s.field, { fontFamily: fonts.semibold, outlineStyle: "none" } as object, focus && { borderColor: colors.selva, borderWidth: 2, paddingHorizontal: 19 }, props.editable === false && { opacity: 0.5 }]} />
    </View>
  );
}

export interface Option { id: string; label: string; sub?: string }

/** Looks like the mockups' <select> (56 px pill with a chevron); opens a sheet with the options. */
export function SelectField({ label, value, options, onChange, placeholder = "Elegir", sheetTitle, style }: {
  label: string; value?: string; options: Option[]; onChange: (id: string) => void; placeholder?: string; sheetTitle?: string; style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value);
  return (
    <View style={[{ gap: 6 }, style]}>
      <Txt w="semibold" size={14} color={colors.textMuted}>{label}</Txt>
      <Tap accessibilityRole="button" accessibilityLabel={`${label}: ${cur?.label ?? placeholder}`} onPress={() => setOpen(true)} style={[s.field, s.select]}>
        <Txt w="semibold" size={16} color={cur ? colors.text : "#9AA39D"} style={{ flex: 1 }} numberOfLines={1}>{cur?.label ?? placeholder}</Txt>
        <Icon name="down" color={colors.textMuted} size={18} width={2.4} />
      </Tap>
      <Sheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? label}>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 8 }}>
          {options.map((o) => (
            <RadioRow key={o.id} label={o.label} sub={o.sub} on={o.id === value} onPress={() => { onChange(o.id); setOpen(false); }} />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

/** Option with a round radio (SheetCompartir's "Para qué" rows). */
export function RadioRow({ label, sub, on, onPress }: { label: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} aria-selected={on} onPress={onPress}
      style={[s.radioRow, { borderColor: on ? colors.selva : colors.line }]}>
      <View style={[s.radio, { borderColor: on ? colors.selva : "#B0B8AA" }]}>{on ? <View style={s.radioDot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={15}>{label}</Txt>
        {sub ? <Txt size={12} color={colors.textMuted} style={{ lineHeight: 16 }}>{sub}</Txt> : null}
      </View>
    </Tap>
  );
}

/** Two-up choice button (sex, origin, reason). `icon` gives the origin-card look (104 px with a tinted circle). */
export function ChoiceCard({ label, sub, on, onPress, icon, tint, danger, style }: {
  label: string; sub?: string; on: boolean; onPress: () => void; icon?: IconName; tint?: [string, string]; danger?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const border = on ? (danger ? colors.danger : colors.selva) : icon ? "transparent" : colors.line;
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} aria-selected={on} onPress={onPress}
      style={[icon ? s.originCard : sub ? s.reasonCard : s.choice, { borderColor: border }, on && danger ? { backgroundColor: colors.dangerSoft } : null, style]}>
      {icon && tint ? <View style={[s.originIcon, { backgroundColor: tint[0] }]}><Icon name={icon} color={tint[1]} size={22} /></View> : null}
      <View style={{ gap: 2, alignItems: icon || sub ? "flex-start" : "center" }}>
        <Txt w="bold" size={sub ? 15 : 16}>{label}</Txt>
        {sub ? <Txt size={12} color={colors.textMuted}>{sub}</Txt> : null}
      </View>
    </Tap>
  );
}

/** "Todavía no tiene arete" style checkbox card. */
export function CheckCard({ title, text, on, onPress }: { title: string; text?: string; on: boolean; onPress: () => void }) {
  return (
    <Tap accessibilityRole="checkbox" accessibilityLabel={title} accessibilityState={{ checked: on }} aria-checked={on} onPress={onPress}
      style={[s.check, { borderColor: on ? colors.selva : colors.line }]}>
      <View style={[s.box, on ? { backgroundColor: colors.selva, borderWidth: 0 } : null]}>{on ? <Icon name="check" color={colors.onDark} size={16} width={3} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={15}>{title}</Txt>
        {text ? <Txt size={14} color={colors.textMuted}>{text}</Txt> : null}
      </View>
    </Tap>
  );
}

/** Small inline checkbox line used inside notes ("Le avisé al comprador…"). */
export function CheckLine({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Tap accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on }} aria-checked={on} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
      <View style={[s.box, { width: 22, height: 22, borderRadius: 6 }, on ? { backgroundColor: colors.selva, borderWidth: 0 } : null]}>
        {on ? <Icon name="check" color={colors.onDark} size={14} width={3} /> : null}
      </View>
      <Txt w="bold" size={14} color={colors.signalText} style={{ flex: 1 }}>{label}</Txt>
    </Tap>
  );
}

/** Dashed outline button: "Tomar foto (opcional)". */
export function DashedButton({ icon = "camera", label, onPress, height = 52, done }: { icon?: IconName; label: string; onPress: () => void; height?: number; done?: boolean }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[s.dashed, { height, borderRadius: height / 2 }, done ? { borderStyle: "solid", borderColor: colors.lima, backgroundColor: colors.tint } : null]}>
      <Icon name={done ? "check" : icon} color={done ? colors.selva : colors.tierra} size={20} width={done ? 2.6 : 2} />
      <Txt w="bold" size={15} color={done ? colors.selva : colors.tierra}>{label}</Txt>
    </Tap>
  );
}

/** Tinted note with an icon (category hint, "se anota solo el parto…", "el precio va a Costos"). */
export function Note({ icon, children, tone = "ok" }: { icon: IconName; children: ReactNode; tone?: "ok" | "tint" | "warn" | "danger" }) {
  const pal = { ok: [colors.limaSoft, colors.selva], tint: [colors.tint, colors.selva], warn: [colors.warnSoft, colors.signalText], danger: [colors.dangerSoft, colors.danger] }[tone];
  return (
    <View style={[s.note, { backgroundColor: pal[0] }]}>
      <Icon name={icon} color={tone === "warn" ? colors.warn : pal[1]} size={20} />
      <View style={{ flex: 1 }}>{typeof children === "string" ? <Txt w="semibold" size={14} color={tone === "tint" ? colors.text : pal[1]} style={{ lineHeight: 19 }}>{children}</Txt> : children}</View>
    </View>
  );
}

/** Segmented control with the sliding selva pill (Ficha "Peso · Salud · Partos", Compartir tabs). */
export function SegTabs<T extends string>({ tabs, value, onChange, bg = colors.card }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void; bg?: string }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, tabs.findIndex((t) => t.id === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => { Animated.timing(x, { toValue: idx, duration: 380, easing: EASE, useNativeDriver: true }).start(); }, [idx, x]);
  const cell = tabs.length ? (w - 8 - (tabs.length - 1) * 4) / tabs.length : 0;
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[s.seg, { backgroundColor: bg }, bg === colors.card ? { borderWidth: 1, borderColor: colors.outline } : null]}>
      {w ? <Animated.View style={[s.segPill, { width: cell, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, cell + 4] }) }] }]} /> : null}
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <FlexTap key={t.id} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} aria-selected={on} onPress={() => onChange(t.id)}
            style={s.segTab}>
            <Txt w="bold" size={tabs.length > 2 ? 14 : 13} color={on ? colors.onDark : colors.textMuted} numberOfLines={1}>{t.label}</Txt>
          </FlexTap>
        );
      })}
    </View>
  );
}

/** Floating selva action bar at the bottom (wizard Atrás/Siguiente, Ficha actions). */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.bar, { bottom: 16 + insets.bottom }]}>{children}</View>;
}

export function BarGhost({ label, onPress, disabled, icon, accessibilityLabel }: { label?: string; onPress: () => void; disabled?: boolean; icon?: IconName; accessibilityLabel?: string }) {
  return (
    <Tap accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} disabled={disabled}
      style={[s.barGhost, icon && !label ? { width: 52, paddingHorizontal: 0 } : null]}>
      {icon ? <Icon name={icon} color={colors.onDark} size={22} /> : null}
      {label ? <Txt w="bold" size={15} color={colors.onDark}>{label}</Txt> : null}
    </Tap>
  );
}

export function BarMain({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <FlexTap accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={s.barMain}>
      <Txt w="extrabold" size={16} color={colors.selva}>{label}</Txt>
    </FlexTap>
  );
}

/**
 * Wizard header (NuevoAnimal.dc): round close/back button, centered lima kicker and, optionally, the
 * four step dots joined by a dashed line; then the grass wave.
 */
export function WizardHeader({ kicker, icon = "x", closeLabel, onClose, steps, step = 0 }: {
  kicker: string; icon?: IconName; closeLabel: string; onClose: () => void; steps?: string[]; step?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <View style={[s.wizHead, { paddingTop: insets.top + 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Tap accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} hitSlop={6} style={s.round}>
            <Icon name={icon} color={colors.onDark} size={icon === "x" ? 20 : 22} width={icon === "x" ? 2.4 : 2.2} />
          </Tap>
          <Kicker>{kicker}</Kicker>
          <View style={{ width: 46 }} />
        </View>
        {steps ? (
          <View style={{ flexDirection: "row", paddingHorizontal: 8 }}>
            <View pointerEvents="none" style={s.dashLine}>
              <Svg width="100%" height={2}><Line x1="0" y1="1" x2="100%" y2="1" stroke="rgba(174,213,129,0.6)" strokeWidth={2} strokeDasharray="6 5" /></Svg>
            </View>
            {steps.map((l, i) => {
              const done = i < step, now = i === step;
              return (
                <View key={l} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <View style={[s.dot, now ? s.dotNow : done ? s.dotDone : s.dotIdle]}>
                    {done ? <Icon name="check" color={colors.selva} size={16} width={3} /> : <Txt w="extrabold" size={14} color={now ? colors.selva : colors.onDarkMuted}>{i + 1}</Txt>}
                  </View>
                  <Txt w="semibold" size={12} color={now ? colors.onDark : colors.onDarkMuted}>{l}</Txt>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <Wave height={40} />
    </View>
  );
}

export const cardShadow = shadow;

const s = StyleSheet.create({
  field: { height: 56, borderRadius: 28, paddingHorizontal: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outline, fontSize: 16, color: colors.text },
  select: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 16 },
  radioRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, minHeight: 52 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.selva },
  choice: { height: 56, borderRadius: 28, borderWidth: 2, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  reasonCard: { minHeight: 64, borderRadius: 20, borderWidth: 2, backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 14, justifyContent: "center" },
  originCard: { height: 104, borderRadius: 24, borderWidth: 2, backgroundColor: colors.card, padding: 14, justifyContent: "space-between", ...shadow },
  originIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  check: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
  dashed: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderStyle: "dashed", borderColor: "#C5D4B8" },
  note: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20 },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 999 },
  segPill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 999, backgroundColor: colors.selva, shadowColor: colors.selva, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  segTab: { height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  bar: { position: "absolute", left: 14, right: 14, height: 68, paddingHorizontal: 8, borderRadius: 34, backgroundColor: colors.selva, flexDirection: "row", alignItems: "center", gap: 8,
    shadowColor: colors.selva, shadowOpacity: 0.4, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  barGhost: { height: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.12)", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  barMain: { height: 52, borderRadius: 26, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
  wizHead: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6, gap: 14 },
  round: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: colors.glassLine, alignItems: "center", justifyContent: "center" },
  dashLine: { position: "absolute", left: 30, right: 30, top: 15, height: 2 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 1 },
  dotNow: { backgroundColor: colors.lima, outlineWidth: 5, outlineColor: "rgba(174,213,129,0.3)", outlineStyle: "solid" },
  dotDone: { backgroundColor: colors.onDark },
  dotIdle: { backgroundColor: colors.selva, borderWidth: 2, borderColor: "rgba(174,213,129,0.6)" },
});
