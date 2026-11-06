import { useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { colors, fonts, money, num, plural } from "@trazagro/shared";
import { listAnimals, listLots } from "../db/repo";
import { useFarm } from "../lib/farm";
import { shareText } from "../lib/share";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { StatusCard } from "../ui/cuenta/parts";
import { CATALOG } from "../ui/cuenta/catalog";

type Mode = "lotes" | "gps" | "drones";
/** Lot fills / strokes from Mapa.dc (green, blue, earth). */
const TONES = [
  { fill: "#BFD9AE", stroke: colors.link, text: colors.selva },
  { fill: "#C9DFF2", stroke: "#1976D2", text: colors.info },
  { fill: "#E4D6CC", stroke: colors.tierra, text: colors.tierraDeep },
];
const JITTER = [[0, 8, -6, 0], [6, 0, 0, -8], [-4, -6, 8, 4], [4, 4, -4, 6]];

/**
 * Map, GPS and drones (Mapa.dc + Drones.dc). There is no GPS data yet: the map is a schematic of the farm's lots
 * (not to scale) with their animal counts; GPS shows the honest "kit GPS" state and drones are a request to an advisor.
 */
export default function MapaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { farm } = useFarm();
  const [mode, setMode] = useState<Mode>("lotes");
  const [sel, setSel] = useState<string>();
  const [asked, setAsked] = useState(false);
  const { data } = useDbQuery(async (d) => (farm ? { lots: await listLots(d, farm.id), animals: await listAnimals(d, farm.id) } : null), [farm?.id]);
  const lots = data?.lots ?? [];
  const count = (id: string) => data?.animals.filter((a) => a.lotId === id).length ?? 0;
  const loose = data?.animals.filter((a) => !a.lotId).length ?? 0;
  const { width } = useWindowDimensions();
  const k = width / 390;
  const top = insets.top / k + 150;
  const rows = Math.max(1, Math.ceil(lots.length / 2));
  const mapH = top + rows * 158 + 60;
  const farmLine = farm ? `${farm.name}${farm.hectares ? ` · ${num(farm.hectares)} ha` : ""}` : "";

  async function askFlight() {
    const text = [`Hola, quiero agendar un vuelo de dron en ${farm?.name ?? "mi finca"}${farm ? ` (${farm.municipality}, ${farm.department})` : ""}.`,
      "Servicio: conteo de animales y estado del pasto.", lots.length ? `Lotes: ${lots.map((l) => l.name).join(", ")}.` : ""].filter(Boolean).join("\n");
    const r = await shareText("Vuelo de dron TrazAgro", text);
    if (r !== "cancelled") setAsked(true);
  }

  const gpsKit = CATALOG.filter((c) => c.group === "gps");

  return (
    <View style={{ flex: 1, backgroundColor: "#DCE8D2" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <View style={{ height: mapH * k }}>
          <Svg width={390 * k} height={mapH * k} viewBox={`0 0 390 ${mapH}`} style={StyleSheet.absoluteFill}
            accessibilityLabel={`Esquema de ${plural(lots.length, "lote", "lotes")} de la finca`}>
            <Path d={`M0 ${mapH - 40} C80 ${mapH - 60} 140 ${mapH - 10} 220 ${mapH - 30} S350 ${mapH - 70} 390 ${mapH - 50}`} fill="none" stroke="#9CC3E6" strokeWidth={14} strokeLinecap="round" />
            {lots.map((l, i) => {
              const col = i % 2, row = Math.floor(i / 2);
              const x = 22 + col * 180, y = top + row * 158, w = 166, h = 136;
              const j = JITTER[i % JITTER.length]!;
              const t = TONES[i % TONES.length]!;
              const on = sel === l.id;
              const d = `M${x + j[0]!} ${y + j[1]!} L${x + w + j[2]!} ${y + 6} L${x + w - 6} ${y + h + j[3]!} L${x + 4} ${y + h - 4} Z`;
              return (
                <Path key={l.id} d={d} fill={t.fill} stroke={t.stroke} strokeWidth={on ? 3.5 : 2.5} strokeDasharray={on ? "10 7" : undefined} strokeLinejoin="round" />
              );
            })}
            {lots.map((l, i) => {
              const col = i % 2, row = Math.floor(i / 2);
              const x = 22 + col * 180, y = top + row * 158;
              const t = TONES[i % TONES.length]!;
              return [
                <SvgText key={`${l.id}-n`} x={x + 83} y={y + 66} fontSize={15} fontWeight="800" fill={t.text} textAnchor="middle" fontFamily={fonts.extrabold}>{l.name.length > 18 ? `${l.name.slice(0, 17)}…` : l.name}</SvgText>,
                <SvgText key={`${l.id}-c`} x={x + 83} y={y + 86} fontSize={12} fontWeight="700" fill={t.text} textAnchor="middle" fontFamily={fonts.bold}>{plural(count(l.id), "animal", "animales")}</SvgText>,
              ];
            })}
          </Svg>
          {lots.map((l, i) => (
            <Tap key={l.id} accessibilityRole="button" accessibilityLabel={`Ver ${l.name}`} onPress={() => { setSel(l.id); setMode("lotes"); }}
              style={{ position: "absolute", left: (22 + (i % 2) * 180) * k, top: (top + Math.floor(i / 2) * 158) * k, width: 166 * k, height: 136 * k }}>
              <View />
            </Tap>
          ))}
          {!lots.length && data ? (
            <View style={{ position: "absolute", top: top * k + 20, left: 24, right: 24, alignItems: "center", gap: 4 }}>
              <Txt w="bold" size={17}>Todavía no hay lotes</Txt>
              <Txt size={14} color={colors.textMuted} style={{ textAlign: "center" }}>Crea tus potreros en Lotes para verlos en el esquema.</Txt>
            </View>
          ) : null}

          <View style={[s.float, { top: insets.top + 16 }]}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Tap accessibilityRole="button" accessibilityLabel="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.round}>
                <Icon name="back" color={colors.text} size={22} width={2.2} />
              </Tap>
              <View style={s.status}>
                <View style={[s.dotLive, { backgroundColor: "#A0A8A2" }]} />
                <Txt w="bold" size={13} numberOfLines={1} style={{ flex: 1 }}>{`Sin GPS · ${farmLine}`}</Txt>
              </View>
            </View>
            <View accessibilityRole="tablist" accessibilityLabel="Capas del mapa" style={{ flexDirection: "row", gap: 8 }}>
              {([["lotes", "Potreros"], ["gps", "Animales GPS"], ["drones", "Drones"]] as [Mode, string][]).map(([m, label]) => (
                <Tap key={m} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: mode === m }} aria-selected={mode === m}
                  onPress={() => setMode(m)} style={[s.layer, mode === m && { backgroundColor: colors.text }]}>
                  <Txt w="bold" size={13} color={mode === m ? colors.onDark : colors.text}>{label}</Txt>
                </Tap>
              ))}
            </View>
            <View style={{ flexDirection: "row" }}>
              <View style={s.note}><Txt w="semibold" size={11} color={colors.textMuted}>Esquema de tus lotes · no está a escala</Txt></View>
            </View>
          </View>
        </View>

        <View style={[s.panel, { marginTop: -56 }]}>
          <View style={s.grip} />
          {mode === "lotes" ? (
            <Rise key="lotes" style={{ gap: 10 }}>
              <Txt w="extrabold" size={16}>{farmLine}</Txt>
              <Txt size={13} color={colors.textMuted}>{`${plural(lots.length, "lote", "lotes")} · ${plural(data?.animals.length ?? 0, "animal", "animales")}${loose ? ` · ${loose} sin lote` : ""}`}</Txt>
              <View>
                {lots.map((l, i) => {
                  const t = TONES[i % TONES.length]!;
                  const on = sel === l.id;
                  return (
                    <Tap key={l.id} accessibilityRole="button" accessibilityLabel={l.name} accessibilityState={{ selected: on }} onPress={() => setSel(on ? undefined : l.id)}
                      style={[s.lotRow, i < lots.length - 1 && s.sep, on && { backgroundColor: colors.tint }]}>
                      <View style={[s.swatch, { backgroundColor: t.fill, borderColor: t.stroke }]} />
                      <View style={{ flex: 1 }}>
                        <Txt w="bold" size={15}>{[l.name, l.purpose].filter(Boolean).join(" · ")}</Txt>
                      </View>
                      <Txt w="semibold" size={13} color={colors.textMuted}>{plural(count(l.id), "animal", "animales")}</Txt>
                    </Tap>
                  );
                })}
              </View>
              <Tap accessibilityRole="button" accessibilityLabel="Ordenar lotes y potreros" onPress={() => router.push("/lotes")} style={[s.btn, { backgroundColor: colors.sand }]}>
                <Txt w="extrabold" size={14}>Ordenar lotes y potreros</Txt>
              </Tap>
            </Rise>
          ) : mode === "gps" ? (
            <Rise key="gps" style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.bigIcon, { backgroundColor: colors.infoSoft }]}><Icon name="gps" color={colors.info} size={22} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="extrabold" size={16}>El rastreo GPS llega con el kit de collares</Txt>
                  <Txt size={13} color={colors.textMuted}>Ninguna orejera GPS conectada en esta finca</Txt>
                </View>
              </View>
              <View style={s.state}>
                <View style={[s.dotLive, { backgroundColor: "#A0A8A2" }]} />
                <Txt size={13} color={colors.textMuted} style={{ flex: 1 }}>Con las orejeras GPS LoRa y un gateway en la casa verás cada animal en el mapa y te avisamos si sale del potrero. Sin plan de datos mensual.</Txt>
              </View>
              <Txt size={13} color={colors.textMuted}>{gpsKit.map((c) => `${c.name}: ${money(c.price)}`).join(" · ")}</Txt>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Tap accessibilityRole="button" accessibilityLabel="Ver lotes" onPress={() => setMode("lotes")} style={[s.btn, { backgroundColor: colors.sand }]}>
                    <Txt w="extrabold" size={14}>Ver lotes</Txt>
                  </Tap>
                </View>
                <View style={{ flex: 1 }}>
                  <Tap accessibilityRole="button" accessibilityLabel="Cotizar kit GPS" onPress={() => router.push("/tienda")} style={[s.btn, { backgroundColor: colors.selva }]}>
                    <Txt w="extrabold" size={14} color={colors.onDark}>Cotizar kit GPS</Txt>
                  </Tap>
                </View>
              </View>
            </Rise>
          ) : (
            <Rise key="drones" style={{ gap: 12 }}>
              <View style={s.drone}>
                <View style={{ position: "absolute", right: -24, top: -20, opacity: 0.08 }} pointerEvents="none"><Icon name="drone" color="#FFFFFF" size={140} width={1.2} /></View>
                <Txt w="extrabold" size={12} color="#A5D6A7" style={{ letterSpacing: 0.8 }}>SERVICIO ALIADO · DRONES</Txt>
                <View style={{ gap: 4 }}>
                  <Txt w="extrabold" size={22} color={colors.onDark}>Vuelo con dron</Txt>
                  <Txt size={14} color="#DDE7DE">{`Conteo de animales + estado del pasto${lots.length ? ` · ${lots.slice(0, 3).map((l) => l.name).join(", ")}${lots.length > 3 ? "…" : ""}` : ""}`}</Txt>
                </View>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <View style={s.glass}><Txt w="extrabold" size={12} color={colors.onDark}>Se agenda con un asesor</Txt></View>
                  <View style={[s.glass, { backgroundColor: asked ? "#A5D6A7" : colors.glass }]}>
                    <Txt w="extrabold" size={12} color={asked ? "#0F3D14" : colors.onDark}>{asked ? "Solicitud enviada" : "Sin vuelos agendados"}</Txt>
                  </View>
                </View>
              </View>
              {asked ? <StatusCard icon="check" tone="ok" title="Solicitud lista" detail="El asesor te confirma la fecha del vuelo." /> : null}
              <Tap accessibilityRole="button" accessibilityLabel="Solicitar un vuelo" onPress={askFlight} style={[s.btn, { height: 56, borderRadius: 28, backgroundColor: colors.selva, flexDirection: "row", gap: 8 }]}>
                <Icon name="plus" color="#FFFFFF" size={20} width={2.4} />
                <Txt w="extrabold" size={15} color={colors.onDark}>Solicitar un vuelo</Txt>
              </Tap>
              <Txt w="extrabold" size={17}>Resultados entregados</Txt>
              <Txt size={13} color={colors.textMuted}>Aquí aparecerán el mapa de pasto, el conteo y el informe de cada vuelo.</Txt>
            </Rise>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const float = { shadowColor: "#1F2A1F", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 5 } as const;
const s = StyleSheet.create({
  float: { position: "absolute", left: 16, right: 16, gap: 10 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", ...float },
  status: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, ...float },
  dotLive: { width: 8, height: 8, borderRadius: 4 },
  layer: { height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", ...float, shadowOpacity: 0.12, shadowRadius: 12 },
  note: { backgroundColor: "rgba(255,255,255,0.75)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  panel: { marginHorizontal: 12, backgroundColor: colors.card, borderRadius: 26, padding: 16, gap: 12, shadowColor: "#142818", shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
  grip: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.grip, marginTop: -6 },
  lotRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 6, borderRadius: 12 },
  sep: { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" },
  swatch: { width: 18, height: 18, borderRadius: 5, borderWidth: 2 },
  btn: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  bigIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  state: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.crema },
  drone: { backgroundColor: colors.text, borderRadius: 26, padding: 18, gap: 14, overflow: "hidden" },
  glass: { backgroundColor: colors.glass, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
