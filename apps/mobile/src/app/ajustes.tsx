import { useCallback, useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { canWrite, colors, fonts, plural, shortDate } from "@trazagro/shared";
import { getPref, setPref } from "../db/repo";
import { importAnimals, IMPORT_TEMPLATE, parseAnimalsCsv, type ImportProblem, type ImportRow } from "../db/cuenta";
import { API_URL } from "../lib/api";
import { useFarm } from "../lib/farm";
import { loadSession } from "../lib/session";
import { shareText } from "../lib/share";
import { syncStatus, type SyncStatus } from "../sync/engine";
import { Icon, type IconName } from "../ui/Icon";
import { Pill, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { CuentaHeader, ListRow, Segmented, SectionKicker, SoftCard, StatusCard } from "../ui/cuenta/parts";

/**
 * Settings + data import/export (Datos.dc): backup state, CSV import of animals into the current farm,
 * links to reports, then device settings (demo farm, privacy under Ley 1581) and app info.
 */
export default function AjustesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { farm, farms, role, refresh } = useFarm();
  const [hideDemo, setHideDemo] = useState(false);
  const [consent, setConsent] = useState<string>();
  const [sync, setSync] = useState<{ status: SyncStatus; logged: boolean }>();
  const hasReal = farms.some((f) => !f.isDemo);

  useFocusEffect(useCallback(() => {
    getPref(db, "hide_demo").then((v) => setHideDemo(v === "1"));
    getPref(db, "consent_1581").then(setConsent);
    (async () => setSync({ status: await syncStatus(db), logged: !!(await loadSession()) }))();
  }, [db]));

  async function toggleDemo(v: boolean) {
    if (v && !hasReal) return;
    await setPref(db, "hide_demo", v ? "1" : "0");
    setHideDemo(v);
    await refresh();
  }

  const last = sync?.status.lastSync ? new Date(sync.status.lastSync).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : undefined;

  return (
    <ScrollView style={{ backgroundColor: colors.crema }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <CuentaHeader kicker="TRAZAGRO" title="Ajustes y datos" />
      <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 14 }}>
        <Rise index={0}>
          {sync ? (
            <View style={s.syncCard}>
              <View style={[s.round, { backgroundColor: sync.status.pending || !sync.logged ? colors.warnSoft : colors.greenSoft }]}>
                <Icon name={sync.logged ? "sync" : "lock"} color={sync.status.pending || !sync.logged ? colors.amberText : colors.selva} size={22} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="extrabold" size={15}>{!sync.logged ? "Sin copia en la nube" : sync.status.pending ? `${plural(sync.status.pending, "cambio", "cambios")} sin subir` : "Todo está respaldado"}</Txt>
                <Txt size={13} color={colors.textMuted}>{!sync.logged ? "Inicia sesión para respaldar tus fincas" : last ? `Última copia en la nube: ${last}` : "Todavía no se ha sincronizado"}</Txt>
              </View>
              <Tap accessibilityRole="link" accessibilityLabel={sync.logged ? "Subir cambios" : "Iniciar sesión"} onPress={() => router.push("/cuenta")} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}>
                <Txt w="extrabold" size={13} color={colors.link}>{sync.logged ? "Subir" : "Entrar"}</Txt>
              </Tap>
            </View>
          ) : null}
        </Rise>

        <Rise index={1}>
          {farm && canWrite(role, "animals") ? <ImportCard farmId={farm.id} farmName={farm.name} onDone={refresh} /> : null}
        </Rise>

        <Rise index={2} style={{ gap: 8 }}>
          <SectionKicker>SACAR MIS DATOS</SectionKicker>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <BigLink icon="report" label="Reportes en Excel" onPress={() => router.push("/reportes")} />
            <BigLink icon="sync" label="Copia en la nube" onPress={() => router.push("/cuenta")} />
          </View>
        </Rise>

        <Rise index={3} style={{ gap: 8 }}>
          <SectionKicker>AJUSTES</SectionKicker>
          <SoftCard list>
            <ListRow style={{ flexDirection: "column", alignItems: "stretch", gap: 8, paddingVertical: 12 }}>
              <View style={{ gap: 2 }}>
                <Txt w="bold" size={15}>Finca de prueba</Txt>
                <Txt size={12} color={colors.textMuted}>{hasReal ? "Ocúltala cuando ya no la necesites. Sus datos no se borran." : "Se puede ocultar cuando registres tu propia finca."}</Txt>
              </View>
              <Segmented label="Finca de prueba" track={colors.card} value={hideDemo ? "ocultar" : "mostrar"} onChange={(v) => toggleDemo(v === "ocultar")}
                options={[{ id: "mostrar", label: "Mostrar" }, { id: "ocultar", label: "Ocultar" }]} />
            </ListRow>
            <ListRow>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="bold" size={15}>Modo noche</Txt>
                <Txt size={12} color={colors.textMuted}>El tema oscuro “Noche de campo” está diseñado y llega en una próxima versión.</Txt>
              </View>
              <Pill label="Pronto" tone="muted" />
            </ListRow>
            <ListRow style={{ flexDirection: "column", alignItems: "stretch", gap: 6, paddingVertical: 12 }}>
              <Txt w="bold" size={15}>Privacidad y datos personales</Txt>
              <Txt size={12} color={colors.textMuted}>
                {consent ? `Autorizaste el tratamiento de datos el ${shortDate(consent.slice(0, 10))} (Ley 1581 de 2012).` : "Todavía no has autorizado el tratamiento de datos."}
              </Txt>
              <Txt size={12} color={colors.textMuted}>Para consultar, corregir o borrar tus datos de la nube escribe a datos@trazagro.co. Cerrar sesión borra tus fincas de este celular.</Txt>
              <Tap accessibilityRole="button" accessibilityLabel="Ver la autorización otra vez" onPress={() => router.push({ pathname: "/bienvenida", params: { ver: "1" } })} style={s.softBtn}>
                <Txt w="bold" size={14} color={colors.selva}>Ver la autorización otra vez</Txt>
              </Tap>
            </ListRow>
            <Tap accessibilityRole="button" accessibilityLabel="Cuenta y respaldo" onPress={() => router.push("/cuenta")}>
              <ListRow last>
                <View style={[s.round, { width: 40, height: 40, backgroundColor: colors.limaSoft }]}><Icon name="user" color={colors.selva} size={20} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="bold" size={15}>Cuenta y respaldo</Txt>
                  <Txt size={12} color={colors.textMuted}>Iniciar o cerrar sesión</Txt>
                </View>
                <Icon name="chevron" color={colors.textMuted} size={18} />
              </ListRow>
            </Tap>
          </SoftCard>
        </Rise>

        <Txt size={12} color={colors.textMuted} style={{ textAlign: "center" }}>{`TrazAgro 1.0 · piloto · Servidor: ${API_URL}`}</Txt>
      </View>
    </ScrollView>
  );
}

function BigLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Tap accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.big}>
        <Icon name={icon} color={colors.selva} size={20} />
        <Txt w="extrabold" size={14}>{label}</Txt>
      </Tap>
    </View>
  );
}

/** Web only: opens the file chooser and reads a .csv/.txt as text. */
function pickCsvFile(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt,text/csv,text/plain";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(undefined);
      f.text().then(resolve, () => resolve(undefined));
    };
    input.click();
  });
}

/** "Traer animales desde Excel": template → fill → paste or pick → review → save. */
function ImportCard({ farmId, farmName, onDone }: { farmId: string; farmName: string; onDone: () => void }) {
  const db = useSQLiteContext();
  const [text, setText] = useState("");
  const [pasting, setPasting] = useState(false);
  const [parsed, setParsed] = useState<{ rows: ImportRow[]; problems: ImportProblem[] }>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; problems: ImportProblem[] }>();

  const review = (t: string) => { setText(t); setResult(undefined); setParsed(t.trim() ? parseAnimalsCsv(t) : undefined); };

  async function pick() {
    const t = await pickCsvFile();
    if (t !== undefined) { setPasting(true); review(t); }
  }

  async function save() {
    if (!parsed?.rows.length) return;
    setBusy(true);
    try {
      const r = await importAnimals(db, farmId, parsed.rows);
      setResult({ created: r.created, problems: [...parsed.problems, ...r.problems].sort((a, b) => a.line - b.line) });
      setParsed(undefined);
      setText("");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const step = (n: number, label: string, on: boolean, extra?: ReactNode) => (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center", minHeight: 36 }}>
      <View style={[s.num, on && { backgroundColor: colors.selva }]}><Txt w="extrabold" size={13} color={on ? colors.onDark : colors.selva}>{String(n)}</Txt></View>
      <Txt size={14} style={{ flex: 1 }}>{label}</Txt>
      {extra}
    </View>
  );

  return (
    <SoftCard style={{ borderRadius: 24, gap: 12 }}>
      <Txt w="extrabold" size={17}>Traer animales desde Excel</Txt>
      <View style={{ gap: 10 }}>
        {step(1, "Descarga la plantilla", true,
          <Tap accessibilityRole="button" accessibilityLabel="Descargar plantilla" onPress={() => shareText("Plantilla animales TrazAgro", IMPORT_TEMPLATE, "Plantilla_animales_TrazAgro.csv")} style={s.chipBtn}>
            <Txt w="extrabold" size={12} color={colors.selva}>Plantilla</Txt>
          </Tap>)}
        {step(2, "Llénala con arete, RFID, nombre, sexo, raza y nacimiento", false)}
        {step(3, `Pégala o súbela y revisa antes de guardar en ${farmName}`, false)}
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {Platform.OS === "web" ? (
          <View style={{ flex: 1 }}>
            <Tap accessibilityRole="button" accessibilityLabel="Subir archivo .csv" onPress={pick} style={s.drop}>
              <Icon name="upload" color={colors.selva} size={20} />
              <Txt w="extrabold" size={14} color={colors.selva}>Subir .csv</Txt>
            </Tap>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Tap accessibilityRole="button" accessibilityLabel="Pegar el texto del Excel" accessibilityState={{ expanded: pasting }} onPress={() => setPasting(!pasting)} style={s.drop}>
            <Icon name="note" color={colors.selva} size={20} />
            <Txt w="extrabold" size={14} color={colors.selva}>Pegar texto</Txt>
          </Tap>
        </View>
      </View>

      {pasting ? (
        <TextInput value={text} onChangeText={review} multiline accessibilityLabel="Texto del Excel"
          placeholder={"arete;rfid;nombre;sexo;raza;nacimiento\n00201;;Paloma;hembra;Gyr;15/03/2022"} placeholderTextColor="#9AA39D"
          style={[s.paste, { fontFamily: fonts.regular }, { outlineStyle: "none" } as never]} />
      ) : null}

      {parsed ? (
        <View style={{ gap: 8 }}>
          <View style={s.review}>
            <Txt w="extrabold" size={15}>{`${plural(parsed.rows.length, "animal listo", "animales listos")} para guardar`}</Txt>
            {parsed.rows.slice(0, 4).map((r) => (
              <Txt key={r.line} size={13} color={colors.textMuted}>{`· ${[r.tagVisual, r.name].filter(Boolean).join(" ") || r.rfid} · ${r.sex}${r.breed ? ` · ${r.breed}` : ""} · ${shortDate(r.birthDate)}`}</Txt>
            ))}
            {parsed.rows.length > 4 ? <Txt size={13} color={colors.textMuted}>{`y ${parsed.rows.length - 4} más`}</Txt> : null}
          </View>
          {parsed.problems.length ? <Problems list={parsed.problems} title={`${plural(parsed.problems.length, "fila", "filas")} con problemas (no se guardan)`} /> : null}
          <Tap accessibilityRole="button" accessibilityLabel={`Guardar ${plural(parsed.rows.length, "animal", "animales")}`} disabled={busy || !parsed.rows.length} onPress={save} style={s.save}>
            <Txt w="bold" size={16} color={colors.onDark}>{busy ? "Guardando…" : `Guardar ${plural(parsed.rows.length, "animal", "animales")}`}</Txt>
          </Tap>
        </View>
      ) : null}

      {result ? (
        <View style={{ gap: 8 }}>
          <StatusCard icon="check" tone={result.created ? "ok" : "warn"} title={result.created ? `${plural(result.created, "animal guardado", "animales guardados")} en ${farmName}` : "No se guardó ningún animal"} />
          {result.problems.length ? <Problems list={result.problems} title={`${plural(result.problems.length, "fila", "filas")} sin guardar`} /> : null}
        </View>
      ) : null}
    </SoftCard>
  );
}

function Problems({ list, title }: { list: ImportProblem[]; title: string }) {
  return (
    <View style={[s.review, { backgroundColor: colors.dangerSoft }]}>
      <Txt w="bold" size={14} color={colors.urgentText}>{title}</Txt>
      {list.slice(0, 6).map((p, i) => <Txt key={i} size={13} color={colors.urgentText}>{`Fila ${p.line}: ${p.text}`}</Txt>)}
      {list.length > 6 ? <Txt size={13} color={colors.urgentText}>{`y ${list.length - 6} más`}</Txt> : null}
    </View>
  );
}

const s = StyleSheet.create({
  syncCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: colors.card, borderRadius: 20,
    shadowColor: colors.selva, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipBtn: { height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  drop: { height: 52, borderRadius: 26, borderWidth: 2, borderStyle: "dashed", borderColor: "#A5D6A7", backgroundColor: "#F6FBF6", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  paste: { minHeight: 120, maxHeight: 240, borderRadius: 16, borderWidth: 1, borderColor: colors.grip, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, textAlignVertical: "top" },
  review: { gap: 4, padding: 12, borderRadius: 16, backgroundColor: colors.tint },
  save: { height: 52, borderRadius: 26, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  big: { height: 64, borderRadius: 18, backgroundColor: colors.card, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
    shadowColor: colors.selva, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  softBtn: { height: 44, borderRadius: 22, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
