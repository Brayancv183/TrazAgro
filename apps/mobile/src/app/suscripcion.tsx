import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, money } from "@trazagro/shared";
import { useFarm } from "../lib/farm";
import { shareText } from "../lib/share";
import { Icon } from "../ui/Icon";
import { Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { CuentaHeader, StatusCard } from "../ui/cuenta/parts";
import { CATALOG } from "../ui/cuenta/catalog";

const PLANS = [
  { id: "esencial", name: "Esencial", month: 49000, from: false, desc: "Hasta 50 animales · fichas, salud y alertas · reportes ICA · lector RFID" },
  { id: "pro", name: "Pro", month: 149000, from: false, desc: "Todo lo Esencial + animales ilimitados · GPS LoRa, mapa y geocerca · equipo con roles" },
  { id: "gremio", name: "Gremio / Multi-finca", month: 299000, from: true, desc: "Varias fincas y métricas agregadas · acompañamiento del gremio" },
];

/** Plans (Suscripcion.dc). During the pilot everything is free; payments (PSE, Nequi) are connected in phase 2. */
export default function SuscripcionScreen() {
  const router = useRouter();
  const { farm } = useFarm();
  const [yearly, setYearly] = useState(false);
  const [asked, setAsked] = useState<string>();
  const price = (m: number) => money(yearly ? m * 10 : m);
  const per = yearly ? "/ año" : "/ mes";

  async function want(plan: (typeof PLANS)[number]) {
    const text = `Hola, quiero el plan ${plan.name} (${plan.from ? "desde " : ""}${price(plan.month)} ${per}) de TrazAgro para ${farm?.name ?? "mi finca"}.`;
    const r = await shareText("Plan TrazAgro", text);
    if (r !== "cancelled") setAsked(plan.name);
  }

  const rfid = CATALOG.find((c) => c.id === "kit-rfid")!;
  const gps = CATALOG.find((c) => c.id === "gps")!;

  return (
    <ScrollView style={{ backgroundColor: colors.crema }} contentContainerStyle={{ paddingBottom: 40 }}>
      <CuentaHeader>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <Txt w="extrabold" size={31} color={colors.onDark} style={{ letterSpacing: -0.6, lineHeight: 33 }}>Tu plan</Txt>
          <View accessibilityRole="radiogroup" accessibilityLabel="Forma de pago" style={s.seg}>
            {[["Mensual", false], ["Anual −2 meses", true]].map(([label, y]) => (
              <Tap key={String(label)} accessibilityRole="radio" accessibilityLabel={String(label)} accessibilityState={{ checked: yearly === y }} aria-checked={yearly === y}
                onPress={() => setYearly(y as boolean)} style={[s.segBtn, yearly === y && { backgroundColor: colors.selva }]}>
                <Txt w="bold" size={12} color={yearly === y ? colors.onDark : colors.textMuted}>{String(label)}</Txt>
              </Tap>
            ))}
          </View>
        </View>
      </CuentaHeader>

      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
        <Rise index={0}>
          <View style={[s.card, s.current]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Txt w="extrabold" size={18} color={colors.onDark}>Piloto gratis</Txt>
              <View style={s.badge}><Txt w="extrabold" size={11} color={colors.selva}>Tu plan actual</Txt></View>
            </View>
            <Txt w="extrabold" size={24} color={colors.onDark} style={{ letterSpacing: -0.5 }}>$0 <Txt w="bold" size={14} color={colors.onDarkMuted}>mientras dura el piloto</Txt></Txt>
            <Txt size={13} color="#DDE7DE" style={{ lineHeight: 19 }}>Usas todo sin pagar. Cuando termine el piloto eliges uno de estos planes.</Txt>
          </View>
        </Rise>

        {asked ? <StatusCard icon="check" tone="ok" title={`Solicitud del plan ${asked} lista para enviar`} detail="Un asesor te contacta para activarlo." /> : null}

        {PLANS.map((p, i) => (
          <Rise key={p.id} index={i + 1}>
            <View style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Txt w="extrabold" size={18} style={{ flex: 1 }}>{p.name}</Txt>
                {p.id === "pro" ? <View style={[s.badge, { backgroundColor: colors.limaSoft }]}><Txt w="extrabold" size={11} color={colors.selva}>Recomendado</Txt></View> : null}
              </View>
              <Txt w="extrabold" size={24} style={{ letterSpacing: -0.5 }}>
                {`${p.from ? "Desde " : ""}${price(p.month)}${p.from ? "+" : ""} `}<Txt w="bold" size={14} color={colors.textMuted}>{per}</Txt>
              </Txt>
              <Txt size={13} color={colors.textMuted} style={{ lineHeight: 19 }}>{p.desc}</Txt>
              <Tap accessibilityRole="button" accessibilityLabel={`Lo quiero: ${p.name}`} onPress={() => want(p)} style={[s.want, p.id === "pro" && { backgroundColor: colors.selva }]}>
                <Txt w="bold" size={14} color={p.id === "pro" ? colors.onDark : colors.selva}>Lo quiero</Txt>
              </Tap>
            </View>
          </Rise>
        ))}

        <Rise index={5}>
          <Tap accessibilityRole="link" accessibilityLabel="Aretes y GPS para tu finca" onPress={() => router.push("/tienda")} style={s.shop}>
            <View style={s.shopIcon}><Icon name="tag" color="#FFFFFF" size={22} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="extrabold" size={15} color={colors.tierraDeep}>Aretes y GPS para tu finca</Txt>
              <Txt size={13} color={colors.tierraDeep}>{`Kit RFID ${money(rfid.price)} · Orejera GPS ${money(gps.price)}`}</Txt>
            </View>
            <Icon name="chevron" color={colors.tierraDeep} size={18} width={2.4} />
          </Tap>
        </Rise>
        <Txt size={12} color={colors.textMuted} style={{ textAlign: "center" }}>Durante el piloto no se cobra nada · Pago con PSE y Nequi llega en la fase 2</Txt>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: "row", gap: 4, padding: 4, backgroundColor: colors.card, borderRadius: 999, borderWidth: 1, borderColor: colors.outline },
  segBtn: { height: 36, paddingHorizontal: 10, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 24, padding: 16, gap: 6, backgroundColor: colors.card, shadowColor: colors.selva, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  current: { backgroundColor: colors.selva, shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  badge: { backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  want: { marginTop: 4, height: 44, borderRadius: 22, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  shop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: colors.tierraSoft, borderRadius: 20 },
  shopIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tierra, alignItems: "center", justifyContent: "center" },
});
