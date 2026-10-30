import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { colors, normalizePhone } from "@trazagro/shared";
import { api, ApiError } from "../lib/api";
import { useFarm } from "../lib/farm";
import { clearSession, loadSession, saveSession, type Session } from "../lib/session";
import { clearAccountData, discardRejected, runSync, syncStatus, type SyncStatus } from "../sync/engine";
import { Banner, Button, Card, Field, GreenHeader, Txt } from "../ui/kit";

export default function CuentaScreen() {
  const db = useSQLiteContext();
  const farmCtx = useFarm();
  const [session, setSession] = useState<Session | null>();
  const [status, setStatus] = useState<SyncStatus>();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "danger" | "warn"; text: string }>();

  const refresh = useCallback(async () => {
    setSession(await loadSession());
    setStatus(await syncStatus(db));
  }, [db]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
    } catch (e) {
      setMessage({ tone: "danger", text: e instanceof ApiError ? e.message : "Algo salió mal. Intenta de nuevo." });
    } finally {
      setBusy(false);
      await refresh();
      await farmCtx.refresh();
    }
  }

  const sendCode = () => act(async () => {
    if (!normalizePhone(phone)) throw new ApiError(400, "Escribe un celular colombiano de 10 dígitos.");
    const res = await api.requestCode(phone);
    setCodeSent(true);
    setDevCode(res.devCode);
  });

  const verify = () => act(async () => {
    const res = await api.verifyCode(phone, code.trim());
    await saveSession(res);
    setCodeSent(false);
    setCode("");
    const r = await runSync(db, res.token);
    setMessage({ tone: "ok", text: `Listo. Se subieron ${r.pushed} cambios y bajaron ${r.pulled}.` });
  });

  const syncNow = () => act(async () => {
    const r = await runSync(db, session!.token);
    setMessage(r.rejected.length
      ? { tone: "warn", text: `${r.rejected.length} cambios no se pudieron subir: ${r.rejected[0]!.reason}` }
      : { tone: "ok", text: `Sincronizado. Subieron ${r.pushed} cambios y bajaron ${r.pulled}.` });
  });

  // Unsent changes would be lost: the first tap only warns; signing out then clears this account's data.
  const logout = () => {
    if (status?.pending && !confirmLogout) return setConfirmLogout(true);
    act(async () => {
      await clearAccountData(db);
      await clearSession();
      setConfirmLogout(false);
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker="CUENTA Y RESPALDO" title={session ? "Tu cuenta" : "Inicia sesión"}>
          <Txt w="medium" size={15} color={colors.onDarkMuted}>
            {session ? session.user.phone : "Para respaldar tus datos y verlos en otro celular."}
          </Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          {session === undefined ? null : session ? (
            <>
              <Card style={{ gap: 6 }}>
                <Txt w="bold" size={17}>{status?.pending ? `${status.pending} cambios por subir` : "Todo está respaldado"}</Txt>
                <Txt size={14} color={colors.textMuted}>
                  {status?.lastSync ? `Última sincronización: ${new Date(status.lastSync).toLocaleString("es-CO")}` : "Todavía no se ha sincronizado."}
                </Txt>
                <Txt size={13} color={colors.textMuted}>La finca de prueba no se sube: solo tus fincas reales.</Txt>
              </Card>
              {status?.rejected.length ? (
                <Card style={{ gap: 8 }}>
                  <Txt w="bold" size={16} color={colors.danger}>{`${status.rejected.length} cambios rechazados por el servidor`}</Txt>
                  {status.rejected.slice(0, 5).map((r) => <Txt key={r.id} size={13} color={colors.textMuted}>{`· ${r.reason}`}</Txt>)}
                  <Txt size={13} color={colors.textMuted}>Se quedan en este celular pero no se suben. Si no los necesitas en la nube, descártalos.</Txt>
                  <Button kind="soft" label="Descartar cambios rechazados" disabled={busy}
                    onPress={() => act(async () => { await discardRejected(db, status.rejected.map((r) => r.id)); })} />
                </Card>
              ) : null}
              <Button label={busy ? "Sincronizando…" : "Sincronizar ahora"} icon="check" onPress={syncNow} disabled={busy} />
              {confirmLogout ? (
                <Banner icon="note" tone="danger" title={`Tienes ${status?.pending} cambios sin subir`}
                  text="Si cierras sesión ahora se pierden. Toca “Sincronizar ahora” cuando tengas señal, o confirma para cerrar igual." />
              ) : null}
              <Button kind={confirmLogout ? "danger" : "soft"} label={confirmLogout ? "Cerrar sesión y borrar cambios" : "Cerrar sesión"} onPress={logout} disabled={busy} />
              <Txt size={13} color={colors.textMuted}>Al cerrar sesión se borran de este celular tus fincas; vuelven al iniciar sesión otra vez.</Txt>
            </>
          ) : (
            <>
              <Field label="Tu celular" value={phone} onChangeText={(t) => { setPhone(t); setCodeSent(false); }} keyboardType="phone-pad"
                placeholder="Ej: 315 444 0099" editable={!busy} />
              {codeSent ? (
                <>
                  <Field label="Código de 6 dígitos" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="••••••" />
                  {devCode ? <Banner icon="note" tone="warn" title={`Modo desarrollo: tu código es ${devCode}`} text="En producción llegará por SMS." /> : null}
                  <Button label={busy ? "Verificando…" : "Entrar"} onPress={verify} disabled={busy || code.length !== 6} />
                  <Button kind="soft" label="Pedir otro código" onPress={sendCode} disabled={busy} />
                </>
              ) : (
                <Button label={busy ? "Enviando…" : "Enviarme el código por SMS"} onPress={sendCode} disabled={busy} />
              )}
            </>
          )}
          {message ? <Banner icon="note" tone={message.tone} title={message.text} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
