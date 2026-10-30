import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "@trazagro/shared";
import { setPref } from "../db/repo";
import { Icon, type IconName } from "../ui/Icon";
import { Button, Kicker, Txt } from "../ui/kit";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "tag", title: "Cada animal con su ficha", text: "Arete, chip RFID, madre, crías, vacunas y pesajes en un solo lugar." },
  { icon: "wifiOff", title: "Funciona sin señal", text: "Anota en el potrero. Cuando vuelvas a tener internet, se respalda solo." },
  { icon: "note", title: "Al día con el ICA", text: "Te avisamos los días de retiro y las novedades que debes reportar en SINIGAN." },
];

/** First open: what TrazAgro does and the personal-data consent required by Ley 1581 de 2012. */
export default function BienvenidaScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const last = step === STEPS.length;

  async function start(to: "/" | "/finca/nueva") {
    await setPref(db, "consent_1581", new Date().toISOString());
    router.replace("/");
    if (to !== "/") router.push(to);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.selva }} contentContainerStyle={[s.page, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <Kicker>TRAZAGRO</Kicker>
      {!last ? (
        <>
          <View style={s.icon}><Icon name={STEPS[step]!.icon} color={colors.selva} size={40} /></View>
          <Txt w="extrabold" size={32} color={colors.onDark} style={{ letterSpacing: -0.6 }}>{STEPS[step]!.title}</Txt>
          <Txt size={17} color={colors.onDarkMuted}>{STEPS[step]!.text}</Txt>
          <View style={s.dots}>{STEPS.map((_, i) => <View key={i} style={[s.dot, i === step && s.dotOn]} />)}</View>
          <View style={{ flex: 1 }} />
          <Button kind="lime" label="Siguiente" onPress={() => setStep(step + 1)} />
          <Pressable accessibilityRole="button" onPress={() => setStep(STEPS.length)} style={{ alignSelf: "center", padding: 12 }}>
            <Txt w="semibold" size={15} color={colors.onDarkMuted}>Saltar</Txt>
          </Pressable>
        </>
      ) : (
        <>
          <Txt w="extrabold" size={30} color={colors.onDark}>Tus datos son tuyos</Txt>
          <View style={s.card}>
            <Txt size={14} color={colors.text}>
              TrazAgro guarda los datos de tu finca y tus animales en este celular y, si inicias sesión, en nuestros servidores para respaldarlos y compartirlos con tu equipo.
              Tu número de celular se usa solo para entrar a la app. No vendemos tus datos. Puedes pedir que los corrijamos o borremos cuando quieras desde Ajustes.
            </Txt>
            <Txt size={12} color={colors.textMuted}>Tratamiento de datos personales según la Ley 1581 de 2012 y el Decreto 1377 de 2013.</Txt>
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={s.check}>
            <View style={[s.box, accepted && { backgroundColor: colors.lima, borderColor: colors.lima }]}>{accepted ? <Icon name="check" color={colors.selva} size={16} width={3} /> : null}</View>
            <Txt w="semibold" size={15} color={colors.onDark} style={{ flex: 1 }}>Autorizo el tratamiento de mis datos personales</Txt>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Button kind="lime" label="Registrar mi finca" disabled={!accepted} onPress={() => start("/finca/nueva")} />
          <Button kind="soft" label="Explorar con la finca de prueba" disabled={!accepted} onPress={() => start("/")} />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, gap: 16 },
  icon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center", marginTop: 24 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)" },
  dotOn: { width: 24, backgroundColor: colors.lima },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 8 },
  check: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 8 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.onDarkMuted, alignItems: "center", justifyContent: "center" },
});
