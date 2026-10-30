import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, shadow } from "@trazagro/shared";
import { useFarm } from "../lib/farm";
import { shareText } from "../lib/share";
import { Banner, Button, Chip, GreenHeader, Txt } from "../ui/kit";

const PLANS = [
  { id: "esencial", name: "Esencial", price: "$49.000 / mes", items: ["Hasta 50 animales", "Fichas, salud y alertas", "Reportes ICA", "Lector RFID"] },
  { id: "pro", name: "Pro", price: "$149.000 / mes", items: ["Todo lo de Esencial", "Animales ilimitados", "GPS LoRa, mapa y geocerca", "Equipo con roles"] },
  { id: "gremio", name: "Gremio", price: "Desde $299.000 / mes", items: ["Varias fincas", "Métricas agregadas", "Acompañamiento del gremio"] },
];

/** Plans. During the pilot everything is free; payments (Wompi, PSE, Nequi) are connected in phase 2. */
export default function SuscripcionScreen() {
  const { farm } = useFarm();
  const [asked, setAsked] = useState<string>();

  async function want(plan: (typeof PLANS)[number]) {
    const r = await shareText("Plan TrazAgro", `Hola, quiero el plan ${plan.name} (${plan.price}) de TrazAgro para ${farm?.name ?? "mi finca"}.`);
    if (r !== "cancelled") setAsked(plan.name);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker="TU PLAN" title="Piloto gratis">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>Mientras dura el piloto usas todo sin pagar.</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Banner icon="money" tone="warn" title="Pagos en línea: próximamente" text="Cuando termine el piloto podrás pagar con PSE, Nequi o tarjeta. Por ahora un asesor te contacta." />
        {asked ? <Banner icon="check" tone="ok" title={`Solicitud del plan ${asked} lista para enviar`} /> : null}
        {PLANS.map((p) => (
          <View key={p.id} style={[s.card, p.id === "pro" && { borderColor: colors.lima }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Txt w="extrabold" size={22} style={{ flex: 1 }}>{p.name}</Txt>
              {p.id === "pro" ? <Chip label="Recomendado" tone={{ bg: colors.lima, fg: colors.selva }} /> : null}
            </View>
            <Txt w="bold" size={17} color={colors.selva}>{p.price}</Txt>
            {p.items.map((i) => <Txt key={i} size={14} color={colors.textMuted}>{`✓ ${i}`}</Txt>)}
            <Button kind={p.id === "pro" ? "primary" : "soft"} label="Lo quiero" onPress={() => want(p)} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 6, borderWidth: 2, borderColor: "transparent", ...shadow },
});
