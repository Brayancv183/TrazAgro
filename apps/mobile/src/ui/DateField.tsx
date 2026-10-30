import { StyleSheet, TextInput, View } from "react-native";
import { colors, fonts, radius } from "@trazagro/shared";
import { Txt } from "./kit";

export interface DayParts { d: string; m: string; y: string }

export const splitDay = (day: string): DayParts => ({ y: day.slice(0, 4), m: String(Number(day.slice(5, 7))), d: String(Number(day.slice(8, 10))) });

/** "YYYY-MM-DD" when the three parts form a real calendar date, otherwise undefined. */
export function toDay(p: DayParts): string | undefined {
  const y = Number(p.y), m = Number(p.m), d = Number(p.d);
  if (!(y > 1990 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return undefined;
  return date.toISOString().slice(0, 10);
}

/** Day / month / year boxes — works the same on every platform and with the number pad. */
export function DateField({ label, value, onChange }: { label: string; value: DayParts; onChange: (v: DayParts) => void }) {
  const part = (k: keyof DayParts, ph: string, w: number) => (
    <TextInput value={value[k]} onChangeText={(t) => onChange({ ...value, [k]: t.replace(/\D/g, "").slice(0, k === "y" ? 4 : 2) })}
      keyboardType="number-pad" placeholder={ph} placeholderTextColor="#9AA39D" accessibilityLabel={`${label}: ${ph}`}
      style={[s.part, { width: w, fontFamily: fonts.bold }]} />
  );
  return (
    <View style={{ gap: 6 }}>
      <Txt w="semibold" size={14} color={colors.textMuted}>{label}</Txt>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        {part("d", "Día", 70)}<Txt size={18} color={colors.textMuted}>/</Txt>{part("m", "Mes", 70)}<Txt size={18} color={colors.textMuted}>/</Txt>{part("y", "Año", 96)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  part: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, textAlign: "center", fontSize: 18, color: colors.text },
});
