import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts, normalizePhone, plural } from "@trazagro/shared";
import { api, ApiError } from "../lib/api";
import { useFarm } from "../lib/farm";
import { clearSession, loadSession, saveSession, type Session } from "../lib/session";
import { clearAccountData, discardRejected, runSync, syncStatus, type SyncStatus } from "../sync/engine";
import { Icon } from "../ui/Icon";
import { Button, HeaderButton, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { Avatar, CuentaHeader, GlassTag, ListRow, Orbit, PillInput, SectionKicker, SoftCard, StatusCard } from "../ui/cuenta/parts";

type Msg = { tone: "ok" | "danger" | "warn"; text: string };

/** "hace un momento", "hoy 4:10 p. m.", "12 oct 4:10 p. m." */
function when(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 2) return "hace un momento";
  const time = d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  if (new Date().toDateString() === d.toDateString()) return `hoy ${time}`;
  return `${d.toLocaleDateString("es-CO", { day: "numeric", month: "short" })} ${time}`;
}

/**
 * Account and backup. Signed out: phone + SMS code (Login.dc). Signed in: profile header (PerfilUsuario.dc) with the
 * sync state drawn like ToastSync.dc, rejected changes and the two-step sign-out.
 */
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
  const [message, setMessage] = useState<Msg>();

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

  if (session === undefined) return <View style={{ flex: 1, backgroundColor: colors.crema }} />;

  if (!session) {
    return (
      <Login phone={phone} setPhone={(t) => { setPhone(t); setCodeSent(false); }} code={code} setCode={setCode} codeSent={codeSent}
        onBack={() => { setCodeSent(false); setCode(""); setMessage(undefined); }}
        devCode={devCode} busy={busy} message={message} sendCode={sendCode} verify={verify} />
    );
  }

  const realFarms = farmCtx.farms.filter((f) => !f.isDemo).length;
  const name = session.user.fullName ?? session.user.phone.replace("+57", "");
  const last = when(status?.lastSync);

  return (
    <ScrollView style={{ backgroundColor: colors.crema }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <CuentaHeader>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={name} size={64} tone="lima" />
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <Txt w="semibold" size={11} color={colors.lima} style={{ letterSpacing: 2.4 }}>{`CUENTA Y RESPALDO · ${plural(realFarms, "FINCA", "FINCAS")}`}</Txt>
            <Txt w="extrabold" size={26} color={colors.onDark} style={{ lineHeight: 29 }}>Tu cuenta</Txt>
            <Txt size={13} color={colors.onDarkMuted}>{`${session.user.fullName ? `${session.user.fullName} · ` : ""}${formatPhone(session.user.phone)}`}</Txt>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <GlassTag>{last ? `Última sincronización: ${last}` : "Todavía sin sincronizar"}</GlassTag>
          <GlassTag>{Platform.OS === "web" ? "Navegador" : Platform.OS === "ios" ? "iPhone" : "Android"}</GlassTag>
        </View>
      </CuentaHeader>

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Rise index={0}>
          {status?.pending ? (
            <StatusCard icon="cloudOff" tone="warn" title={`${status.pending} cambios por subir`} detail="Todo sigue funcionando en este celular"
              action={busy ? "…" : "Probar"} actionLabel="Probar sincronizar" onAction={busy ? undefined : syncNow} />
          ) : (
            <StatusCard icon="cloudOk" tone="ok" title="Todo está respaldado" bar
              detail={status?.lastSync ? `Última sincronización: ${new Date(status.lastSync).toLocaleString("es-CO")}` : "Todavía no se ha sincronizado."} />
          )}
        </Rise>

        {message ? (
          <Rise index={1}>
            <StatusCard icon={message.tone === "ok" ? "check" : "alert"} tone={message.tone === "ok" ? "dark" : message.tone} dark={message.tone === "ok"}
              title={message.text} action="Cerrar" actionLabel="Cerrar aviso" onAction={() => setMessage(undefined)} />
          </Rise>
        ) : null}

        {status?.rejected.length ? (
          <Rise index={2}>
            <SoftCard style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.round, { backgroundColor: colors.dangerSoft }]}><Icon name="alert" color={colors.danger} size={20} /></View>
                <Txt w="extrabold" size={15} color={colors.danger} style={{ flex: 1 }}>{`${status.rejected.length} cambios rechazados por el servidor`}</Txt>
              </View>
              {status.rejected.slice(0, 5).map((r) => <Txt key={r.id} size={13} color={colors.textMuted}>{`· ${r.reason}`}</Txt>)}
              <Txt size={13} color={colors.textMuted}>Se quedan en este celular pero no se suben. Si no los necesitas en la nube, descártalos.</Txt>
              <Button kind="ghost" label="Descartar cambios rechazados" disabled={busy}
                onPress={() => act(async () => { await discardRejected(db, status.rejected.map((r) => r.id)); })} />
            </SoftCard>
          </Rise>
        ) : null}

        <Rise index={3}>
          <Button label={busy ? "Sincronizando…" : "Sincronizar ahora"} icon="sync" onPress={syncNow} disabled={busy} />
        </Rise>

        <Rise index={4}>
          <SoftCard list>
            <SectionKicker style={{ marginTop: 10, marginBottom: 2 }}>RESPALDO</SectionKicker>
            <ListRow>
              <Txt w="semibold" size={15} style={{ flex: 1 }}>Celular</Txt>
              <Txt w="bold" size={15}>{formatPhone(session.user.phone)}</Txt>
            </ListRow>
            <ListRow>
              <Txt w="semibold" size={15} style={{ flex: 1 }}>Fincas respaldadas</Txt>
              <Txt w="bold" size={15}>{String(realFarms)}</Txt>
            </ListRow>
            <ListRow last>
              <View style={{ flex: 1 }}>
                <Txt w="semibold" size={15}>Finca de prueba</Txt>
                <Txt size={12} color={colors.textMuted}>La finca de prueba no se sube: solo tus fincas reales.</Txt>
              </View>
              <Txt w="bold" size={15} color={colors.textMuted}>No se sube</Txt>
            </ListRow>
          </SoftCard>
        </Rise>

        <Rise index={5} style={{ gap: 10 }}>
          {confirmLogout ? (
            <View accessibilityRole="alert" style={s.confirm}>
              <Txt w="bold" size={15} color={colors.urgentText}>{`Tienes ${status?.pending} cambios sin subir`}</Txt>
              <Txt size={14} color={colors.urgentText} style={{ lineHeight: 20 }}>Si cierras sesión ahora se pierden. Toca “Sincronizar ahora” cuando tengas señal, o confirma para cerrar igual.</Txt>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Tap accessibilityRole="button" accessibilityLabel="Cancelar" onPress={() => setConfirmLogout(false)} style={[s.confirmBtn, { backgroundColor: colors.card }]}>
                  <Txt w="bold" size={14}>Cancelar</Txt>
                </Tap></View>
                <View style={{ flex: 1.6 }}><Tap accessibilityRole="button" accessibilityLabel="Cerrar sesión y borrar cambios" disabled={busy} onPress={logout} style={[s.confirmBtn, { backgroundColor: colors.danger }]}>
                  <Txt w="bold" size={14} color={colors.onDark}>Cerrar sesión y borrar cambios</Txt>
                </Tap></View>
              </View>
            </View>
          ) : (
            <Tap accessibilityRole="button" accessibilityLabel="Cerrar sesión" disabled={busy} onPress={logout} style={s.logout}>
              <Icon name="logout" color={colors.danger} size={18} />
              <Txt w="bold" size={15} color={colors.danger}>Cerrar sesión</Txt>
            </Tap>
          )}
          <Txt size={13} color={colors.textMuted} style={{ textAlign: "center", paddingHorizontal: 8 }}>Al cerrar sesión se borran de este celular tus fincas; vuelven al iniciar sesión otra vez.</Txt>
        </Rise>
      </View>
    </ScrollView>
  );
}

const formatPhone = (p: string) => {
  const d = p.replace(/^\+57/, "");
  return d.length === 10 ? `+57 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : p;
};

/** Login.dc: white page, dotted orbit, wordmark, phone with +57, then six code boxes. */
function Login({ phone, setPhone, code, setCode, codeSent, onBack, devCode, busy, message, sendCode, verify }: {
  phone: string; setPhone: (t: string) => void; code: string; setCode: (t: string) => void; codeSent: boolean; onBack: () => void;
  devCode?: string; busy: boolean; message?: Msg; sendCode: () => void; verify: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.card }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: insets.top }}>
          <Orbit />
          <View style={{ position: "absolute", top: insets.top + 12, left: 16, zIndex: 2 }}>
            <View style={{ borderRadius: 23, backgroundColor: colors.selva }}>
              <HeaderButton icon="back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
            </View>
          </View>
          <Logo />
        </View>

        <View style={{ marginHorizontal: 20, marginTop: 14, gap: 12 }}>
          {!codeSent ? (
            <>
              <Rise index={0}>
                <Txt w="extrabold" size={28} style={{ letterSpacing: -0.56, lineHeight: 30 }}>
                  Tu ganado, <Txt w="extrabold" size={28} color={colors.link}>siempre a la mano.</Txt>
                </Txt>
              </Rise>
              <Rise index={1}><Txt size={14} color={colors.textMuted}>Inicia sesión para respaldar tus datos y verlos en otro celular.</Txt></Rise>
              <Rise index={2}>
                <PillInput prefix="+57" big height={58} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Ej: 315 444 0099"
                  editable={!busy} accessibilityLabel="Número de celular" />
              </Rise>
              <Rise index={3}>
                <Tap accessibilityRole="button" accessibilityLabel="Enviarme el código por SMS" disabled={busy} onPress={sendCode} style={s.primary}>
                  <Txt w="bold" size={16} color={colors.onDark}>{busy ? "Enviando…" : "Enviarme el código por SMS"}</Txt>
                </Tap>
              </Rise>
              <Rise index={4} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={s.rule} /><Txt size={13} color={colors.textMuted}>o</Txt><View style={s.rule} />
              </Rise>
              <Rise index={5}>
                <Tap accessibilityRole="link" accessibilityLabel="Seguir sin cuenta" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.secondary}>
                  <Txt w="bold" size={14} color={colors.tierra}>Seguir sin cuenta, solo en este celular</Txt>
                  <Icon name="arrowRight" color={colors.tierra} size={16} width={2.4} />
                </Tap>
              </Rise>
            </>
          ) : (
            <>
              <Tap accessibilityRole="button" accessibilityLabel="Cambiar celular" onPress={onBack} style={{ alignSelf: "flex-start", minHeight: 32, justifyContent: "center" }}>
                <Txt w="bold" size={14} color={colors.link}>← Cambiar</Txt>
              </Tap>
              <Txt w="extrabold" size={28} style={{ letterSpacing: -0.56 }}>Escribe el código</Txt>
              <Txt size={14} color={colors.textMuted}>{`Lo enviamos por SMS al ${formatPhone(normalizePhone(phone) ?? phone)}`}</Txt>
              <View accessibilityLabel="Código de 6 dígitos" style={{ position: "relative" }}>
                <View style={{ flexDirection: "row", gap: 8 }} pointerEvents="none">
                  {Array.from({ length: 6 }, (_, i) => {
                    const active = focused && (i === code.length || (code.length === 6 && i === 5));
                    return (
                      <View key={i} style={[s.digit, active && { backgroundColor: colors.card, borderColor: colors.selva }]}>
                        <Txt w="extrabold" size={24}>{code[i] ?? ""}</Txt>
                      </View>
                    );
                  })}
                </View>
                <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="••••••"
                  placeholderTextColor="transparent" accessibilityLabel="Código de 6 dígitos" autoFocus maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp"
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} caretHidden
                  style={[StyleSheet.absoluteFill, { color: "transparent", fontFamily: fonts.bold, fontSize: 1, opacity: Platform.OS === "web" ? 0.01 : 0.02 } as never]} />
              </View>
              {devCode ? (
                <View style={s.dev}>
                  <Icon name="info" color={colors.warn} size={20} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt w="bold" size={14} color={colors.warn}>{`Modo desarrollo: tu código es ${devCode}`}</Txt>
                    <Txt size={12} color={colors.warn}>En producción llegará por SMS.</Txt>
                  </View>
                </View>
              ) : null}
              <Tap accessibilityRole="button" accessibilityLabel="Entrar" disabled={busy || code.length !== 6} onPress={verify} style={s.primary}>
                <Txt w="bold" size={16} color={colors.onDark}>{busy ? "Verificando…" : "Entrar"}</Txt>
              </Tap>
              <Tap accessibilityRole="button" accessibilityLabel="Pedir otro código" disabled={busy} onPress={sendCode} style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}>
                <Txt size={13} color={colors.textMuted}>¿No llegó? <Txt w="bold" size={13} color={colors.link}>Pedir otro código</Txt></Txt>
              </Tap>
            </>
          )}
          {message ? (
            <StatusCard icon={message.tone === "ok" ? "check" : "alert"} tone={message.tone === "ok" ? "ok" : message.tone} title={message.text} />
          ) : null}
        </View>

        <View style={{ flex: 1, minHeight: 130 }} />
        <View style={{ height: 110 }}>
          <Svg width="100%" height={110} viewBox="0 0 390 150" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: 0 }}>
            <Path d="M0 150V70C70 30 140 40 200 80S320 120 390 60v90z" fill={colors.lima} />
            <Path d="M0 150V100C90 60 170 70 240 105s110 30 150 10v35z" fill={colors.pasto} />
            <Path d="M0 150v-20c100-30 200-20 280 0s90 10 110 0v20z" fill={colors.link} />
          </Svg>
          <Txt w="semibold" size={11} color={colors.onDark} style={{ position: "absolute", left: 0, right: 0, bottom: 12 + insets.bottom, textAlign: "center", letterSpacing: 2.6 }}>FUNCIONA SIN INTERNET</Txt>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** TrazAgro mark: an ear tag inside the dotted orbit, then the wordmark and tagline. */
function Logo() {
  return (
    <View style={{ alignItems: "center", paddingTop: 26, height: 206, gap: 6 }} accessibilityLabel="TrazAgro, trazabilidad ganadera inteligente">
      <Svg width={92} height={92} viewBox="0 0 92 92">
        <Circle cx={46} cy={46} r={42} fill={colors.limaSoft} />
        <Circle cx={46} cy={46} r={44} fill="none" stroke={colors.pasto} strokeWidth={2} strokeDasharray="2 8" strokeLinecap="round" />
        <Path d="M46 20a8 8 0 0 1 8 8v4h8a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5H30a5 5 0 0 1-5-5V37a5 5 0 0 1 5-5h8v-4a8 8 0 0 1 8-8z" fill={colors.selva} />
        <Circle cx={46} cy={28} r={3} fill={colors.limaSoft} />
        <Path d="M36 50l7 7 13-14" fill="none" stroke={colors.lima} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={46} cy={2} r={4} fill={colors.link} />
        <Circle cx={88} cy={58} r={4} fill={colors.lima} />
      </Svg>
      <Txt w="extrabold" size={36} color={colors.selva} style={{ letterSpacing: -0.9, lineHeight: 40 }}>
        Traz<Txt w="extrabold" size={36} color={colors.pasto}>Agro</Txt>
      </Txt>
      <Txt w="semibold" size={11} color={colors.textMuted} style={{ letterSpacing: 2.2 }}>TRAZABILIDAD GANADERA INTELIGENTE</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  primary: { height: 56, borderRadius: 28, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  secondary: { minHeight: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.outline, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  rule: { flex: 1, height: 1, backgroundColor: "#E0E6D8" },
  digit: { flex: 1, height: 58, borderRadius: 18, backgroundColor: colors.tint, borderWidth: 2, borderColor: colors.tint, alignItems: "center", justifyContent: "center" },
  dev: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 20, backgroundColor: colors.warnSoft, alignItems: "flex-start" },
  logout: { height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: "#F5C2C2", backgroundColor: colors.card, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  confirm: { gap: 10, padding: 14, borderRadius: 20, backgroundColor: colors.dangerSoft },
  confirmBtn: { minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
});
