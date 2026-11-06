import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { canWrite, colors, num, plural, shadow } from "@trazagro/shared";
import { alertCounts } from "../db/finca";
import { useFarm } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { GreenHeader, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { StatBox, StateChip } from "../ui/finca/parts";

/** Fincas.dc: the open farm is a selva card, the others white; each with animals / hectares / alerts. */
export default function FincasScreen() {
  const router = useRouter();
  const { farm: current, farms, roleOf, selectFarm, refresh } = useFarm();
  const total = farms.reduce((n, f) => n + f.animalCount, 0);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const ids = farms.map((f) => f.id).join(",");
  const { data: alerts } = useDbQuery((d) => alertCounts(d, ids ? ids.split(",") : []), [ids]);

  async function open(id: string) {
    await selectFarm(id);
    router.dismissTo("/");
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker={`${plural(farms.length, "finca", "fincas")} · ${plural(total, "animal", "animales")} en total`.toUpperCase()} title="Mis fincas" waveHeight={40} />
      <View style={s.main}>
        {farms.some((f) => f.isDemo) ? (
          <Rise index={0}>
            <View style={s.demo}>
              <Icon name="info" color={colors.warn} size={18} />
              <Txt size={13} color={colors.amberText} style={{ flex: 1, lineHeight: 18 }}>La finca de prueba es solo para explorar: no se sube a tu cuenta. Puedes ocultarla en Ajustes.</Txt>
            </View>
          </Rise>
        ) : null}

        {farms.map((f, i) => {
          const on = f.id === current?.id;
          const editable = !f.isDemo && canWrite(roleOf(f.id), "farms");
          return (
            <Rise key={f.id} index={i + 1}>
              <Tap onPress={() => open(f.id)} accessibilityRole="button" accessibilityLabel={`Trabajar en ${f.name}`} accessibilityState={{ selected: on }}
                style={[s.card, on ? s.cardOn : s.cardOff]}>
                <View style={s.top}>
                  <View style={[s.icon, { backgroundColor: on ? "rgba(255,255,255,0.14)" : colors.greenSoft }]}>
                    <Icon name="barn" color={on ? colors.onDark : colors.selva} size={22} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt w="extrabold" size={17} color={on ? colors.onDark : colors.text} numberOfLines={1}>{f.name}</Txt>
                    <Txt size={13} color={on ? colors.onDarkMuted : colors.textMuted}>{`${f.municipality}, ${f.department}`}</Txt>
                  </View>
                  {on ? <StateChip label="Abierta" bg={colors.card} fg={colors.selva} /> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <StatBox dark={on} value={f.animalCount} label={f.animalCount === 1 ? "animal" : "animales"} />
                  <StatBox dark={on} value={f.hectares ? num(f.hectares) : "—"} label="hectáreas" />
                  <StatBox dark={on} value={alerts?.[f.id] ?? "…"} label={alerts?.[f.id] === 1 ? "alerta" : "alertas"} />
                </View>
                <View style={s.bottom}>
                  <Txt w="bold" size={12} color={on ? colors.onDarkMuted : colors.textMuted} style={{ flex: 1 }}>
                    {`Registro ICA: ${f.icaRegistration || "pendiente"}`}
                  </Txt>
                  {f.isDemo ? <StateChip label="Finca de prueba" bg={on ? colors.signal : colors.warnSoft} fg={on ? colors.signalText : colors.warn} /> : null}
                  {editable ? (
                    <Tap accessibilityRole="button" accessibilityLabel={`Editar ${f.name}`} hitSlop={6}
                      onPress={() => router.push({ pathname: "/finca/nueva", params: { id: f.id } })}
                      style={[s.edit, { backgroundColor: on ? "rgba(255,255,255,0.14)" : colors.greenSoft }]}>
                      <Icon name="edit" color={on ? colors.onDark : colors.selva} size={16} />
                      <Txt w="bold" size={13} color={on ? colors.onDark : colors.selva}>Editar</Txt>
                    </Tap>
                  ) : null}
                </View>
              </Tap>
            </Rise>
          );
        })}

        <Rise index={farms.length + 1}>
          <Tap accessibilityRole="button" accessibilityLabel="Registrar otra finca" onPress={() => router.push("/finca/nueva")} style={s.add}>
            <Icon name="plus" color={colors.tierraDeep} size={20} width={2.4} />
            <Txt w="extrabold" size={15} color={colors.tierraDeep}>Agregar otra finca</Txt>
          </Tap>
        </Rise>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  main: { paddingTop: 16, paddingHorizontal: 16, gap: 12 },
  demo: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.warnSoft, padding: 12, borderRadius: 20 },
  card: { borderRadius: 26, padding: 16, gap: 12 },
  cardOn: { backgroundColor: colors.selva },
  cardOff: { backgroundColor: colors.card, ...shadow },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  bottom: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  edit: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18 },
  add: { height: 56, borderRadius: 28, borderWidth: 2, borderStyle: "dashed", borderColor: "#C9C2B3", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
