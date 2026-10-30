import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, daysBetween, EXPIRY_WARN_DAYS, money, num, radius, shadow, todayDay } from "@trazagro/shared";
import { listProducts } from "../db/repo";
import { useFarm } from "../lib/farm";
import { shareText } from "../lib/share";
import { useDbQuery } from "../lib/useDb";
import { Banner, Button, Card, Chip, GreenHeader, Txt } from "../ui/kit";

/** TrazAgro hardware catalog (prices from the business plan, COP). */
const CATALOG = [
  { id: "rfid", name: "Par de aretes RFID DIN", detail: "134,2 kHz · Res. ICA 219/2026", price: 14000 },
  { id: "kit-rfid", name: "Kit finca RFID", detail: "50 pares RFID + registro en la app", price: 950000 },
  { id: "lector", name: "Lector RFID Bluetooth", detail: "Lee el arete y lo escribe en la app", price: 249000 },
  { id: "gps", name: "Orejera GPS LoRa", detail: "Ubicación del animal, $0 al mes", price: 250000 },
  { id: "gateway", name: "Gateway LoRa + instalación", detail: "Uno por finca, usa el internet de la casa", price: 1300000 },
];

/**
 * Store: TrazAgro hardware plus a restock list from the farm's own inventory. Online payment (Wompi)
 * is not connected yet, so the order goes out as a message to the TrazAgro advisor.
 */
export default function TiendaScreen() {
  const { farm } = useFarm();
  const today = todayDay();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const { data: products } = useDbQuery(async (d) => (farm ? listProducts(d, farm.id) : []), [farm?.id]);
  const restock = (products ?? []).filter((p) => p.stock <= 5 || (p.expiresOn && daysBetween(today, p.expiresOn) <= EXPIRY_WARN_DAYS));
  const total = CATALOG.reduce((n, c) => n + (cart[c.id] ?? 0) * c.price, 0);

  async function order() {
    const lines = [
      `Pedido TrazAgro — ${farm?.name ?? ""}${farm ? ` (${farm.municipality}, ${farm.department})` : ""}`,
      ...CATALOG.filter((c) => cart[c.id]).map((c) => `· ${cart[c.id]} × ${c.name} = ${money(cart[c.id]! * c.price)}`),
      `Total aproximado: ${money(total)}`,
      ...(restock.length ? ["", "Insumos por reponer:", ...restock.map((p) => `· ${p.name} (quedan ${num(p.stock)} ${p.unit})`)] : []),
    ];
    const r = await shareText("Pedido TrazAgro", lines.join("\n"), "Pedido_TrazAgro.txt");
    if (r !== "cancelled") setSent(true);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker="SERVICIOS" title="Tienda">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>Aretes, lectores y GPS para tu finca.</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <Banner icon="note" tone="warn" title="Pago en línea: próximamente" text="Arma tu pedido y envíalo: un asesor te confirma precio, envío y forma de pago." />
        {sent ? <Banner icon="check" tone="ok" title="Pedido listo para enviar" /> : null}
        {CATALOG.map((c) => (
          <View key={c.id} style={s.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="bold" size={16}>{c.name}</Txt>
              <Txt size={13} color={colors.textMuted}>{c.detail}</Txt>
              <Txt w="extrabold" size={15} color={colors.selva}>{money(c.price)}</Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Chip label="−" onPress={() => setCart({ ...cart, [c.id]: Math.max(0, (cart[c.id] ?? 0) - 1) })} />
              <Txt w="bold" size={16} style={{ minWidth: 22, textAlign: "center" }}>{cart[c.id] ?? 0}</Txt>
              <Chip label="+" onPress={() => { setSent(false); setCart({ ...cart, [c.id]: (cart[c.id] ?? 0) + 1 }); }} />
            </View>
          </View>
        ))}
        {restock.length ? (
          <Card style={{ gap: 6 }}>
            <Txt w="semibold" size={11} color={colors.hoja} style={{ letterSpacing: 2.2 }}>POR REPONER EN TU BODEGA</Txt>
            {restock.map((p) => <Txt key={p.id} size={14}>{`· ${p.name}: quedan ${num(p.stock)} ${p.unit}`}</Txt>)}
            <Txt size={12} color={colors.textMuted}>Se agregan al pedido para cotizarlos en el almacén agropecuario.</Txt>
          </Card>
        ) : null}
        <Button icon="share" label={total ? `Enviar pedido · ${money(total)}` : restock.length ? "Enviar lista de compras" : "Elige productos"} disabled={!total && !restock.length} onPress={order} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, ...shadow },
});
