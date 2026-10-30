import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts, radius } from "@trazagro/shared";
import { api, ApiError } from "../lib/api";
import { loadSession } from "../lib/session";
import { Icon } from "../ui/Icon";
import { Banner, Button, Chip, GreenHeader, Txt } from "../ui/kit";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Una vaca no quiere comer y tiene la nariz seca",
  "¿Cada cuánto debo desparasitar los terneros?",
  "¿Qué hago si un parto no avanza?",
];

/** Chat with the VetConecta assistant. It orients; urgent cases always go to a veterinarian. */
export default function VetConectaScreen() {
  const router = useRouter();
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker="SERVICIOS · BETA" title="VetConecta">
          <Txt w="medium" size={15} color={colors.onDarkMuted}>Pregunta sobre la salud de tus animales.</Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <Banner icon="note" tone="warn" title="Orienta, no reemplaza al veterinario" text="Si un animal está caído, sangra o el parto no avanza, llama ya a tu veterinario." />
          {!messages.length ? (
            <View style={{ gap: 8 }}>
              <Txt w="semibold" size={14} color={colors.textMuted}>Por ejemplo:</Txt>
              {SUGGESTIONS.map((q) => <Chip key={q} label={q} onPress={() => send(q)} />)}
            </View>
          ) : null}
          {messages.map((m, i) => (
            <View key={i} style={[s.bubble, m.role === "user" ? s.mine : s.theirs]}>
              <Txt size={15} color={m.role === "user" ? colors.onDark : colors.text}>{m.content}</Txt>
            </View>
          ))}
          {busy ? <Txt size={14} color={colors.textMuted}>VetConecta está escribiendo…</Txt> : null}
          {error ? (
            <>
              <Banner icon="wifiOff" tone="danger" title={error.text} />
              {error.login ? <Button label="Iniciar sesión" onPress={() => router.push("/cuenta")} /> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={s.composer}>
        <TextInput value={text} onChangeText={setText} placeholder="Escribe tu pregunta" placeholderTextColor="#9AA39D" multiline
          accessibilityLabel="Tu pregunta" style={[s.input, { fontFamily: fonts.medium }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar" disabled={!text.trim() || busy} onPress={() => send()}
          style={[s.send, (!text.trim() || busy) && { opacity: 0.4 }]}>
          <Icon name="chevron" color={colors.onDark} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bubble: { maxWidth: "88%", borderRadius: 18, padding: 12 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.selva, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  composer: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.crema, alignItems: "flex-end" },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, fontSize: 16, color: colors.text },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
});
