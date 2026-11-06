import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { animalLabel, colors, fonts, noveltiesFor, plural, shadow, shortDate, todayDay, type Animal, type Novelty, type NoveltyKind } from "@trazagro/shared";
import { exportReport, icaChecks, type CheckState } from "../db/finca";
import { loadFarmBundle, markReported } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { shareText } from "../lib/share";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { Banner, EarTag, GreenHeader, HeaderButton, Kicker, Txt, Wave, tagTone } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { StateChip } from "../ui/finca/parts";

const KIND_LABEL: Record<NoveltyKind, string> = { nacimiento: "Nacimiento", ingreso: "Ingreso (compra)", venta: "Venta", muerte: "Muerte o pérdida", sacrificio: "Sacrificio", traslado: "Traslado entre fincas" };
const MARK: Record<CheckState, [string, string, string]> = { si: ["✓", colors.limaSoft, colors.selva], medio: ["!", colors.warnSoft, "#6B4A00"], no: ["✕", colors.dangerSoft, colors.danger] };

/** ReporteICA.dc: compliance ring, checklist from the farm's own records, pending novelties and the SINIGAN steps. */
export default function IcaScreen() {
  const { farmId: farmParam } = useLocalSearchParams<{ farmId?: string }>();
  const farmId = useFarmId(farmParam);
  const canMark = useFarm().can("events");
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = todayDay();
  const [busy, setBusy] = useState<string>();
  const [done, setDone] = useState<string>();
  const { data, reload } = useDbQuery((d) => loadFarmBundle(d, farmId), [farmId]);

  if (!data?.farm) return <GreenHeader back title="Cumplimiento ICA" />;
  const { farm, animals, events } = data;
  const active = animals.filter((a) => a.status === "activo");
  const { checks, ok } = icaChecks(data, today);
  const novelties = noveltiesFor(farm, animals, events, today);
  const pending = novelties.filter((n) => !n.reported);
  const reported = novelties.length - pending.length;
  const byId = new Map(animals.map((a) => [a.id, a]));
  const first = pending[0];
  const firstAnimal = first ? byId.get(first.animalId) : undefined;

  async function mark(n: Novelty) {
    setBusy(`${n.animalId}:${n.kind}`);
    await markReported(db, farmId, n.animalId, n.kind);
    setBusy(undefined);
    reload();
  }

  function share() {
    const lines = pending.map((n) => {
      const a = byId.get(n.animalId);
      return `• ${KIND_LABEL[n.kind]} · ${a?.name ?? ""} arete ${a?.tagVisual ?? "sin arete"}${a?.rfid ? ` (RFID ${a.rfid})` : ""} · ${shortDate(n.date, today)}`;
    });
    const body = pending.length ? lines.join("\n") : "Sin novedades pendientes.";
    shareText("Novedades ICA", `Novedades por reportar en SINIGAN — ${farm.name}${farm.icaRegistration ? ` (${farm.icaRegistration})` : ""}\nInventario: ${active.length} animales activos\n${body}`).catch(() => {});
  }

  async function download() {
    const r = await exportReport(db, farmId, "inventario", { onlyActive: true });
    if (r !== "cancelled") setDone(r === "downloaded" ? "Inventario descargado" : "Inventario listo para enviar");
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <HeaderButton icon="back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Ring ok={ok} total={checks.length} />
          <View style={{ flex: 1, gap: 4 }}>
            <Kicker>ICA · SINIGAN</Kicker>
            <Txt w="extrabold" size={28} color={colors.onDark} style={{ letterSpacing: -0.56, lineHeight: 30 }}>Cumplimiento ICA</Txt>
            <Txt size={13} color={colors.onDarkMuted}>Lo que necesitas para sacar guías de movilización</Txt>
          </View>
        </View>
      </View>
      <Wave height={40} />

      <View style={s.main}>
        {done ? <Banner icon="check" tone="ok" title={done} /> : null}
        <Rise index={0}>
          <View style={[s.card, { paddingVertical: 4, paddingHorizontal: 14 }]} accessibilityLabel="Requisitos">
            {checks.map((c, i) => (
              <View key={c.title} style={[s.check, i < checks.length - 1 && s.line]}>
                <View style={[s.badge, { backgroundColor: MARK[c.state][1] }]}><Txt w="extrabold" size={15} color={MARK[c.state][2]}>{MARK[c.state][0]}</Txt></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="bold" size={15}>{c.title}</Txt>
                  <Txt size={13} color={colors.textMuted} style={{ lineHeight: 18 }}>{c.detail}</Txt>
                </View>
              </View>
            ))}
          </View>
        </Rise>

        <Rise index={1}>
          <View style={s.note}>
            <Icon name="alert" color={colors.info} size={20} />
            <Txt size={14} color="#0D3B66" style={{ flex: 1, lineHeight: 20 }}>
              <Txt w="bold" size={14} color="#0D3B66">El ICA no recibe el inventario por correo. </Txt>
              Las novedades (nacimientos, muertes, ventas) se registran en SINIGAN, en la web o en su app oficial. TrazAgro te deja todo listo y te dice qué cambiar.
            </Txt>
          </View>
        </Rise>

        <Rise index={2} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt w="extrabold" size={18}>Por reportar</Txt>
            {reported ? <Txt size={13} color={colors.textMuted}>{plural(reported, "ya reportada", "ya reportadas")}</Txt> : null}
          </View>
          {!pending.length ? <Banner icon="check" tone="ok" title="No tienes novedades pendientes" text="De los últimos 90 días." /> : null}
          {pending.map((n) => (
            <NoveltyRow key={`${n.animalId}:${n.kind}`} n={n} a={byId.get(n.animalId)} today={today} busy={busy === `${n.animalId}:${n.kind}`} onDone={canMark ? () => mark(n) : undefined} />
          ))}
        </Rise>

        <Rise index={3}>
          <View style={[s.card, { gap: 10 }]}>
            <Txt w="extrabold" size={16}>Para ponerte al día en SINIGAN</Txt>
            <Step n={1}>Entra a SINIGAN con tu usuario de productor.</Step>
            <Step n={2}>
              {first ? <>Registra la novedad: <Txt w="bold" size={14}>{`${KIND_LABEL[first.kind].toLowerCase()} de ${firstAnimal ? animalLabel(firstAnimal) : "un animal"}`}</Txt>{` (${shortDate(first.date, today)})${pending.length > 1 ? ` y ${plural(pending.length - 1, "otra", "otras")}` : ""}.`}</>
                : "Registra cada novedad con el número del arete (visual y RFID)."}
            </Step>
            <Step n={3}>Revisa que tu inventario quede en <Txt w="bold" size={14}>{plural(active.length, "animal", "animales")}</Txt>.</Step>
            <Tap accessibilityRole="link" accessibilityLabel="Abrir SINIGAN" onPress={() => Linking.openURL("https://www.sinigan.co").catch(() => {})} style={s.open}>
              <Txt w="bold" size={15} color={colors.onDark}>Abrir SINIGAN ↗</Txt>
            </Tap>
          </View>
        </Rise>

        <Rise index={4} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Tap accessibilityRole="button" accessibilityLabel="Descargar inventario" onPress={download} style={s.action}>
              <Icon name="download" color={colors.selva} size={22} />
              <Txt w="bold" size={14} style={{ flex: 1, lineHeight: 17 }}>Descargar inventario</Txt>
            </Tap>
          </View>
          <View style={{ flex: 1 }}>
            <Tap accessibilityRole="button" accessibilityLabel="Compartir la lista" onPress={share} style={s.action}>
              <Icon name="users" color={colors.selva} size={22} />
              <Txt w="bold" size={14} style={{ flex: 1, lineHeight: 17 }}>Enviar a mi técnico o vacunador</Txt>
            </Tap>
          </View>
        </Rise>

        <Rise index={5}>
          <View style={s.soon}>
            <Icon name="data" color={colors.tierra} size={20} />
            <Txt size={13} color={colors.tierraDeep} style={{ flex: 1, lineHeight: 18 }}>
              <Txt w="bold" size={13} color={colors.tierraDeep}>Próximamente: </Txt>enviar las novedades directo a SINIGAN, si se logra un convenio con el ICA.
            </Txt>
          </View>
        </Rise>
        <Txt size={12} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 18 }}>Confirma los requisitos vigentes con tu oficina del ICA.</Txt>
      </View>
    </ScrollView>
  );
}

function Ring({ ok, total }: { ok: number; total: number }) {
  const r = 62, len = 2 * Math.PI * r;
  return (
    <Svg width={92} height={92} viewBox="0 0 160 160" accessibilityLabel={`${ok} de ${total} requisitos al día`}>
      <Circle cx={80} cy={80} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={12} />
      <Circle cx={80} cy={80} r={r} fill="none" stroke={colors.lima} strokeWidth={12} strokeLinecap="round"
        strokeDasharray={`${total ? (len * ok) / total : 0} ${len}`} transform="rotate(-90 80 80)" />
      <SvgText x={80} y={94} textAnchor="middle" fontFamily={fonts.extrabold} fontSize={40} fontWeight="800" fill="#FFFFFF">{`${ok}/${total}`}</SvgText>
    </Svg>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={s.num}><Txt w="extrabold" size={13} color={colors.onDark}>{n}</Txt></View>
      <Txt size={14} style={{ flex: 1, lineHeight: 20 }}>{children}</Txt>
    </View>
  );
}

function NoveltyRow({ n, a, today, busy, onDone }: { n: Novelty; a?: Animal; today: string; busy: boolean; onDone?: () => void }) {
  return (
    <View style={s.row}>
      <EarTag code={a?.tagVisual} size={36} tone={tagTone(a?.sex)} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ alignSelf: "flex-start" }}><StateChip label={KIND_LABEL[n.kind]} bg={colors.warnSoft} fg={colors.amberText} /></View>
        <Txt w="bold" size={15}>{a?.name ?? `#${a?.tagVisual ?? "sin arete"}`}</Txt>
        <Txt size={12} color={colors.textMuted}>{shortDate(n.date, today)}{a?.tagVisual ? "" : " · falta el arete"}</Txt>
      </View>
      {onDone ? (
        <Tap accessibilityRole="button" accessibilityLabel="Ya lo reporté" onPress={onDone} disabled={busy} style={s.doneBtn}>
          <Txt w="bold" size={13} color={colors.selva}>{busy ? "…" : "Ya lo reporté"}</Txt>
        </Tap>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.selva, paddingHorizontal: 16, paddingBottom: 6, gap: 12 },
  main: { paddingHorizontal: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16, ...shadow },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.infoSoft },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 20, padding: 12, ...shadow },
  doneBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  open: { height: 54, borderRadius: 27, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center", marginTop: 2 },
  action: { minHeight: 64, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 22, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10, ...shadow },
  soon: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.tierraSoft },
});
