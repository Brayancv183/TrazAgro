import { useMemo, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import {
  addDays, animalLabel, colors, doseAmount, fonts, monthsBetween, num, plural, REVACCINATE_DAYS, shadow, shortDate, todayDay, weightSummary, withdrawalPreview,
  type Animal, type Product, type ProductKind,
} from "@trazagro/shared";
import { findByTag, listAnimals, listFarmEvents, listLots, listProducts, recordEvents, type RecordableType } from "../../db/repo";
import { useFarmId } from "../../lib/farm";
import { RequireWrite } from "../../ui/NoPermission";
import { useDbQuery } from "../../lib/useDb";
import { DateField, splitDay, toDay } from "../../ui/DateField";
import { Icon, type IconName } from "../../ui/Icon";
import { Chip, EarTag, Field, Txt, tagTone } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { FlowBar, FlowHeader, HAIR, noOutline, RoundButton, SavedMark, SectionLabel, Tag } from "../../ui/campo/parts";

type Kind = RecordableType | "parto";

/** "¿Qué pasó?" tiles (Evento.dc): tinted round icon on a white 112 px card. */
const TYPES: { id: Kind; label: string; icon: IconName; bg: string; fg: string }[] = [
  { id: "vacuna", label: "Vacuna", icon: "syringe", bg: colors.limaSoft, fg: colors.selva },
  { id: "tratamiento", label: "Tratamiento", icon: "drop", bg: colors.rosaSoft, fg: colors.rosa },
  { id: "desparasitacion", label: "Desparasitar", icon: "bug", bg: colors.tierraSoft, fg: colors.tierra },
  { id: "pesaje", label: "Pesaje", icon: "scale", bg: colors.infoSoft, fg: colors.info },
  { id: "parto", label: "Parto", icon: "heart", bg: colors.rosaSoft, fg: colors.rosa },
  { id: "nota", label: "Nota", icon: "note", bg: colors.warnSoft, fg: colors.warn },
];

const PRODUCT_KIND: Partial<Record<Kind, ProductKind>> = { vacuna: "vacuna", tratamiento: "medicina", desparasitacion: "medicina" };

function RegistrarEventoScreen() {
  // animalIds (comma separated) comes from "Modo corral"; kind preselects the type from the Crear sheet.
  const { farmId: farmParam, animalId, animalIds, kind: kindParam } = useLocalSearchParams<{ farmId?: string; animalId?: string; animalIds?: string; kind?: Kind }>();
  const farmId = useFarmId(farmParam);
  const db = useSQLiteContext();
  const router = useRouter();
  const today = todayDay();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind>(kindParam ?? "vacuna");
  const [selected, setSelected] = useState<string[]>(animalIds ? animalIds.split(",") : animalId ? [animalId] : []);
  const [productId, setProductId] = useState<string>();
  const [dose, setDose] = useState("");
  const [date, setDate] = useState(splitDay(today));
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  // Stock left is captured at save time: after reload() the product list already reflects the use.
  const [saved, setSaved] = useState<{ n: number; left?: number; kg?: number }>();

  const { data, reload } = useDbQuery(async (d) => {
    const [animals, lots, products, events] = await Promise.all([listAnimals(d, farmId), listLots(d, farmId), listProducts(d, farmId), listFarmEvents(d, farmId)]);
    return { animals, lots, products, events };
  }, [farmId]);

  const animals = data?.animals ?? [];
  const pool = kind === "parto" ? animals.filter((a) => a.sex === "hembra" && monthsBetween(a.birthDate, today) >= 15) : animals;
  const chosen = animals.filter((a) => selected.includes(a.id));
  const products = (data?.products ?? []).filter((p) => p.kind === PRODUCT_KIND[kind]);
  const product = products.find((p) => p.id === productId);
  const day = toDay(date);
  const perAnimal = doseAmount(dose);
  const used = perAnimal !== undefined ? perAnimal * chosen.length : undefined;
  const lastWeights = useMemo(() => {
    const out = new Map<string, { kg: number; date: string }>();
    for (const a of chosen) {
      const w = weightSummary((data?.events ?? []).filter((e) => e.animalId === a.id));
      if (w.lastKg && w.lastDate) out.set(a.id, { kg: w.lastKg, date: w.lastDate });
    }
    return out;
  }, [chosen, data]);

  const reset = (patch: () => void) => { setError(undefined); patch(); };

  function validate(): string | undefined {
    if (step === 1) {
      if (!chosen.length) return kind === "parto" ? "Elige la madre." : "Elige al menos un animal.";
      if (kind === "parto" && chosen.length > 1) return "Para un parto elige solo la madre.";
      if (kind === "parto" && !pool.some((a) => a.id === chosen[0]!.id)) return "La madre debe ser una hembra de 15 meses o más.";
    }
    if (step === 2) {
      if (!day || day > today) return "Revisa la fecha.";
      if (PRODUCT_KIND[kind] && !product) return "Elige el producto del inventario.";
      if (PRODUCT_KIND[kind] && perAnimal === undefined) return "Escribe la dosis, por ejemplo 2 ml.";
      if (kind === "pesaje" && !chosen.some((a) => kg(weights[a.id]) > 0)) return "Escribe al menos un peso.";
      if (kind === "nota" && !notes.trim()) return "Escribe la nota.";
    }
    return undefined;
  }

  async function next() {
    const problem = validate();
    if (problem) return setError(problem);
    if (step === 1 && kind === "parto") {
      // A birth creates the calf: continue in "Nuevo animal" with the mother already chosen.
      return router.replace({ pathname: "/animal/nuevo", params: { farmId, motherId: chosen[0]!.id } });
    }
    if (step < 3) { scroll.current?.scrollTo({ y: 0, animated: false }); return setStep(step + 1); }
    try {
      const n = await recordEvents(db, {
        farmId, type: kind as RecordableType, date: day!, animalIds: chosen.map((a) => a.id),
        productId: product?.id, dose: dose.trim() || undefined, quantityEach: perAnimal,
        weights: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, kg(v)])),
        weightMethod: "manual", notes: notes.trim() || undefined,
      });
      const single = chosen.length === 1 ? kg(weights[chosen[0]!.id]) : 0;
      setSaved({ n, left: product && used !== undefined ? product.stock - used : undefined, kg: kind === "pesaje" && single > 0 ? single : undefined });
      reload();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    }
  }

  const typeUi = TYPES.find((t) => t.id === kind)!;
  const labels = ["Qué", "Quién", kind === "pesaje" ? "Cómo pesar" : "Detalles", "Listo"];

  function again() {
    setSaved(undefined); setStep(0); setSelected(animalId ? [animalId] : []); setDose(""); setWeights({}); setNotes("");
  }

  if (saved) {
    const one = chosen.length === 1 ? chosen[0] : undefined;
    return (
      <View style={{ flex: 1 }}>
        <FlowHeader left={<RoundButton icon="x" label="Cerrar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />} kicker="LISTO" gap={14}>
          <Steps labels={labels} step={4} />
        </FlowHeader>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 6, paddingBottom: 140, alignItems: "center", gap: 12 }}>
          <Rise index={0}><SavedMark /></Rise>
          <Rise index={1} style={{ alignItems: "center", gap: 8 }}>
            <Txt w="extrabold" size={26}>{saved.kg ? `${num(saved.kg)} kg guardados` : "¡Guardado!"}</Txt>
            <Txt w="bold" size={17} style={{ textAlign: "center" }}>
              {saved.n === 1 ? `${typeUi.label} de ${one?.name ?? "1 animal"}` : `${typeUi.label} de ${saved.n} animales`}
            </Txt>
            <Txt size={15} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 22 }}>
              {`Quedó en ${saved.n === 1 ? "su" : "la"} trazabilidad automáticamente. No tienes que anotarlo otra vez.`}
            </Txt>
          </Rise>
          {product && used !== undefined && saved.left !== undefined ? (
            <Rise index={2} style={{ alignSelf: "stretch" }}>
              <Note icon="box" tone="ok" title={`Inventario: −${num(used)} ${product.unit}`} text={`Quedan ${num(saved.left)} ${product.unit} de ${product.name}.`} />
            </Rise>
          ) : null}
          {one ? (
            <Tap accessibilityRole="link" accessibilityLabel="Ver la ficha" onPress={() => router.replace({ pathname: "/animal/[id]", params: { id: one.id } })} style={{ minHeight: 44, justifyContent: "center" }}>
              <Txt w="bold" size={15} color={colors.link}>Ver la ficha</Txt>
            </Tap>
          ) : null}
        </ScrollView>
        <FlowBar back="Salir" onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} next="Registrar otro" onNext={again} />
      </View>
    );
  }

  const title = ["¿Qué pasó?", kind === "parto" ? "¿Quién parió?" : "¿A quién?", kind === "pesaje" ? "¿Cómo lo vas a pesar?" : "Detalles", "¿Todo bien?"][step]!;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <FlowHeader left={<RoundButton icon="x" label="Cancelar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
          kicker={`REGISTRAR · PASO ${step + 1} DE 4`} gap={14}>
          <Steps labels={labels} step={step} />
        </FlowHeader>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Rise key={`t${step}`} index={0}><Txt w="extrabold" size={28} style={{ letterSpacing: -0.56 }}>{title}</Txt></Rise>

          {step === 0 ? (
            <View style={s.grid}>
              {TYPES.map((t, i) => {
                const on = kind === t.id;
                return (
                  <Rise key={t.id} index={i + 1} style={{ width: "48.5%" }}>
                    <Tap accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: on }} aria-pressed={on}
                      onPress={() => reset(() => { setKind(t.id); setProductId(undefined); setDose(""); })}
                      style={[s.tile, on && s.tileOn]}>
                      <View style={[s.tileIcon, { backgroundColor: t.bg }]}><Icon name={t.icon} color={t.fg} size={24} /></View>
                      <Txt w="bold" size={16}>{t.label}</Txt>
                    </Tap>
                  </Rise>
                );
              })}
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <Rise index={1}>
                <ScanCard onFound={(a) => reset(() => setSelected((cur) => kind === "parto" ? [a.id] : cur.includes(a.id) ? cur : [...cur, a.id]))} farmId={farmId} pool={pool} />
              </Rise>
              {kind !== "parto" ? (data?.lots ?? []).map((l, i) => {
                const ids = animals.filter((a) => a.lotId === l.id).map((a) => a.id);
                if (!ids.length) return null;
                const all = ids.every((id) => selected.includes(id)) && selected.length === ids.length;
                const name = l.name.split(" · ")[0];
                return (
                  <Rise key={l.id} index={i + 2}>
                    <Tap accessibilityRole="button" accessibilityLabel={`Todo el ${name} (${ids.length})`} accessibilityState={{ selected: all }} aria-pressed={all}
                      onPress={() => reset(() => setSelected(all ? [] : ids))} style={[s.target, { borderColor: all ? colors.selva : colors.line }]}>
                      <View style={{ flex: 1 }}>
                        <Txt w="bold" size={16}>{`Todo el ${name}`}</Txt>
                        <Txt size={13} color={colors.textMuted}>{plural(ids.length, "animal", "animales")}</Txt>
                      </View>
                      <Radio on={all} />
                    </Tap>
                  </Rise>
                );
              }) : null}
              <View style={s.listHead}>
                <SectionLabel>{kind === "parto" ? "Elige la madre" : "O elige de la lista"}</SectionLabel>
                {kind !== "parto" ? <Tag label={`${chosen.length} ${chosen.length === 1 ? "elegido" : "elegidos"}`} bg={colors.limaSoft} fg={colors.selva} /> : null}
              </View>
              {pool.map((a, i) => (
                <Rise key={a.id} index={Math.min(i + 4, 10)}>
                  <AnimalPick a={a} on={selected.includes(a.id)} sub={[a.tagVisual && `#${a.tagVisual}`, a.breed].filter(Boolean).join(" · ")}
                    onPress={() => reset(() => setSelected((cur) => kind === "parto" ? [a.id] : cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id]))} />
                </Rise>
              ))}
              {kind === "parto" ? <Note icon="heart" tone="ok" title="Luego registras la cría" text="Le pones su arete y queda como hija de la madre, con el parto anotado." /> : null}
            </>
          ) : null}

          {step === 2 && PRODUCT_KIND[kind] ? (
            <>
              <Rise index={1} style={{ gap: 8 }}>
                <Txt w="semibold" size={13} color={colors.textMuted}>Producto (del inventario)</Txt>
                <View style={s.row}>
                  {products.map((p) => <Chip key={p.id} label={`${p.name} · ${num(p.stock)} ${p.unit}`} active={productId === p.id} onPress={() => reset(() => setProductId(p.id))} />)}
                </View>
                {!products.length ? <Note icon="box" tone="warn" title="No hay productos de este tipo en el inventario" text="Agrégalo en Inventario para descontarlo solo." /> : null}
              </Rise>
              <Rise index={2} style={{ gap: 12 }}>
                <Field label={chosen.length > 1 ? "Dosis por animal" : "Dosis"} value={dose} onChangeText={(t) => reset(() => setDose(t))}
                  placeholder={product ? `Ej: 2 ${product.unit}` : "Ej: 2 ml"} style={noOutline} />
                <DateField label="Fecha" value={date} onChange={(v) => reset(() => setDate(v))} />
              </Rise>
              {product && day ? <Rise index={3} style={{ gap: 10 }}><ProductNotes product={product} day={day} today={today} used={used} vaccine={kind === "vacuna"} /></Rise> : null}
            </>
          ) : null}

          {step === 2 && kind === "pesaje" ? (
            <>
              <Method index={1} icon="scale" bg={colors.limaSoft} fg={colors.selva} label="Báscula Bluetooth" sub="Exacto · pesas y guardas" soon />
              <Method index={2} icon="camera" bg={colors.warnSoft} fg={colors.warn} label="Foto con IA" sub="Aproximado ± margen de error" soon />
              <Method index={3} icon="edit" bg={colors.tierraSoft} fg={colors.tierra} label="Escribir el peso" sub="De otra báscula o con cinta" on />
              {chosen.length === 1 ? (
                <SingleWeight a={chosen[0]!} value={weights[chosen[0]!.id] ?? ""} last={lastWeights.get(chosen[0]!.id)} today={today}
                  onChange={(t) => reset(() => setWeights((w) => ({ ...w, [chosen[0]!.id]: t })))} />
              ) : (
                <Rise index={4} style={{ gap: 10 }}>
                  <View style={s.listHead}>
                    <SectionLabel>Peso de cada uno</SectionLabel>
                    <Tag label="Vacíos no se guardan" bg={colors.sand} fg={colors.textMuted} />
                  </View>
                  {chosen.map((a) => {
                    const lw = lastWeights.get(a.id);
                    return (
                      <View key={a.id} style={s.weighRow}>
                        <EarTag code={a.tagVisual} size={34} tone={tagTone(a.sex)} />
                        <View style={{ flex: 1 }}>
                          <Txt w="bold" size={16}>{animalLabel(a)}</Txt>
                          <Txt size={12} color={colors.textMuted}>{lw ? `Último ${num(lw.kg)} kg · ${shortDate(lw.date, today)}` : "Sin pesajes"}</Txt>
                        </View>
                        <View style={s.kgBox}>
                          <TextInput value={weights[a.id] ?? ""} onChangeText={(t) => reset(() => setWeights((w) => ({ ...w, [a.id]: t.replace(/[^\d.,]/g, "") })))}
                            keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9AA39D" accessibilityLabel={`Peso de ${a.name ?? a.tagVisual} en kilos`}
                            style={[s.kgInput, { fontFamily: fonts.extrabold }, noOutline]} />
                          <Txt w="bold" size={14} color={colors.textMuted}>kg</Txt>
                        </View>
                      </View>
                    );
                  })}
                </Rise>
              )}
              <Rise index={5}><DateField label="Fecha" value={date} onChange={(v) => reset(() => setDate(v))} /></Rise>
            </>
          ) : null}

          {step === 2 && kind === "nota" ? (
            <Rise index={1} style={{ gap: 12 }}>
              <Field label="Nota" value={notes} onChangeText={(t) => reset(() => setNotes(t))} placeholder="Ej: cojea de la pata trasera" multiline
                style={[{ minHeight: 110, paddingTop: 16, borderRadius: 24, textAlignVertical: "top" }, noOutline]} />
              <DateField label="Fecha" value={date} onChange={(v) => reset(() => setDate(v))} />
            </Rise>
          ) : null}

          {step === 3 ? (
            <>
              <Rise index={1} style={s.summary}>
                {summary().map(([k, v], i, arr) => (
                  <View key={k} style={[s.sum, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: HAIR }]}>
                    <Txt size={15} color={colors.textMuted}>{k}</Txt>
                    <Txt w="bold" size={15} style={{ flexShrink: 1, textAlign: "right" }}>{v}</Txt>
                  </View>
                ))}
              </Rise>
              {product && day ? <Rise index={2} style={{ gap: 10 }}><ProductNotes product={product} day={day} today={today} used={used} vaccine={kind === "vacuna"} /></Rise> : null}
              <Txt size={13} color={colors.textMuted} style={{ textAlign: "center" }}>Se guarda en el teléfono y se sube cuando haya señal.</Txt>
            </>
          ) : null}

          {error ? <Note icon="alert" tone="danger" title={error} /> : null}
        </View>
      </ScrollView>

      <FlowBar back={step ? "Atrás" : "Cancelar"} onBack={() => (step ? reset(() => setStep(step - 1)) : router.canGoBack() ? router.back() : router.replace("/"))}
        next={step === 3 ? "Guardar registro" : step === 1 && kind === "parto" ? "Registrar la cría" : "Siguiente"} onNext={next} />
    </KeyboardAvoidingView>
  );

  function summary(): [string, string][] {
    const who = chosen.length === 1 ? `${chosen[0]!.name ?? ""} #${chosen[0]!.tagVisual ?? ""}` : `${chosen.length} animales`;
    const rows: [string, string][] = [["Qué", typeUi.label], ["A quién", who]];
    if (product) rows.push(["Producto", `${product.name} · ${dose}${chosen.length > 1 ? " c/u" : ""}`]);
    if (kind === "pesaje") {
      const n = chosen.filter((a) => kg(weights[a.id]) > 0).length;
      if (chosen.length === 1 && n) rows.push(["Peso", `${num(kg(weights[chosen[0]!.id]))} kg · escrito a mano`]);
      else rows.push(["Pesajes", `${n} de ${chosen.length} con peso`]);
    }
    if (kind === "nota") rows.push(["Nota", notes.trim()]);
    rows.push(["Fecha", day ? `${day === today ? "Hoy, " : ""}${shortDate(day, today)}` : "—"]);
    return rows;
  }
}

/** Progress dots with the dotted line behind them. `step` 4 = all done. */
function Steps({ labels, step }: { labels: string[]; step: number }) {
  return (
    <View style={s.steps} accessibilityLabel={`Paso ${Math.min(step + 1, 4)} de 4`}>
      <View style={s.stepLine} />
      {labels.map((l, i) => {
        const done = i < step, now = i === step;
        return (
          <View key={l} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={[s.nodeHalo, now && { backgroundColor: "rgba(174,213,129,0.3)" }]}>
              <View style={[s.node, done ? s.nodeDone : now ? s.nodeNow : s.nodeIdle]}>
                <Txt w="extrabold" size={14} color={done || now ? colors.selva : colors.onDarkMuted}>{done ? "✓" : String(i + 1)}</Txt>
              </View>
            </View>
            <Txt w="semibold" size={12} color={now ? colors.onDark : colors.onDarkMuted}>{l}</Txt>
          </View>
        );
      })}
    </View>
  );
}

function Radio({ on }: { on: boolean }) {
  return <View style={[s.radio, on && { borderColor: colors.selva }]}>{on ? <View style={s.radioDot} /> : null}</View>;
}

/** "Leer el arete" card: opens a field where a Bluetooth reader (or the keyboard) adds the animal. */
function ScanCard({ farmId, pool, onFound }: { farmId: string; pool: Animal[]; onFound: (a: Animal) => void }) {
  const db = useSQLiteContext();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  async function read() {
    const c = code.trim();
    if (!c) return;
    const a = await findByTag(db, farmId, c);
    setCode("");
    input.current?.focus();
    if (!a || a.status !== "activo" || !pool.some((p) => p.id === a.id)) return setMsg({ ok: false, text: `No hay un animal que sirva con “${c}”` });
    onFound(a);
    setMsg({ ok: true, text: `Elegido: ${animalLabel(a)}` });
  }
  return (
    <View style={s.scanCard}>
      <Tap accessibilityRole="button" accessibilityLabel="Leer el arete" onPress={() => { setOpen(!open); setMsg(undefined); setTimeout(() => input.current?.focus(), 60); }}
        style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={s.scanIc}><Icon name="scan" color={colors.selva} size={26} /></View>
        <View style={{ flex: 1 }}>
          <Txt w="extrabold" size={18} color={colors.onDark}>Leer el arete</Txt>
          <Txt size={13} color={colors.onDarkMuted}>Lo más rápido en el corral</Txt>
        </View>
        <Icon name={open ? "up" : "down"} color={colors.onDarkMuted} size={20} />
      </Tap>
      {open ? (
        <View style={{ gap: 8 }}>
          <View style={s.scanField}>
            <TextInput ref={input} value={code} onChangeText={(t) => { setMsg(undefined); setCode(t); }} onSubmitEditing={read} blurOnSubmit={false}
              placeholder="Arete o RFID" placeholderTextColor="#9AA39D" autoCapitalize="characters" returnKeyType="search" accessibilityLabel="Número de arete o RFID"
              style={[{ flex: 1, minWidth: 0, width: 10, minHeight: 52, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text }, noOutline]} />
            <Tap accessibilityRole="button" accessibilityLabel="Elegir por arete" onPress={read} disabled={!code.trim()} style={s.scanGo}>
              <Icon name="check" color={colors.onDark} size={20} width={2.6} />
            </Tap>
          </View>
          {msg ? <Txt w="bold" size={13} color={msg.ok ? colors.lima : colors.signal}>{msg.text}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

function Method({ icon, bg, fg, label, sub, soon, on, index }: { icon: IconName; bg: string; fg: string; label: string; sub: string; soon?: boolean; on?: boolean; index: number }) {
  return (
    <Rise index={index}>
      <View accessibilityLabel={`${label}${soon ? ", pronto" : ""}`} style={[s.method, on && s.methodOn, soon && { opacity: 0.72 }]}>
        <View style={[s.methodIc, { backgroundColor: bg }]}><Icon name={icon} color={fg} size={24} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt w="extrabold" size={17}>{label}</Txt>
          <Txt size={13} color={colors.textMuted}>{sub}</Txt>
        </View>
        {soon ? <Tag label="PRONTO" bg={colors.sand} fg={colors.textMuted} /> : on ? <Icon name="check" color={colors.selva} size={22} width={2.6} /> : null}
      </View>
    </Rise>
  );
}

/** One animal: the scale-style ring (PesoBascula.dc) fed by the typed weight, last weighing and the gain. */
function SingleWeight({ a, value, last, today, onChange }: { a: Animal; value: string; last?: { kg: number; date: string }; today: string; onChange: (t: string) => void }) {
  const w = kg(value);
  const r = 66, len = 2 * Math.PI * r;
  const ring = w > 0 ? colors.link : "#F9A825";
  const gain = w > 0 && last ? w - last.kg : undefined;
  return (
    <Rise index={4} style={{ gap: 12 }}>
      <View style={{ alignItems: "center" }}>
        <Svg width={200} height={200} viewBox="0 0 160 160">
          <Circle cx={80} cy={80} r={r} fill="none" stroke={HAIR} strokeWidth={10} />
          <Circle cx={80} cy={80} r={r} fill="none" stroke={ring} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${w > 0 ? len : len * 0.08} ${len}`} transform="rotate(-90 80 80)" />
          <Circle cx={80} cy={14} r={6} fill={ring} />
          <SvgText x={80} y={88} textAnchor="middle" fontFamily={fonts.extrabold} fontSize={w >= 1000 ? 36 : 44} fontWeight="800" fill={colors.text}>{w > 0 ? num(w) : "—"}</SvgText>
          <SvgText x={80} y={110} textAnchor="middle" fontFamily={fonts.semibold} fontSize={14} fontWeight="600" fill={colors.textMuted}>kilogramos</SvgText>
        </Svg>
      </View>
      <View style={s.bigKg}>
        <TextInput value={value} onChangeText={(t) => onChange(t.replace(/[^\d.,]/g, ""))} keyboardType="decimal-pad" placeholder="Peso" placeholderTextColor="#9AA39D"
          accessibilityLabel={`Peso de ${a.name ?? a.tagVisual} en kilos`} style={[{ flex: 1, minWidth: 0, fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, minHeight: 54 }, noOutline]} />
        <Txt w="bold" size={15} color={colors.textMuted}>kg</Txt>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={s.mini}>
          <Txt size={12} color={colors.textMuted}>Último pesaje</Txt>
          <Txt w="extrabold" size={18}>{last ? `${num(last.kg)} kg` : "—"}</Txt>
          <Txt size={11} color={colors.textMuted}>{last ? shortDate(last.date, today) : "Sin pesajes"}</Txt>
        </View>
        <View style={s.mini}>
          <Txt size={12} color={colors.textMuted}>Ganancia</Txt>
          <Txt w="extrabold" size={18} color={gain === undefined ? colors.text : gain >= 0 ? colors.link : colors.danger}>{gain === undefined ? "…" : `${gain >= 0 ? "+" : "−"}${num(Math.abs(gain))} kg`}</Txt>
          <Txt size={11} color={colors.textMuted}>desde el último</Txt>
        </View>
      </View>
    </Rise>
  );
}

/** Tinted note row (Evento.dc "notes"): yellow for waiting days, green for inventory, red for problems. */
function Note({ icon, title, text, tone }: { icon: IconName; title: string; text?: string; tone: "ok" | "warn" | "danger" }) {
  const pal = { ok: [colors.limaSoft, colors.selva, colors.selva], warn: [colors.warnSoft, "#6B4A00", colors.signalText], danger: [colors.dangerSoft, colors.danger, colors.urgentText] }[tone];
  return (
    <View style={[s.note, { backgroundColor: pal[0] }]}>
      <Icon name={icon} color={pal[1]} size={20} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={14} color={pal[2]} style={{ lineHeight: 19 }}>{title}</Txt>
        {text ? <Txt w="medium" size={13} color={pal[2]} style={{ lineHeight: 18 }}>{text}</Txt> : null}
      </View>
    </View>
  );
}

function ProductNotes({ product, day, today, used, vaccine }: { product: Product; day: string; today: string; used?: number; vaccine?: boolean }) {
  const w = withdrawalPreview(day, product);
  const left = used !== undefined ? product.stock - used : undefined;
  return (
    <>
      {vaccine ? <Note icon="calendar" tone="ok" title={`Próxima dosis: ${shortDate(addDays(day, REVACCINATE_DAYS), today)}`} text="Aparece en la agenda para que no se pase." /> : null}
      {w.milkUntil || w.meatUntil ? (
        <Note icon="drop" tone="warn" title="Días de retiro calculados solos"
          text={[w.milkUntil && `Leche: hasta el ${shortDate(w.milkUntil, today)}`, w.meatUntil && `Carne: hasta el ${shortDate(w.meatUntil, today)}`].filter(Boolean).join(" · ")} />
      ) : <Note icon="check" tone="ok" title="Sin días de retiro" text="Este producto no restringe la leche ni la carne." />}
      {used !== undefined ? (
        left !== undefined && left < 0
          ? <Note icon="box" tone="danger" title={`No alcanza: hay ${num(product.stock)} ${product.unit}`} text={`Se necesitan ${num(used)} ${product.unit}. Puedes guardar igual y comprar más.`} />
          : <Note icon="box" tone="ok" title={`Se descuentan ${num(used)} ${product.unit} del inventario`} text={`Quedan ${num(left!)} ${product.unit}.`} />
      ) : null}
    </>
  );
}

function AnimalPick({ a, on, sub, onPress }: { a: Animal; on: boolean; sub: string; onPress: () => void }) {
  return (
    <Tap accessibilityRole="checkbox" aria-checked={on} accessibilityState={{ checked: on }} accessibilityLabel={`${a.name ?? ""} ${a.tagVisual ?? ""}`} onPress={onPress}
      style={[s.pick, { borderColor: on ? colors.selva : "transparent" }]}>
      <EarTag code={a.tagVisual} size={34} tone={tagTone(a.sex)} />
      <View style={{ flex: 1 }}>
        <Txt w="bold" size={16}>{animalLabel(a)}</Txt>
        <Txt size={12} color={colors.textMuted}>{sub}</Txt>
      </View>
      <View style={[s.check, on && { borderColor: colors.selva, backgroundColor: colors.selva }]}>{on ? <Icon name="check" color={colors.onDark} size={14} width={3} /> : null}</View>
    </Tap>
  );
}

/** Kilos typed with comma or dot ("300,5"); 0 when empty or not a number. */
const kg = (v?: string) => Number((v ?? "").replace(",", ".")) || 0;

const s = StyleSheet.create({
  steps: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 8, marginBottom: 4 },
  stepLine: { position: "absolute", left: 50, right: 50, top: 20, borderTopWidth: 2, borderStyle: "dashed", borderColor: "rgba(174,213,129,0.6)" },
  nodeHalo: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginTop: -5, marginBottom: -5 },
  node: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nodeNow: { backgroundColor: colors.lima },
  nodeDone: { backgroundColor: colors.onDark },
  nodeIdle: { backgroundColor: colors.selva, borderWidth: 2, borderColor: "rgba(174,213,129,0.6)" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  tile: { height: 112, borderRadius: 24, padding: 14, justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 2, borderColor: "transparent", ...shadow },
  tileOn: { borderColor: colors.selva, shadowOpacity: 0.15, shadowRadius: 22 },
  tileIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scanCard: { padding: 18, borderRadius: 24, backgroundColor: colors.selva, gap: 14 },
  scanIc: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lima, alignItems: "center", justifyContent: "center" },
  scanField: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderRadius: 28, paddingLeft: 18, paddingRight: 6 },
  scanGo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  target: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.selva },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingVertical: 6, paddingLeft: 10, paddingRight: 14, borderRadius: 22, backgroundColor: colors.card, borderWidth: 2, ...shadow },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
  method: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 24, backgroundColor: colors.card, borderWidth: 2, borderColor: "transparent", ...shadow },
  methodOn: { borderColor: colors.selva },
  methodIc: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  bigKg: { flexDirection: "row", alignItems: "center", gap: 6, height: 58, paddingHorizontal: 20, borderRadius: 29, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.selva },
  mini: { flex: 1, backgroundColor: colors.card, borderRadius: 20, padding: 12, ...shadow },
  weighRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 22, paddingVertical: 8, paddingLeft: 10, paddingRight: 8, ...shadow },
  kgBox: { flexDirection: "row", alignItems: "center", gap: 4, width: 112, height: 50, borderRadius: 25, paddingHorizontal: 14, borderWidth: 2, borderColor: colors.selva, backgroundColor: colors.card },
  kgInput: { flex: 1, minWidth: 0, fontSize: 20, color: colors.text, textAlign: "right", minHeight: 44 },
  summary: { backgroundColor: colors.card, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, ...shadow },
  sum: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 14 },
  note: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20 },
});

export default function Screen() {
  return <RequireWrite table="events"><RegistrarEventoScreen /></RequireWrite>;
}
