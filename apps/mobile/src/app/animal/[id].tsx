import { useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import {
  addDays, ageText, animalLabel, canWrite, categoryOf, colors, inWithdrawal, num, reproStatus, shadow, shortDate, todayDay, weightSummary, withdrawalFor,
  type AnimalEvent, type EventType, type Product,
} from "@trazagro/shared";
import { pendingRecordIds, shortLot } from "../../db/animales";
import { addPhoto, deletePhoto, listPhotos, type Photo } from "../../db/photos";
import { getAnimal, listChildren, listEvents, listLots, listMilk, listProducts } from "../../db/repo";
import { useFarm } from "../../lib/farm";
import { loadSession } from "../../lib/session";
import { shareText } from "../../lib/share";
import { useDbQuery } from "../../lib/useDb";
import { Icon } from "../../ui/Icon";
import { Banner, EarTag, Empty, GreenHeader, Sheet, tagTone, Txt, Wave } from "../../ui/kit";
import { Rise, Tap } from "../../ui/motion";
import { BarGhost, BarMain, BottomBar, DashedButton, SegTabs } from "../../ui/animales/parts";
import { pickPhoto } from "../../ui/animales/photo";
import { QrModal } from "../../ui/animales/QrModal";
import { ShareSheet, type SharePart } from "../../ui/animales/ShareSheet";
import { statusOf } from "../../ui/animales/status";

const EVENT_LABEL: Record<EventType, string> = {
  vacuna: "Vacuna", tratamiento: "Tratamiento", desparasitacion: "Desparasitación", pesaje: "Pesaje", parto: "Parto", servicio: "Servicio",
  diagnostico: "Palpación", secado: "Secado", traslado: "Cambio de lote", baja: "Baja", nota: "Nota", reporte_ica: "Reportado al ICA",
};
/** Timeline ring color per event, as in the mockup (blue weighing, amber photo estimate, red treatment, pink births…). */
const RING: Record<EventType, string> = {
  vacuna: colors.hoja, tratamiento: colors.urgent, desparasitacion: colors.tierra, pesaje: "#1976D2", parto: "#C2185B", servicio: "#C2185B",
  diagnostico: "#C2185B", secado: "#1976D2", traslado: "#A0A8A2", baja: colors.danger, nota: "#A0A8A2", reporte_ica: colors.selva,
};
const METHOD = { bascula: "Báscula", foto: "Estimado por foto", manual: "Escrito a mano" } as const;
const STATUS_LABEL = { activo: "activo", vendido: "vendido", muerto: "murió", sacrificado: "sacrificado", perdido: "perdido o robado", trasladado: "trasladado a otra finca" } as const;
const SALUD: EventType[] = ["vacuna", "tratamiento", "desparasitacion"];
const REPRO: EventType[] = ["parto", "servicio", "diagnostico", "secado"];
type Tab = "todo" | "salud" | "peso" | "partos" | "hijos";

export default function FichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const tileW = (Math.min(useWindowDimensions().width, 640) - 42) / 2;
  const { roleOf, farms } = useFarm();
  const [tab, setTab] = useState<Tab>("todo");
  const [qr, setQr] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [viewing, setViewing] = useState<Photo>();
  const { data, reload } = useDbQuery(async (d) => {
    const animal = await getAnimal(d, id);
    if (!animal) return null;
    const [events, children, products, lots, mother, milk, photos, pending, session] = await Promise.all([
      listEvents(d, id), listChildren(d, id), listProducts(d, animal.farmId), listLots(d, animal.farmId),
      animal.motherId ? getAnimal(d, animal.motherId) : Promise.resolve(null), listMilk(d, animal.farmId, addDays(todayDay(), -6)),
      listPhotos(d, animal.farmId, id), pendingRecordIds(d), loadSession(),
    ]);
    return { animal, events, children, products, lot: lots.find((l) => l.id === animal.lotId), mother, milk: milk.filter((m) => m.animalId === id), photos, pending, session: !!session };
  }, [id]);

  if (data === null) return <View style={{ flex: 1 }}><GreenHeader back title="No encontrado" /><Empty title="Este animal no existe" text="Puede que se haya dado de baja." /></View>;
  if (!data) return <GreenHeader back title="Cargando…" />;

  const { animal: a, events, children, products, lot, mother, milk, photos, pending, session } = data;
  const today = todayDay();
  const farm = farms.find((f) => f.id === a.farmId);
  const births = events.filter((e) => e.type === "parto").length;
  const category = categoryOf(a.sex, a.birthDate, births, today);
  const w = withdrawalFor(events, products);
  const active = inWithdrawal(w, today);
  const exitEvent = events.find((e) => e.type === "baja");
  const weight = weightSummary(events);
  const repro = a.sex === "hembra" && births + events.filter((e) => e.type === "servicio").length > 0 ? reproStatus(events, today) : undefined;
  const milkDays = new Set(milk.map((m) => m.date)).size;
  const milkAvg = milkDays ? milk.reduce((n, m) => n + m.liters, 0) / milkDays : undefined;
  const label = animalLabel(a);
  const editable = a.status === "activo" && canWrite(roleOf(a.farmId), "animals");
  const female = a.sex === "hembra";
  const cloud = !farm?.isDemo && session;
  const hero = photos[0];

  async function takePhoto(note?: string) {
    const uri = await pickPhoto("camera");
    if (!uri) return;
    await addPhoto(db, { farmId: a.farmId, animalId: a.id, uri, note });
    reload();
  }

  function share(parts: Set<SharePart>) {
    const lines = [
      `${label}${a.tagVisual ? ` · arete ${a.tagVisual}` : ""}${a.rfid ? ` · RFID ${a.rfid}` : ""}`,
      parts.has("id") ? `${category}, ${a.breed ?? "raza no registrada"}, ${ageText(a.birthDate, today)} (nació ${shortDate(a.birthDate)})` : "",
      parts.has("peso") && weight.lastKg ? `Último peso: ${num(weight.lastKg)} kg (${shortDate(weight.lastDate!)})` : "",
      parts.has("salud") ? (active.meat || active.milk ? `EN RETIRO hasta ${shortDate((w.meatUntil ?? w.milkUntil)!)}` : "Sin días de retiro activos") : "",
      parts.has("repro") && mother ? `Madre: ${animalLabel(mother)}` : "",
      "",
      "Historial:",
      ...events.filter((e) => (parts.has("salud") && SALUD.includes(e.type)) || (parts.has("peso") && e.type === "pesaje") || (parts.has("repro") && REPRO.includes(e.type)))
        .slice(0, 20).map((e) => `· ${shortDate(e.date)} ${EVENT_LABEL[e.type]}${detailOf(e, products) ? ` · ${detailOf(e, products)}` : ""}`),
      "",
      "Ficha generada con TrazAgro",
    ];
    return shareText(`Ficha de ${label}`, lines.filter((l, i) => l !== "" || i > 4).join("\n"));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "todo", label: "Todo" }, { id: "salud", label: "Salud" }, { id: "peso", label: "Peso" },
    female ? { id: "partos", label: "Partos" } : { id: "hijos", label: "Hijos" },
  ];
  const rows = tab === "todo" ? events : tab === "salud" ? events.filter((e) => SALUD.includes(e.type)) : tab === "peso" ? events.filter((e) => e.type === "pesaje") : tab === "partos" ? events.filter((e) => REPRO.includes(e.type)) : [];

  const lastBirth = events.find((e) => e.type === "parto");
  const facts: { k: string; v: string; s: string; good?: boolean }[] = [
    { k: "Edad", v: ageText(a.birthDate, today), s: `Nació ${shortDate(a.birthDate)}` },
    ...(female ? [{ k: "Leche", v: milkAvg !== undefined ? `${num(milkAvg)} L/día` : "—", s: milkAvg !== undefined ? "Promedio 7 días" : "Sin ordeños" }] : []),
    ...(female ? [{ k: "Partos", v: String(births), s: repro?.state === "prenada" ? `Parto: ${shortDate(repro.expectedCalving!, today)}` : repro?.state === "servida" ? `Palpar: ${shortDate(repro.checkOn!, today)}` : lastBirth ? `Último: ${shortDate(lastBirth.date, today)}` : "Ninguno" }] : []),
    { k: "Peso", v: weight.lastKg ? `${num(weight.lastKg, 0)} kg` : "—", good: (weight.dailyGainKg ?? -1) >= 0,
      s: weight.dailyGainKg !== undefined ? `${weight.dailyGainKg >= 0 ? "▲" : "▼"} ${num(Math.abs(weight.dailyGainKg), 2)} kg/día` : weight.lastDate ? shortDate(weight.lastDate, today) : "Sin pesajes" },
    { k: "Raza", v: a.breed ?? "—", s: category.charAt(0).toUpperCase() + category.slice(1) },
    { k: "Lote", v: shortLot(lot) ?? "—", s: lot?.purpose ?? (lot?.name.split(" · ")[1] ?? "Sin lote") },
    ...(!female ? [{ k: "Hijos", v: String(children.length), s: "Registrados" }] : []),
  ];

  const family: { k: string; v: string; href?: string }[] = [
    { k: "Origen", v: a.origin === "nacido" ? "Nació en la finca" : "Comprado" },
    { k: "Madre", v: mother ? `${mother.name ?? ""} · #${mother.tagVisual ?? "—"}` : "No registrada", href: mother?.id },
    { k: "Padre", v: a.sireNote ?? "No registrado" },
    ...(children.length || female ? [{ k: female ? "Crías" : "Hijos", v: children.length ? `${animalLabel(children[0]!)}${children[0]!.tagVisual && children[0]!.name ? ` #${children[0]!.tagVisual}` : ""}${children.length > 1 ? ` y ${children.length - 1} más` : ""}` : "Todavía no", href: children[0]?.id }] : []),
  ];

  // "Cómo ha crecido": one tile per year since birth (last four), with the newest photo of that year.
  const thisYear = Number(today.slice(0, 4));
  const born = Number(a.birthDate.slice(0, 4));
  const first = Math.max(born, thisYear - 3);
  const years = Array.from({ length: 4 }, (_, i) => first + i);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: editable ? 120 : 40 }}>
        <View style={[s.hero, { height: 290 + insets.top }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={hero ? `Ver foto de ${label}` : editable ? `Agregar foto de ${label}` : `${label} no tiene foto`}
            onPress={() => (hero ? setViewing(hero) : editable ? takePhoto() : undefined)} style={StyleSheet.absoluteFill}>
            {hero ? (
              <>
                <Image source={{ uri: hero.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.12)" }]} />
              </>
            ) : (
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", gap: 10, paddingTop: insets.top }]}>
                <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                  <Defs><RadialGradient id="hg" cx="50%" cy="50%" r="72%"><Stop offset="0" stopColor={colors.hoja} /><Stop offset="1" stopColor={colors.selva} /></RadialGradient></Defs>
                  <Rect width="100%" height="100%" fill="url(#hg)" />
                </Svg>
                <Svg width={300} height={300} viewBox="0 0 160 160" style={{ position: "absolute", left: 45, top: insets.top - 6 }}>
                  <Circle cx={80} cy={80} r={66} fill="none" stroke="rgba(174,213,129,0.35)" strokeWidth={1.5} strokeDasharray="2 9" strokeLinecap="round" />
                  <Circle cx={80} cy={14} r={5} fill={colors.lima} /><Circle cx={14} cy={80} r={5} fill={colors.lima} /><Circle cx={127} cy={127} r={5} fill={colors.lima} />
                </Svg>
                <View style={s.heroRing}><Icon name="camera" color={colors.lima} size={32} /></View>
                <Txt w="bold" size={15} color={colors.onDark}>{editable ? `Agregar foto de ${label}` : "Todavía no tiene foto"}</Txt>
                {editable ? <Txt size={12} color={colors.onDarkMuted}>Toca para tomarla o elegirla</Txt> : null}
              </View>
            )}
          </Pressable>
          <View style={[s.heroTop, { top: insets.top + 16 }]}>
            <Tap accessibilityRole="button" accessibilityLabel="Volver a animales" onPress={() => (router.canGoBack() ? router.back() : router.replace("/animales"))} style={s.glass}>
              <Icon name="back" color={colors.onDark} size={22} width={2.2} />
            </Tap>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Tap accessibilityRole="button" accessibilityLabel="Compartir ficha" onPress={() => setSharing(true)} style={s.glass}><Icon name="share" color={colors.onDark} size={20} width={2.2} /></Tap>
              <Tap accessibilityRole="button" accessibilityLabel="Código QR" onPress={() => setQr(true)} style={s.glass}><Icon name="qr" color={colors.onDark} size={20} /></Tap>
              {editable ? (
                <Tap accessibilityRole="button" accessibilityLabel="Editar datos" onPress={() => router.push({ pathname: "/animal/editar", params: { id: a.id } })} style={s.edit}>
                  <Icon name="edit" color={colors.selva} size={16} width={2.2} />
                  <Txt w="bold" size={14} color={colors.selva}>Editar</Txt>
                </Tap>
              ) : null}
            </View>
          </View>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}><Wave height={40} style={{ backgroundColor: "transparent" }} /></View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Rise index={0} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <EarTag code={a.tagVisual} tone={tagTone(a.sex)} size={52} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Txt w="extrabold" size={32} style={{ letterSpacing: -0.64, lineHeight: 34 }}>{label}</Txt>
                <View style={s.status}><Txt w="bold" size={12} color={colors.selva}>{a.status === "activo" ? statusOf({ category, milkAvg, repro }) : "De baja"}</Txt></View>
              </View>
              <Txt size={13} color={colors.textMuted}>
                {[a.tagVisual ? `#${a.tagVisual}` : "Sin arete", a.rfid ? `RFID ${a.rfid}` : "Sin chip RFID", female ? "Hembra" : "Macho"].join(" · ")}
              </Txt>
            </View>
          </Rise>

          {a.status !== "activo" ? (
            <Banner icon="note" tone="danger" title={`Salió de la finca: ${STATUS_LABEL[a.status]}`}
              text={exitEvent ? `${shortDate(exitEvent.date, today)} · ${exitEvent.notes ?? ""}` : undefined} />
          ) : null}
          {a.status === "activo" && (active.meat || active.milk) ? (
            <Banner icon="drop" tone="warn" title="En días de retiro"
              text={[active.milk && `Leche: no vender hasta el ${shortDate(w.milkUntil!, today)}`, active.meat && `Carne: no sacrificar ni vender para carne hasta el ${shortDate(w.meatUntil!, today)}`].filter(Boolean).join("\n")} />
          ) : null}

          <Rise index={1} style={s.facts}>
            {facts.map((f) => (
              <View key={f.k} style={s.fact}>
                <Txt size={12} color={colors.textMuted}>{f.k}</Txt>
                <Txt w="extrabold" size={f.v.length > 8 ? 16 : 19} style={{ lineHeight: 22 }} numberOfLines={1}>{f.v}</Txt>
                <Txt w="bold" size={11} color={f.good && f.k === "Peso" && weight.dailyGainKg !== undefined ? colors.link : colors.textMuted} numberOfLines={1}>{f.s}</Txt>
              </View>
            ))}
          </Rise>

          <Rise index={2} style={s.family}>
            <Txt w="semibold" size={12} color="#33691E" style={{ letterSpacing: 2.4, marginTop: 10, marginBottom: 2 }}>FAMILIA Y ORIGEN</Txt>
            {family.map((r, i) => {
              const body = (
                <View style={[s.famRow, i < family.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" }]}>
                  <Txt size={14} color={colors.textMuted}>{r.k}</Txt>
                  <Txt w="bold" size={14} color={r.href ? colors.link : colors.text} style={{ flexShrink: 1, textAlign: "right" }}>{r.v}</Txt>
                </View>
              );
              return r.href ? (
                <Tap key={r.k} accessibilityRole="link" accessibilityLabel={`${r.k}: ${r.v}`} onPress={() => router.push({ pathname: "/animal/[id]", params: { id: r.href! } })}>{body}</Tap>
              ) : <View key={r.k}>{body}</View>;
            })}
          </Rise>

          <Rise index={3} style={{ gap: 8 }}>
            <View style={s.sectionHead}>
              <Txt w="extrabold" size={20}>Cómo ha crecido</Txt>
              <Txt size={12} color={colors.textMuted}>{photos.length ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}` : "Una foto por año"}</Txt>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {years.map((y) => {
                const p = photos.find((x) => x.createdAt.startsWith(String(y)));
                const future = y > thisYear;
                const now = y === thisYear;
                const lbl = future ? "Próximo" : y === born ? (a.origin === "nacido" ? "Nació" : "Llegó") : now ? "Hoy" : p ? "" : "Sin foto";
                const canAdd = now && !p && editable;
                return (
                  <View key={y} style={{ flex: 1 }}>
                    <Tap accessibilityRole={p || canAdd ? "button" : "image"} accessibilityLabel={p ? `Foto de ${y}` : canAdd ? `Agregar foto de ${y}` : `Sin foto de ${y}`}
                      onPress={p ? () => setViewing(p) : canAdd ? () => takePhoto() : undefined} style={[s.year, p ? s.yearOn : s.yearOff, p && now ? { borderWidth: 3, borderColor: colors.lima } : null]}>
                      {p ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                      {p ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(27,94,32,0.35)" }]} /> : null}
                      {canAdd ? <Icon name="plus" color={colors.tierra} size={18} width={2.4} /> : null}
                      <Txt w="bold" size={10} color={p ? colors.onDark : colors.tierra}>{lbl}</Txt>
                      <Txt w="extrabold" size={13} color={p ? colors.onDark : colors.tierra}>{y}</Txt>
                    </Tap>
                  </View>
                );
              })}
            </View>
            {photos.length ? (
              <View style={s.gallery}>
                {photos.map((p) => (
                  <Tap key={p.id} accessibilityRole="button" accessibilityLabel={`Foto: ${p.note ?? shortDate(p.createdAt.slice(0, 10))}`} onPress={() => setViewing(p)} style={{ gap: 6, width: tileW }}>
                    <Image source={{ uri: p.uri }} style={[s.tile, { width: tileW }]} resizeMode="cover" />
                    <View>
                      <Txt w="extrabold" size={13} numberOfLines={1}>{p.note ?? "Foto"}</Txt>
                      <Txt size={12} color={colors.textMuted}>{shortDate(p.createdAt.slice(0, 10), today)}</Txt>
                    </View>
                  </Tap>
                ))}
              </View>
            ) : null}
            {editable ? <DashedButton label="Tomar foto" onPress={() => takePhoto()} /> : null}
          </Rise>

          <Rise index={4} style={{ gap: 10 }}>
            <View style={s.sectionHead}>
              <Txt w="extrabold" size={20}>Trazabilidad</Txt>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Legend color={colors.link} label="En la nube" />
                <Legend color="#A0A8A2" label="Solo en el celular" />
              </View>
            </View>
            <SegTabs<Tab> tabs={tabs} value={tab} onChange={setTab} />
            {tab === "hijos" ? (
              children.length ? (
                <Timeline>
                  {children.map((c) => (
                    <Tap key={c.id} accessibilityRole="link" accessibilityLabel={animalLabel(c)} onPress={() => router.push({ pathname: "/animal/[id]", params: { id: c.id } })}>
                      <TimeRow ring="#C2185B" title={`${animalLabel(c)}${c.name && c.tagVisual ? ` · #${c.tagVisual}` : ""}`} detail={c.sex === "hembra" ? "Hembra" : "Macho"} date={shortDate(c.birthDate, today)} />
                    </Tap>
                  ))}
                </Timeline>
              ) : <Empty title="Sin hijos registrados" text="Las crías que se registren con este padre aparecen aquí." />
            ) : rows.length ? (
              <Timeline>
                {rows.map((e) => <EventItem key={e.id} e={e} products={products} today={today} synced={cloud && !pending.has(e.id)} />)}
              </Timeline>
            ) : (
              <Empty title="Sin registros todavía" text={tab === "todo" ? "Las vacunas, pesajes y partos que anotes aparecen aquí." : "Nada de este tipo por ahora."} />
            )}
          </Rise>

          {editable ? (
            <Tap accessibilityRole="button" accessibilityLabel={`Dar de baja a ${label}`} onPress={() => router.push({ pathname: "/animal/baja", params: { id: a.id } })} style={s.exit}>
              <Txt w="bold" size={14} color={colors.danger}>{`Dar de baja a ${label} (murió, se vendió…)`}</Txt>
            </Tap>
          ) : null}
        </View>
      </ScrollView>

      {editable ? (
        <BottomBar>
          <BarGhost icon="scale" accessibilityLabel="Registrar pesaje" onPress={() => router.push({ pathname: "/evento/nuevo", params: { farmId: a.farmId, animalId: a.id, kind: "pesaje" } })} />
          {female ? <BarGhost icon="drop" accessibilityLabel="Registrar leche" onPress={() => router.push("/leche")} /> : null}
          <BarMain label="+ Registrar evento" accessibilityLabel="Registrar evento" onPress={() => router.push({ pathname: "/evento/nuevo", params: { farmId: a.farmId, animalId: a.id } })} />
        </BottomBar>
      ) : null}

      <QrModal open={qr} onClose={() => setQr(false)} animal={a} farmName={farm?.name} />
      <ShareSheet open={sharing} onClose={() => setSharing(false)} title={`Compartir a ${label}${a.name && a.tagVisual ? ` #${a.tagVisual}` : ""}`} onShare={share}
        onMoveFarm={editable && farms.some((f) => f.id !== a.farmId && f.isDemo === farm?.isDemo) ? () => { setSharing(false); router.push({ pathname: "/animal/baja", params: { id: a.id } }); } : undefined} />
      <Sheet open={!!viewing} onClose={() => setViewing(undefined)} title={viewing?.note ?? `Foto de ${label}`}>
        {viewing ? (
          <View style={{ gap: 12 }}>
            <Image source={{ uri: viewing.uri }} style={s.big} resizeMode="cover" accessibilityLabel={`Foto de ${label}`} />
            <Txt size={13} color={colors.textMuted}>{`Tomada el ${shortDate(viewing.createdAt.slice(0, 10))} · guardada solo en este celular`}</Txt>
            {editable ? (
              <Tap accessibilityRole="button" accessibilityLabel="Borrar foto" onPress={async () => { await deletePhoto(db, viewing.id); setViewing(undefined); reload(); }} style={s.del}>
                <Icon name="trash" color={colors.danger} size={18} />
                <Txt w="bold" size={15} color={colors.danger}>Borrar foto</Txt>
              </Tap>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Txt w="semibold" size={11} color={colors.textMuted}>{label}</Txt>
    </View>
  );
}

/** Dotted pasto line behind the timeline rings. */
function Timeline({ children }: { children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View pointerEvents="none" style={s.timeLine} />
      {children}
    </View>
  );
}

function TimeRow({ ring, title, detail, date, synced }: { ring: string; title: string; detail?: string; date: string; synced?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={[s.ring, { borderColor: ring }]} />
      <View style={s.timeCard}>
        <View style={{ flex: 1 }}>
          <Txt w="bold" size={15}>{title}</Txt>
          {detail ? <Txt size={13} color={colors.textMuted}>{detail}</Txt> : null}
        </View>
        <Txt w="bold" size={12} color={colors.textMuted}>{date}</Txt>
        {synced !== undefined ? (
          <View accessibilityLabel={synced ? "Sincronizado" : "Guardado solo en el celular"} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: synced ? colors.link : "#A0A8A2" }} />
        ) : null}
      </View>
    </View>
  );
}

function detailOf(e: AnimalEvent, products: Product[]): string {
  const product = products.find((p) => p.id === e.productId);
  return e.type === "pesaje" ? (e.weightMethod ? METHOD[e.weightMethod] : "") :
    e.type === "parto" ? (e.calfId ? "Cría registrada en la finca" : "Parto registrado") :
    e.type === "servicio" ? (e.notes ?? "").replace(/^monta: /, "Monta con ").replace(/^ia: /, "Inseminación · ") :
    e.type === "diagnostico" ? (e.notes === "preñada" ? "Preñada" : "Vacía") :
    e.type === "traslado" ? `Pasó a ${e.notes ?? "otro lote"}` :
    e.type === "reporte_ica" ? `${(e.notes ?? "").charAt(0).toUpperCase()}${(e.notes ?? "").slice(1)} registrado en SINIGAN` :
    [product?.name, e.dose].filter(Boolean).join(" · ") || e.notes || "";
}

function EventItem({ e, products, today, synced }: { e: AnimalEvent; products: Product[]; today: string; synced: boolean }) {
  const product = products.find((p) => p.id === e.productId);
  const title =
    e.type === "pesaje" ? `${e.weightMethod === "foto" ? "≈ " : ""}${num(e.weightKg ?? 0)} kg` :
    e.type === "vacuna" && product ? `Vacuna ${product.name}` :
    EVENT_LABEL[e.type];
  const detail = e.type === "vacuna" && product ? (e.dose ?? "") : detailOf(e, products);
  return <TimeRow ring={e.type === "pesaje" && e.weightMethod === "foto" ? "#F9A825" : RING[e.type]} title={title} detail={detail || undefined} date={shortDate(e.date, today)} synced={synced} />;
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.selva, overflow: "hidden", marginBottom: 0 },
  heroRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(174,213,129,0.18)", borderWidth: 2, borderStyle: "dashed", borderColor: colors.lima, alignItems: "center", justifyContent: "center" },
  heroTop: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  glass: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  edit: { height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.lima, flexDirection: "row", alignItems: "center", gap: 6 },
  status: { backgroundColor: colors.limaSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fact: { width: "31.8%", flexGrow: 1, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 10, gap: 2, ...shadow },
  family: { backgroundColor: colors.card, borderRadius: 22, paddingVertical: 6, paddingHorizontal: 16, ...shadow },
  famRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 11, minHeight: 44, alignItems: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  year: { height: 84, borderRadius: 16, alignItems: "center", justifyContent: "flex-end", gap: 1, paddingBottom: 8, overflow: "hidden" },
  yearOn: { backgroundColor: colors.selva },
  yearOff: { borderWidth: 1.5, borderColor: "#C9C2B3", justifyContent: "flex-end" },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  tile: { height: 150, borderRadius: 20, backgroundColor: colors.sand },
  timeLine: { position: "absolute", left: 9, top: 14, bottom: 14, width: 0, borderLeftWidth: 2, borderStyle: "dashed", borderColor: colors.pasto },
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 5, backgroundColor: colors.card, zIndex: 1 },
  timeCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.card, borderRadius: 18, ...shadow },
  exit: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  big: { width: "100%", height: 320, borderRadius: 20, backgroundColor: colors.sand },
  del: { height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.dangerSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
