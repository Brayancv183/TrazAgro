import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { animalLabel, colors, fonts, plural, shadow, type Animal } from "@trazagro/shared";
import { findByTag, listLots } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { useDbQuery } from "../../lib/useDb";
import { Icon, type IconName } from "../../ui/Icon";
import { EarTag, Txt, tagTone } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { FlowHeader, Grow, noOutline, RoundButton, Segmented } from "../../ui/campo/parts";
import { TAB_BAR_SPACE } from "../../ui/TabBar";

type Mode = "rfid" | "qr" | "manual";
const MODES: { id: Mode; label: string }[] = [{ id: "rfid", label: "Arete RFID" }, { id: "qr", label: "Código QR" }, { id: "manual", label: "Manual" }];
const HINT: Record<Mode, string> = {
  rfid: "Acerca el lector Bluetooth al arete del animal. El número aparece solo y se busca sin internet.",
  qr: "La lectura del código QR con la cámara llega en la app instalada. Mientras tanto usa el lector o escribe el número.",
  manual: "Escribe el número visible en el arete.",
};
const NIGHT = "#101A12";
const BRIGHT = "#66BB6A";

/**
 * Find an animal by ear tag or RFID (Escanear.dc). Bluetooth RFID readers type the code like a keyboard and
 * press Enter, so a focused field is all they need. "Modo corral" (CorralRapido.dc) collects several animals
 * and sends them together to one record.
 */
export default function EscanearScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { farm, can } = useFarm();
  const canEdit = can("events");
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [mode, setMode] = useState<Mode>("rfid");
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [corral, setCorral] = useState(false);
  const [batch, setBatch] = useState<Animal[]>([]);
  const [found, setFound] = useState<Animal>();
  const [notFound, setNotFound] = useState<string>();
  const [last, setLast] = useState<string>();
  const { data: lots } = useDbQuery((d) => (farm ? listLots(d, farm.id) : Promise.resolve([])), [farm?.id]);
  const lotName = (a: Animal) => lots?.find((l) => l.id === a.lotId)?.name.split(" · ")[0];

  async function lookup() {
    const c = code.trim();
    if (!c || !farm) return input.current?.focus();
    setNotFound(undefined);
    const a = await findByTag(db, farm.id, c);
    setCode("");
    input.current?.focus();
    if (!a || a.status !== "activo") { setFound(undefined); return setNotFound(c); }
    if (!corral) return setFound(a);
    setLast(batch.some((b) => b.id === a.id) ? `${animalLabel(a)} ya estaba en el corral` : `Agregado: ${animalLabel(a)}`);
    setBatch((b) => (b.some((x) => x.id === a.id) ? b : [a, ...b]));
  }

  function startCorral(first?: Animal) {
    setCorral(true);
    setNotFound(undefined);
    setFound(undefined);
    if (first) { setBatch([first]); setLast(`Agregado: ${animalLabel(first)}`); }
    setTimeout(() => input.current?.focus(), 50);
  }

  const reader = (dark: boolean) => (
    <TextInput ref={input} value={code} onChangeText={(t) => { setNotFound(undefined); setCode(t); }} onSubmitEditing={lookup}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      placeholder="Arete o RFID" placeholderTextColor={dark ? "rgba(221,231,222,0.55)" : "#9AA39D"} autoFocus returnKeyType="search" autoCapitalize="characters"
      blurOnSubmit={false} accessibilityLabel="Número de arete o RFID"
      style={[dark ? s.darkInput : s.lightInput, { fontFamily: fonts.extrabold }, noOutline]} />
  );

  if (corral) {
    return (
      <Corral batch={batch} last={last} canEdit={canEdit} reader={reader(false)} notFound={notFound} lotName={lotName}
        onAdd={lookup} hasCode={!!code.trim()}
        onExit={() => { setCorral(false); setBatch([]); setLast(undefined); setNotFound(undefined); }}
        onRemove={(id) => setBatch((b) => b.filter((x) => x.id !== id))}
        onRegister={(kind) => router.push({ pathname: "/evento/nuevo", params: { animalIds: batch.map((a) => a.id).join(","), ...(kind ? { kind } : {}) } })}
        onNewAnimal={(tag) => router.push({ pathname: "/animal/nuevo", params: { tag } })} />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: NIGHT }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled">
        <Top onClose={() => router.navigate("/")} />
        <Segmented dark options={MODES} value={mode} onChange={(m) => { setMode(m); if (m !== "qr") setTimeout(() => input.current?.focus(), 50); }} style={{ marginHorizontal: 16, marginTop: 8 }} />

        <View style={s.stage}>
          <Frame>
            {mode === "rfid" ? <RfidWaves /> : null}
            {mode === "qr" ? (
              <>
                <QrMark />
                <View style={s.soon}><Txt w="bold" size={12} color={colors.signalText}>Pronto</Txt></View>
              </>
            ) : null}
            {mode === "manual" ? <Txt w="bold" size={13} color={colors.onDarkMuted}>Número de arete</Txt> : null}
            {mode !== "qr" ? (
              <View style={{ width: 210, gap: 8 }}>
                {reader(true)}
                <Tap accessibilityRole="button" accessibilityLabel="Buscar" onPress={lookup} disabled={!code.trim()} style={s.findBtn}>
                  <Icon name="search" color={colors.selva} size={18} width={2.6} />
                  <Txt w="extrabold" size={15} color={colors.selva}>Buscar</Txt>
                </Tap>
              </View>
            ) : null}
          </Frame>
          <Txt size={15} color="#DDE7DE" style={{ textAlign: "center", maxWidth: 290, lineHeight: 22 }}>{HINT[mode]}</Txt>
          <View style={s.status}>
            <View style={[s.dot, { backgroundColor: focused && mode !== "qr" ? BRIGHT : "#A0A8A2" }]} />
            <Txt w="bold" size={13} color={colors.onDarkMuted}>{focused && mode !== "qr" ? "Listo para leer · lector Bluetooth o teclado" : "Toca el campo para leer el arete"}</Txt>
          </View>
        </View>

        <Rise index={1} key={found?.id ?? notFound ?? "idle"} style={s.sheet}>
          {found ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={s.short}><Txt w="extrabold" size={15} color={colors.selva}>{found.tagVisual ? found.tagVisual.slice(-3) : "—"}</Txt></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="check" color={colors.link} size={14} width={3} />
                    <Txt w="bold" size={12} color={colors.link}>Animal encontrado</Txt>
                  </View>
                  <Txt w="extrabold" size={17}>{[found.name, found.tagVisual && `#${found.tagVisual}`].filter(Boolean).join(" · ") || "Sin arete"}</Txt>
                  <Txt size={13} color={colors.textMuted}>{[found.breed, lotName(found)].filter(Boolean).join(" · ") || "Sin raza ni lote"}</Txt>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Grow>
                  <Tap accessibilityRole="button" accessibilityLabel="Ver ficha" onPress={() => router.push({ pathname: "/animal/[id]", params: { id: found.id } })} style={s.ghostBtn}>
                    <Txt w="bold" size={15}>Ver ficha</Txt>
                  </Tap>
                </Grow>
                <Grow>
                  <Tap accessibilityRole="button" accessibilityLabel="Modo corral" onPress={() => startCorral(found)} style={s.greenBtn}>
                    <Txt w="extrabold" size={15} color={colors.onDark}>Modo corral</Txt>
                  </Tap>
                </Grow>
              </View>
            </>
          ) : notFound ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.short, { backgroundColor: colors.warnSoft }]}><Icon name="tag" color={colors.warn} size={22} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="extrabold" size={16}>{`No hay un animal activo con “${notFound}”`}</Txt>
                  <Txt size={13} color={colors.textMuted}>Revisa el número o regístralo ahora con ese arete.</Txt>
                </View>
              </View>
              {canEdit ? (
                <Tap accessibilityRole="button" accessibilityLabel={`Registrar con ${notFound}`} onPress={() => router.push({ pathname: "/animal/nuevo", params: { tag: notFound } })} style={s.greenBtn}>
                  <Icon name="plus" color={colors.onDark} size={18} width={2.6} />
                  <Txt w="extrabold" size={15} color={colors.onDark}>{`Registrar con ${notFound}`}</Txt>
                </Tap>
              ) : null}
            </>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={s.short}><Icon name="lots" color={colors.selva} size={22} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="extrabold" size={16}>¿Varios animales en la manga?</Txt>
                  <Txt size={13} color={colors.textMuted}>Lee uno tras otro y regístrales la vacuna o el pesaje a todos juntos.</Txt>
                </View>
              </View>
              <Tap accessibilityRole="button" accessibilityLabel="Corral rápido" onPress={() => startCorral()} style={s.greenBtn}>
                <Txt w="extrabold" size={15} color={colors.onDark}>Modo corral</Txt>
              </Tap>
            </>
          )}
        </Rise>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Top({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.top, { paddingTop: insets.top + 12 }]}>
      <Tap accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={s.glassBtn}>
        <Icon name="x" color={colors.onDark} size={22} width={2.2} />
      </Tap>
      <Txt w="extrabold" size={16} color={colors.onDark}>Identificar animal</Txt>
      <View style={{ width: 44 }} />
    </View>
  );
}

/** 260 px viewfinder: soft green glow and four bright corner brackets. */
function Frame({ children }: { children: React.ReactNode }) {
  const corner = (pos: object, r: object) => <View pointerEvents="none" style={[s.corner, pos, r]} />;
  return (
    <View style={s.frame}>
      <Svg width={260} height={260} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="45%" r="70%">
            <Stop offset="0" stopColor="#2E7D32" stopOpacity={0.35} />
            <Stop offset="1" stopColor={NIGHT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={260} height={260} rx={28} fill="url(#glow)" />
      </Svg>
      {corner({ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }, { borderTopLeftRadius: 24 })}
      {corner({ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }, { borderTopRightRadius: 24 })}
      {corner({ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }, { borderBottomLeftRadius: 24 })}
      {corner({ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }, { borderBottomRightRadius: 24 })}
      {children}
    </View>
  );
}

function RfidWaves() {
  return (
    <Svg width={72} height={72} viewBox="0 0 24 24" fill="none" stroke="#A5D6A7" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5a10 10 0 0 1 14 0" /><Path d="M8.5 16a5 5 0 0 1 7 0" /><Path d="M2 9a14 14 0 0 1 20 0" /><Circle cx={12} cy={19.5} r={1} />
    </Svg>
  );
}

function QrMark() {
  return (
    <Svg width={96} height={96} viewBox="0 0 24 24" fill="none" stroke="#A5D6A7" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={7} height={7} rx={1} /><Rect x={14} y={3} width={7} height={7} rx={1} /><Rect x={3} y={14} width={7} height={7} rx={1} />
      <Path d="M14 14h3v3h-3z" /><Path d="M17 20h4v-3" />
    </Svg>
  );
}

const ACTIONS: { kind: "vacuna" | "pesaje" | "tratamiento"; label: string; sub: (n: number) => string; icon: IconName; dark: boolean; fg: string; icBg: string }[] = [
  { kind: "vacuna", label: "Vacunar", sub: (n) => `A ${n === 1 ? "este animal" : `los ${n} del corral`} · descuenta del inventario`, icon: "syringe", dark: true, fg: colors.onDark, icBg: "rgba(255,255,255,0.18)" },
  { kind: "pesaje", label: "Pesar", sub: (n) => `Escribe el peso de ${n === 1 ? "este animal" : `cada uno de los ${n}`}`, icon: "scale", dark: false, fg: colors.info, icBg: colors.infoSoft },
  { kind: "tratamiento", label: "Tratar", sub: () => "Tratamiento con días de espera calculados", icon: "drop", dark: false, fg: colors.tierra, icBg: colors.tierraSoft },
];

/** CorralRapido.dc: the last animal read in the header, big actions for the whole batch, and the reader. */
function Corral({ batch, last, canEdit, reader, notFound, lotName, hasCode, onAdd, onExit, onRemove, onRegister, onNewAnimal }: {
  batch: Animal[]; last?: string; canEdit: boolean; reader: React.ReactNode; notFound?: string; lotName: (a: Animal) => string | undefined; hasCode: boolean;
  onAdd: () => void; onExit: () => void; onRemove: (id: string) => void; onRegister: (kind?: string) => void; onNewAnimal: (tag: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const head = batch[0];
  const n = batch.length;
  const bottom = Math.max(insets.bottom, 16) + 68 + 12;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 90 }} keyboardShouldPersistTaps="handled">
        <FlowHeader left={<RoundButton icon="x" label="Salir del modo corral" onPress={onExit} />} kicker={`MODO CORRAL · ${plural(n, "ANIMAL", "ANIMALES")}`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <EarTag code={head?.tagVisual} tone={colors.lima} size={56} />
            <View style={{ flex: 1, gap: 3 }}>
              <Txt w="extrabold" size={30} color={colors.onDark} style={{ lineHeight: 32 }} numberOfLines={1}>{head ? animalLabel(head) : "Corral vacío"}</Txt>
              <Txt size={14} color={colors.onDarkMuted} numberOfLines={2}>
                {head ? [head.tagVisual && `#${head.tagVisual}`, lotName(head), last].filter(Boolean).join(" · ") : "Lee el primer arete para empezar."}
              </Txt>
            </View>
          </View>
        </FlowHeader>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Rise index={0} style={s.readerCard}>
            <Icon name="scan" color={colors.selva} size={26} />
            <View style={{ flex: 1 }}>{reader}</View>
            <Tap accessibilityRole="button" accessibilityLabel="Agregar al corral" onPress={onAdd} disabled={!hasCode} style={s.addBtn}>
              <Icon name="plus" color={colors.onDark} size={22} width={2.6} />
            </Tap>
          </Rise>
          {notFound ? (
            <View style={s.warnRow}>
              <Txt w="bold" size={14} color={colors.signalText} style={{ flex: 1 }}>{`No hay un animal activo con “${notFound}”`}</Txt>
              {canEdit ? (
                <Tap accessibilityRole="button" accessibilityLabel={`Registrar con ${notFound}`} onPress={() => onNewAnimal(notFound)} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Txt w="extrabold" size={14} color={colors.link}>Registrar</Txt>
                </Tap>
              ) : null}
            </View>
          ) : null}

          {canEdit ? ACTIONS.map((a, i) => (
            <Rise key={a.kind} index={i + 1}>
              <Tap accessibilityRole="button" accessibilityLabel={`${a.label}${n ? ` a ${plural(n, "animal", "animales")}` : ""}`} disabled={!n} onPress={() => onRegister(a.kind)}
                style={[s.action, a.dark ? s.actionDark : s.actionLight]}>
                <View style={[s.actionIc, { backgroundColor: a.icBg }]}><Icon name={a.icon} color={a.fg} size={34} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt w="extrabold" size={22} color={a.dark ? colors.onDark : colors.text}>{a.label}</Txt>
                  <Txt w="semibold" size={14} color={a.dark ? colors.limaSoft : colors.textMuted}>{n ? a.sub(n) : "Primero lee un arete"}</Txt>
                </View>
              </Tap>
            </Rise>
          )) : null}
          {canEdit && n ? (
            <Tap accessibilityRole="link" accessibilityLabel={`Registrar a los ${n}`} onPress={() => onRegister()} style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}>
              <Txt w="bold" size={15} color={colors.link}>Más opciones →</Txt>
            </Tap>
          ) : null}

          {n ? (
            <Rise index={5} style={s.listCard}>
              {batch.map((a, i) => (
                <View key={a.id} style={[s.listRow, i < n - 1 && { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" }]}>
                  <EarTag code={a.tagVisual} size={30} tone={tagTone(a.sex)} />
                  <Txt w="bold" size={15} style={{ flex: 1 }}>{animalLabel(a)}</Txt>
                  <Tap accessibilityRole="button" accessibilityLabel={`Quitar ${animalLabel(a)}`} hitSlop={8} onPress={() => onRemove(a.id)} style={s.remove}>
                    <Icon name="x" color={colors.textMuted} size={18} width={2.4} />
                  </Tap>
                </View>
              ))}
            </Rise>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <View style={[s.dot, { backgroundColor: "#A0A8A2" }]} />
            <Txt size={12} color={colors.textMuted}>Al registrar se guarda en el celular · se sube al tener señal</Txt>
          </View>
        </View>
      </ScrollView>

      <View style={[s.nextWrap, { bottom: bottom + 8 }]}>
        <Tap accessibilityRole="button" accessibilityLabel="Leer siguiente arete" onPress={onAdd} style={s.next}>
          <View style={s.nextIc}><Icon name="scan" color={colors.selva} size={24} /></View>
          <Txt w="extrabold" size={19} color={colors.onDark}>{hasCode ? "Agregar este arete" : "Leer siguiente arete"}</Txt>
        </Tap>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  glassBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22, paddingHorizontal: 24, paddingVertical: 20 },
  frame: { width: 260, height: 260, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 12 },
  corner: { position: "absolute", width: 48, height: 48, borderColor: BRIGHT },
  soon: { backgroundColor: colors.signal, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  darkInput: { height: 56, borderRadius: 14, borderWidth: 2, borderColor: BRIGHT, backgroundColor: "rgba(255,255,255,0.06)", color: colors.onDark, fontSize: 24, textAlign: "center", letterSpacing: 2.4 },
  findBtn: { height: 44, borderRadius: 22, backgroundColor: colors.lima, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.08)", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sheet: { marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.crema, borderRadius: 20, padding: 16, gap: 14 },
  short: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  ghostBtn: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: "#D5D0C4", backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  greenBtn: { height: 48, borderRadius: 14, backgroundColor: colors.link, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  readerCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 28, paddingLeft: 18, paddingRight: 8, minHeight: 64, borderWidth: 2, borderColor: colors.lima, ...shadow },
  lightInput: { minHeight: 56, fontSize: 22, color: colors.text, letterSpacing: 1 },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  warnRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.warnSoft, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  action: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 108, paddingHorizontal: 18, borderRadius: 28 },
  actionDark: { backgroundColor: colors.link, shadowColor: colors.link, shadowOpacity: 0.35, shadowRadius: 26, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  actionLight: { backgroundColor: colors.card, ...shadow },
  actionIc: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  listCard: { backgroundColor: colors.card, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 2, ...shadow },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 52 },
  remove: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  nextWrap: { position: "absolute", left: 14, right: 14, gap: 8 },
  next: { height: 72, borderRadius: 36, backgroundColor: colors.selva, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    shadowColor: colors.selva, shadowOpacity: 0.35, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
  nextIc: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
});
