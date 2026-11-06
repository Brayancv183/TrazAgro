import { useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { colors, shadow, shortDate, todayDay } from "@trazagro/shared";
import { exportReport, icaChecks, recentReports, REPORT_NAME, type ReportKind } from "../db/finca";
import { loadFarmBundle } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Icon, type IconName } from "../ui/Icon";
import { Banner, Button, GreenHeader, Kicker, Sheet, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { CapsTitle, TINT, type Tint } from "../ui/finca/parts";

const TYPES: { kind: ReportKind; icon: IconName; sub: string; tint: Tint; period: string; format: string; money?: boolean }[] = [
  { kind: "inventario", icon: "tag", sub: "Aretes, categorías, lotes y pesos", tint: "g", period: "Hoy · todo el hato", format: "Excel (CSV)" },
  { kind: "sanidad", icon: "syringe", sub: "Retiros y aplicaciones de 90 días", tint: "r", period: "Últimos 90 días", format: "Texto" },
  { kind: "finanzas", icon: "money", sub: "Gastos e ingresos del año", tint: "y", period: "Últimos 12 meses", format: "Excel (CSV)", money: true },
  { kind: "leche", icon: "milk", sub: "Litros por ordeño y vaca", tint: "b", period: "Últimos 30 días", format: "Excel (CSV)" },
];

/** Reportes.dc + SheetExportar.dc: ICA card, report tiles that open the export sheet, and the recent list. */
export default function ReportesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const farmId = useFarmId();
  const money = useFarm().can("movements");
  const today = todayDay();
  const [done, setDone] = useState<string>();
  const [picked, setPicked] = useState<ReportKind>();
  const [onlyActive, setOnlyActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, reload } = useDbQuery(async (d) => {
    const b = await loadFarmBundle(d, farmId);
    return { ica: b.farm ? icaChecks(b, todayDay()) : undefined, recent: await recentReports(d, farmId) };
  }, [farmId]);
  const type = TYPES.find((t) => t.kind === picked);

  async function run() {
    if (!picked) return;
    setBusy(true);
    setDone(undefined);
    const r = await exportReport(db, farmId, picked, { onlyActive });
    setBusy(false);
    setPicked(undefined);
    if (r !== "cancelled") setDone(r === "downloaded" ? "Reporte descargado" : "Reporte listo para enviar");
    reload();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <GreenHeader back waveHeight={40} title="Reportes">
          <Txt size={14} color={colors.onDarkMuted} style={{ marginTop: 2 }}>Listos para el ICA, el banco o el comité.</Txt>
        </GreenHeader>
        <View style={s.main}>
          {done ? <Rise><Banner icon="check" tone="ok" title={done} /></Rise> : null}
          <Rise index={0}>
            <Tap accessibilityRole="link" accessibilityLabel="Cumplimiento ICA · SINIGAN" onPress={() => router.push("/ica")} style={s.ica}>
              <View style={s.icaIcon}><Icon name="report" color={colors.onDark} size={24} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="extrabold" size={16} color={colors.onDark}>Cumplimiento ICA · SINIGAN</Txt>
                <Txt size={13} color={colors.onDarkMuted}>
                  {data?.ica ? `${data.ica.ok} de ${data.ica.checks.length} al día · ${data.ica.pending === 1 ? "1 novedad por reportar" : `${data.ica.pending} novedades por reportar`}` : "Novedades para SINIGAN"}
                </Txt>
              </View>
              <View style={s.icaBtn}><Txt w="extrabold" size={13} color={colors.selva}>Abrir</Txt></View>
            </Tap>
          </Rise>

          <Rise index={1} style={s.grid}>
            {TYPES.filter((t) => money || !t.money).map((t) => (
              <View key={t.kind} style={s.cell}>
                <Tap accessibilityRole="button" accessibilityLabel={REPORT_NAME[t.kind]} onPress={() => { setOnlyActive(false); setPicked(t.kind); }} style={s.tile}>
                  <View style={[s.tileIcon, { backgroundColor: TINT[t.tint][0] }]}><Icon name={t.icon} color={TINT[t.tint][1]} size={20} /></View>
                  <Txt w="extrabold" size={14} style={{ lineHeight: 17 }}>{REPORT_NAME[t.kind]}</Txt>
                  <Txt size={12} color={colors.textMuted}>{t.sub}</Txt>
                </Tap>
              </View>
            ))}
          </Rise>

          {data?.recent.length ? (
            <Rise index={2} style={{ gap: 8 }}>
              <CapsTitle>GENERADOS HACE POCO</CapsTitle>
              {data.recent.map((r, i) => (
                <View key={`${r.kind}${r.date}${i}`} style={s.recent}>
                  <View style={[s.fileTag, { backgroundColor: r.file === "CSV" ? colors.greenSoft : colors.infoSoft }]}>
                    <Txt w="extrabold" size={11} color={r.file === "CSV" ? colors.selva : colors.info}>{r.file}</Txt>
                  </View>
                  <Txt w="bold" size={14} style={{ flex: 1 }}>{REPORT_NAME[r.kind]}</Txt>
                  <Txt size={12} color={colors.textMuted}>{shortDate(r.date, today)}</Txt>
                </View>
              ))}
            </Rise>
          ) : null}
          <Txt size={12} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 18 }}>Los archivos CSV abren en Excel o Google Sheets. El PDF con logo llega en la app instalada.</Txt>
        </View>
      </ScrollView>

      <Sheet open={!!picked} onClose={() => setPicked(undefined)} title={type ? REPORT_NAME[type.kind] : ""}>
        {type ? (
          <View style={{ gap: 16 }}>
            <View style={{ marginTop: -10 }}><Kicker color={colors.pasto}>EXPORTAR</Kicker></View>
            <View style={{ gap: 8 }}>
              <Txt w="bold" size={13}>Formato</Txt>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[s.format, s.formatOn]}>
                  <Txt w="extrabold" size={16} color={colors.selva}>{type.format === "Texto" ? "Texto" : "Excel"}</Txt>
                  <Txt w="semibold" size={12} color={colors.selva}>{type.format === "Texto" ? "Para WhatsApp" : "CSV · para editar"}</Txt>
                </View>
                <View style={[s.format, { opacity: 0.5 }]} accessibilityLabel="PDF: pronto">
                  <Txt w="extrabold" size={16}>PDF</Txt>
                  <Txt w="semibold" size={12}>Pronto</Txt>
                </View>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Txt w="bold" size={13}>Periodo</Txt>
              <View style={s.period}>
                <Icon name="calendar" color={colors.textMuted} size={20} />
                <Txt w="semibold" size={15}>{type.period}</Txt>
              </View>
            </View>
            {type.kind === "inventario" ? (
              <Tap accessibilityRole="checkbox" aria-checked={onlyActive} accessibilityState={{ checked: onlyActive }} accessibilityLabel="Solo animales activos"
                onPress={() => setOnlyActive(!onlyActive)} style={s.check}>
                <View style={[s.box, onlyActive && { backgroundColor: colors.link, borderColor: colors.link }]}>{onlyActive ? <Icon name="check" color={colors.onDark} size={16} width={3} /> : null}</View>
                <Txt size={15}>Solo animales activos (sin vendidos ni muertos)</Txt>
              </Tap>
            ) : null}
            <Txt size={12} color={colors.textMuted}>Al ICA se reporta en SINIGAN, no por correo.</Txt>
            <Button label={busy ? "Preparando…" : Platform.OS === "web" ? "Descargar" : "Compartir"} icon={Platform.OS === "web" ? "download" : "share"} disabled={busy} onPress={run} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  main: { paddingTop: 16, paddingHorizontal: 16, gap: 14 },
  ica: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: colors.selva, borderRadius: 24 },
  icaIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  icaBtn: { height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.card, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "48.5%" },
  tile: { backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 8, minHeight: 140, ...shadow },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  recent: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.card, borderRadius: 18, ...shadow },
  fileTag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  format: { flex: 1, height: 68, borderRadius: 18, borderWidth: 2, borderColor: colors.grip, alignItems: "center", justifyContent: "center", gap: 2 },
  formatOn: { backgroundColor: colors.greenSoft, borderColor: colors.link },
  period: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.grip },
  check: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
});
