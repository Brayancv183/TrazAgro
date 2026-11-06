import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@trazagro/shared";
import { setPref } from "../db/repo";
import { Icon, type IconName } from "../ui/Icon";
import { HeaderButton, Kicker, Txt, Wave } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { SoftCard } from "../ui/cuenta/parts";

/** Option tints from Onboarding.dc (g, r, b, y, e). */
const TINT = { g: [colors.limaSoft, colors.selva], r: [colors.rosaSoft, colors.rosa], b: [colors.infoSoft, colors.info], y: [colors.warnSoft, colors.warn], e: [colors.tierraSoft, colors.tierra] } as const;
type Opt = [id: string, label: string, sub: string, icon: IconName, tint: keyof typeof TINT];
type Question = { key: string; q: string; h: string; multi: boolean; all?: string; opts: Opt[] };

/** The onboarding questionnaire (Onboarding.dc). Answers are kept on the phone (pref "onboarding"). */
const QUESTIONS: Question[] = [
  { key: "rol", q: "¿Quién eres en la finca?", h: "Así sabemos para quién es la app.", multi: false, opts: [
    ["dueno", "Dueño o ganadero", "Manejo mi propia finca", "barn", "g"], ["tecnico", "Técnico o veterinario", "Atiendo varias fincas", "vet", "b"], ["admin", "Administrador o mayordomo", "Trabajo en la finca de otro", "users", "e"]] },
  { key: "prod", q: "¿Qué produce tu finca?", h: "Marca todas las que apliquen.", multi: true, all: "todo", opts: [
    ["todo", "Todo lo anterior", "Leche, carne, doble propósito y cría", "barn", "y"], ["leche", "Leche", "Ordeño diario", "drop", "b"], ["carne", "Carne / ceba", "Levante y engorde", "scale", "e"], ["doble", "Doble propósito", "Leche y carne", "cow", "g"], ["cria", "Cría", "Vendo terneros", "heart", "r"]] },
  { key: "hato", q: "¿Cuántos animales tienes?", h: "Un número aproximado está bien.", multi: false, opts: [
    ["s", "Menos de 20", "", "cow", "g"], ["m", "Entre 20 y 100", "", "cow", "g"], ["l", "Entre 100 y 500", "", "cow", "g"], ["xl", "Más de 500", "Te contacta un asesor", "cow", "g"]] },
  { key: "ident", q: "¿Cómo identificas a tus animales?", h: "Puedes marcar varias.", multi: true, opts: [
    ["visual", "Arete de número", "Arete plástico visual", "tag", "e"], ["rfid", "Arete RFID", "Electrónico, norma ICA", "scan", "g"], ["gps", "Orejera GPS", "Ubicación en el mapa", "map", "b"], ["nada", "Todavía no", "Te ayudamos a empezar", "store", "y"]] },
  { key: "meta", q: "¿Qué quieres controlar primero?", h: "Puedes marcar varias.", multi: true, opts: [
    ["vac", "Vacunas y salud", "", "syringe", "g"], ["leche", "Producción de leche", "", "drop", "b"], ["peso", "Peso y crecimiento", "", "scale", "e"], ["partos", "Partos y preñeces", "", "heart", "r"], ["mapa", "Dónde está el ganado", "", "map", "b"], ["plata", "Costos y ganancias", "", "money", "y"]] },
];
type Answers = Record<string, string | Record<string, boolean>>;

/**
 * First open: a short questionnaire in the look of Onboarding.dc, then the personal-data consent required by
 * Ley 1581 de 2012. "Saltar" goes straight to the consent. ?ver=1 (from Ajustes) only shows the consent text again.
 */
export default function BienvenidaScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ver } = useLocalSearchParams<{ ver?: string }>();
  const review = ver === "1";
  const total = QUESTIONS.length;
  const [step, setStep] = useState(review ? total : 0);
  const [accepted, setAccepted] = useState(review);
  const [ans, setAns] = useState<Answers>({});
  const consent = step >= total;
  const q = QUESTIONS[Math.min(step, total - 1)]!;

  async function start(to: "/" | "/finca/nueva") {
    await setPref(db, "consent_1581", new Date().toISOString());
    if (Object.keys(ans).length) await setPref(db, "onboarding", JSON.stringify(ans));
    router.replace("/");
    if (to !== "/") router.push(to);
  }

  function pick(o: Opt) {
    const a = { ...ans };
    if (q.multi) {
      const m = { ...((a[q.key] as Record<string, boolean>) ?? {}) };
      if (q.all && o[0] === q.all) { const on = !m[q.all]; q.opts.forEach((x) => { m[x[0]] = on; }); }
      else { m[o[0]] = !m[o[0]]; if (q.all) m[q.all] = q.opts.every((x) => x[0] === q.all || m[x[0]]); }
      a[q.key] = m;
    } else a[q.key] = o[0];
    setAns(a);
  }
  const isOn = (o: Opt) => { const v = ans[q.key]; return q.multi ? !!(v && typeof v === "object" && v[o[0]]) : v === o[0]; };

  const counter = review ? "TUS DATOS" : consent ? "ÚLTIMO PASO" : `PREGUNTA ${step + 1} DE ${total}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.crema }}>
      <ScrollView contentContainerStyle={{ paddingBottom: (consent && !review ? 150 : 96) + insets.bottom }}>
        <View style={[s.header, { paddingTop: insets.top + 18 }]}>
          <View style={s.topRow}>
            <View style={{ opacity: step > 0 && !review ? 1 : review ? 1 : 0 }} pointerEvents={step > 0 || review ? "auto" : "none"}>
              <HeaderButton icon="back" label={review ? "Volver" : "Pregunta anterior"}
                onPress={() => (review ? (router.canGoBack() ? router.back() : router.replace("/ajustes")) : setStep(Math.max(0, step - 1)))} />
            </View>
            <Kicker>{counter}</Kicker>
            {!consent ? (
              <Tap accessibilityRole="button" accessibilityLabel="Saltar" onPress={() => setStep(total)} style={s.skip}>
                <Txt w="semibold" size={13} color={colors.onDarkMuted}>Saltar</Txt>
              </Tap>
            ) : <View style={{ width: 46 }} />}
          </View>
          {!review ? (
            <View style={{ flexDirection: "row", gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: total + 1 }, (_, i) => (
                <View key={i} style={[s.bar, { backgroundColor: i < step ? colors.lima : i === step ? "#FFFFFF" : "rgba(255,255,255,0.2)" }]} />
              ))}
            </View>
          ) : null}
          <Txt w="extrabold" size={28} color={colors.onDark} style={{ letterSpacing: -0.56, lineHeight: 31 }}>{consent ? "Tus datos son tuyos" : q.q}</Txt>
          <Txt size={14} color={colors.onDarkMuted}>{consent ? (review ? "Así cuidamos la información de tu finca." : "Antes de empezar, lee cómo cuidamos tu información.") : q.h}</Txt>
        </View>
        <Wave height={40} />

        <View style={{ paddingHorizontal: 16, gap: 10 }} key={step}>
          {!consent ? q.opts.map((o, i) => {
            const on = isOn(o);
            const t = TINT[o[4]];
            return (
              <Rise key={o[0]} index={i}>
                <Tap accessibilityRole={q.multi ? "checkbox" : "radio"} accessibilityLabel={o[1]} accessibilityState={{ checked: on }} aria-checked={on}
                  onPress={() => pick(o)} style={[s.opt, on ? s.optOn : null]}>
                  <View style={[s.optIcon, { backgroundColor: t[0] }]}><Icon name={o[3]} color={t[1]} size={22} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt w="bold" size={16}>{o[1]}</Txt>
                    {o[2] ? <Txt size={12} color={colors.textMuted}>{o[2]}</Txt> : null}
                  </View>
                  <View style={[s.mark, { borderRadius: q.multi ? 8 : 13 }, on ? { backgroundColor: colors.selva, borderWidth: 0 } : null]}>
                    {on ? <Icon name="check" color="#FFFFFF" size={14} width={3} /> : null}
                  </View>
                </Tap>
              </Rise>
            );
          }) : (
            <>
              <Rise index={0}>
                <SoftCard style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <View style={[s.optIcon, { backgroundColor: colors.limaSoft }]}><Icon name="lock" color={colors.selva} size={22} /></View>
                    <Txt w="bold" size={16} style={{ flex: 1 }}>Tratamiento de datos personales</Txt>
                  </View>
                  <Txt size={14} color={colors.text} style={{ lineHeight: 21 }}>
                    TrazAgro guarda los datos de tu finca y tus animales en este celular y, si inicias sesión, en nuestros servidores para respaldarlos y compartirlos con tu equipo.
                    Tu número de celular se usa solo para entrar a la app. No vendemos tus datos. Puedes pedir que los corrijamos o borremos cuando quieras desde Ajustes.
                  </Txt>
                  <Txt size={12} color={colors.textMuted}>Según la Ley 1581 de 2012 y el Decreto 1377 de 2013.</Txt>
                </SoftCard>
              </Rise>
              {!review ? (
                <Rise index={1}>
                  <Tap accessibilityRole="checkbox" accessibilityLabel="Autorizo el tratamiento de mis datos personales" accessibilityState={{ checked: accepted }} aria-checked={accepted}
                    onPress={() => setAccepted(!accepted)} style={[s.opt, { paddingLeft: 18 }, accepted ? s.optOn : null]}>
                    <View style={{ flex: 1 }}><Txt w="bold" size={15}>Autorizo el tratamiento de mis datos personales</Txt></View>
                    <View style={[s.mark, { borderRadius: 8 }, accepted ? { backgroundColor: colors.selva, borderWidth: 0 } : null]}>
                      {accepted ? <Icon name="check" color="#FFFFFF" size={14} width={3} /> : null}
                    </View>
                  </Tap>
                </Rise>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <View style={[s.bottom, { bottom: 16 + insets.bottom }]}>
        {!consent ? (
          <Tap accessibilityRole="button" accessibilityLabel="Continuar" onPress={() => setStep(step + 1)} style={s.cta}>
            <Txt w="bold" size={17} color={colors.onDark}>Continuar</Txt>
          </Tap>
        ) : review ? (
          <Tap accessibilityRole="button" accessibilityLabel="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/ajustes"))} style={s.cta}>
            <Txt w="bold" size={17} color={colors.onDark}>Volver</Txt>
          </Tap>
        ) : (
          <>
            <Tap accessibilityRole="button" accessibilityLabel="Registrar mi finca" disabled={!accepted} onPress={() => start("/finca/nueva")} style={s.cta}>
              <Txt w="bold" size={17} color={colors.onDark}>Registrar mi finca</Txt>
            </Tap>
            <Tap accessibilityRole="button" accessibilityLabel="Explorar con la finca de prueba" disabled={!accepted} onPress={() => start("/")} style={s.ghost}>
              <Txt w="bold" size={14} color={colors.tierra}>Explorar con la finca de prueba</Txt>
              <Icon name="arrowRight" color={colors.tierra} size={16} width={2.4} />
            </Tap>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6, gap: 14 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skip: { height: 40, minWidth: 46, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66, paddingVertical: 8, paddingLeft: 10, paddingRight: 14, borderRadius: 24, backgroundColor: colors.card,
    borderWidth: 2, borderColor: "transparent", shadowColor: colors.selva, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  optOn: { borderColor: colors.selva, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  optIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  mark: { width: 26, height: 26, flexShrink: 0, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#B0B8AA" },
  bottom: { position: "absolute", left: 14, right: 14, gap: 4 },
  cta: { height: 60, borderRadius: 30, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center",
    shadowColor: colors.selva, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  ghost: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
});
