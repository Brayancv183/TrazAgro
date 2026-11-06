import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@trazagro/shared";
import { api, ApiError } from "../lib/api";
import { loadSession } from "../lib/session";
import { Icon } from "../ui/Icon";
import { Button, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { CuentaHeader, StatusCard } from "../ui/cuenta/parts";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Una vaca no quiere comer y tiene la nariz seca",
  "¿Cada cuánto debo desparasitar los terneros?",
  "¿Qué hago si un parto no avanza?",
];

/** Chat with the VetConecta assistant (VetConecta.dc + AsistenteIA.dc). It orients; urgent cases always go to a veterinarian. */
export default function VetConectaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; login?: boolean }>();

  async function send(question = text) {
    const q = question.trim();
    if (!q || busy) return;
    const session = await loadSession();
    if (!session) return setError({ text: "Inicia sesión para usar VetConecta.", login: true });
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setText("");
    setError(undefined);
    setBusy(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { answer } = await api.vetAsk(session.token, next);
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages(messages);
      setText(q);
      setError({ text: e instanceof ApiError ? e.message : "No se pudo preguntar. Revisa tu conexión." });
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  const canSend = !!text.trim() && !busy;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.crema }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <CuentaHeader right={<View style={s.beta}><Txt w="extrabold" size={12} color={colors.tierraDeep}>Beta · necesita internet</Txt></View>}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={s.vetIcon}><Icon name="vet" color={colors.selva} size={26} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="semibold" size={11} color={colors.lima} style={{ letterSpacing: 2.4 }}>SERVICIOS · VETCONECTA</Txt>
              <Txt w="extrabold" size={26} color={colors.onDark} style={{ letterSpacing: -0.5, lineHeight: 28 }}>VetConecta</Txt>
            </View>
          </View>
          <Txt size={14} color={colors.onDarkMuted} style={{ lineHeight: 20 }}>Pregunta sobre la salud de tus animales al asistente veterinario.</Txt>
        </CuentaHeader>

        <View style={{ paddingHorizontal: 16, gap: 10 }} accessibilityLiveRegion="polite">
          <Rise index={0}>
            <View style={s.alarm}>
              <Txt w="bold" size={13} color={colors.urgentText}>Orienta, no reemplaza al veterinario.</Txt>
              <Txt size={13} color={colors.urgentText} style={{ lineHeight: 18 }}>Si un animal está caído, sangra o el parto no avanza, llama ya a tu veterinario.</Txt>
            </View>
          </Rise>

          {!messages.length ? (
            <Rise index={1}>
              <View style={s.intro}>
                <View style={[s.vetIcon, { width: 50, height: 50 }]}><Icon name="chat" color={colors.selva} size={24} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="extrabold" size={16} color={colors.onDark}>Pregúntale al asistente</Txt>
                  <Txt size={13} color={colors.onDarkMuted}>Escribe qué le pasa al animal o toca un ejemplo de abajo.</Txt>
                </View>
              </View>
            </Rise>
          ) : null}

          {messages.map((m, i) => (
            <Rise key={i} index={0} style={{ flexDirection: "row", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "user" ? (
                <View style={s.mine}><Txt size={15} color={colors.onDark} style={{ lineHeight: 21 }}>{m.content}</Txt></View>
              ) : (
                <View style={s.theirs}>
                  <Txt size={15} style={{ lineHeight: 22 }}>{m.content}</Txt>
                  <Txt size={11} color={colors.textMuted}>Orientación general, no es un diagnóstico.</Txt>
                </View>
              )}
            </Rise>
          ))}
          {busy ? (
            <View style={{ flexDirection: "row" }}>
              <View style={[s.theirs, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
                <Icon name="sparkle" color={colors.link} size={18} />
                <Txt size={14} color={colors.textMuted}>VetConecta está escribiendo…</Txt>
              </View>
            </View>
          ) : null}
          {error ? (
            <View style={{ gap: 10 }}>
              <StatusCard icon={error.login ? "lock" : "cloudOff"} tone="danger" title={error.text} />
              {error.login ? <Button label="Iniciar sesión" onPress={() => router.push("/cuenta")} /> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[s.dock, { paddingBottom: 12 + insets.bottom }]}>
        {!messages.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }} keyboardShouldPersistTaps="handled">
            {SUGGESTIONS.map((q) => (
              <Tap key={q} accessibilityRole="button" accessibilityLabel={q} onPress={() => send(q)} style={s.suggest}>
                <Txt w="semibold" size={13}>{q}</Txt>
              </Tap>
            ))}
          </ScrollView>
        ) : null}
        <View style={s.composer}>
          <TextInput value={text} onChangeText={setText} placeholder="Escribe tu pregunta" placeholderTextColor="#9AA39D" multiline
            accessibilityLabel="Tu pregunta" onSubmitEditing={() => send()}
            style={[s.input, { fontFamily: fonts.regular }, { outlineStyle: "none" } as never]} />
          <Tap accessibilityRole="button" accessibilityLabel="Enviar" disabled={!canSend} onPress={() => send()} style={s.send}>
            <Icon name="arrowRight" color={colors.lima} size={22} width={2.6} />
          </Tap>
        </View>
        <Txt size={11} color={colors.textMuted} style={{ textAlign: "center", paddingHorizontal: 14 }}>No receta dosis: eso lo decide un veterinario. Necesita internet.</Txt>
      </View>
    </KeyboardAvoidingView>
  );
}

const card = { shadowColor: colors.selva, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 } as const;
const s = StyleSheet.create({
  beta: { backgroundColor: colors.tierraSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  vetIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  alarm: { gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.dangerSoft },
  intro: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 24, backgroundColor: colors.selva },
  mine: { maxWidth: "82%", paddingVertical: 12, paddingHorizontal: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 6, backgroundColor: colors.selva },
  theirs: { maxWidth: "92%", padding: 14, gap: 8, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 6, backgroundColor: colors.card, ...card },
  dock: { paddingTop: 10, gap: 8, backgroundColor: colors.crema },
  suggest: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outline, justifyContent: "center" },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 60, marginHorizontal: 14, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, borderRadius: 30, backgroundColor: colors.card,
    shadowColor: colors.selva, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  input: { flex: 1, minWidth: 0, maxHeight: 120, paddingVertical: 10, fontSize: 15, color: colors.text },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
});
