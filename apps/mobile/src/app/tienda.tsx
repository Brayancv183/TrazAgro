import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, daysBetween, EXPIRY_WARN_DAYS, fonts, money, num, todayDay } from "@trazagro/shared";
import { listProducts } from "../db/repo";
import { useFarm } from "../lib/farm";
import { shareText } from "../lib/share";
import { useDbQuery } from "../lib/useDb";
import { Icon } from "../ui/Icon";
import { Chip, Sheet, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { CATALOG } from "../ui/cuenta/catalog";
import { CuentaHeader, SectionKicker, SoftCard, StatusCard } from "../ui/cuenta/parts";

type Item = (typeof CATALOG)[number];
type Cat = "todo" | "kits" | "aretes" | "gps" | "lectores" | "insumos";
const CATS: { id: Cat; label: string }[] = [
  { id: "todo", label: "Todo" }, { id: "kits", label: "Kits" }, { id: "aretes", label: "Aretes" },
  { id: "gps", label: "GPS" }, { id: "lectores", label: "Lectores" }, { id: "insumos", label: "Insumos" },
];
const CAT_OF: Record<string, Cat> = { rfid: "aretes", "kit-rfid": "kits", lector: "lectores", gps: "gps", gateway: "gps" };
/** Tile look per product (Tienda.dc tints). */
const TILE: Record<string, { bg: string; fg: string; badge?: string; unit: string; short: string }> = {
  rfid: { bg: colors.limaSoft, fg: colors.link, badge: "ICA", unit: "por par · norma ICA", short: "RFID" },
  "kit-rfid": { bg: colors.limaSoft, fg: colors.link, badge: "KIT", unit: "50 pares + registro", short: "KIT" },
  lector: { bg: colors.tierraSoft, fg: colors.tierra, unit: "Bluetooth", short: "LEC" },
  gps: { bg: colors.selva, fg: colors.lima, badge: "$0/MES", unit: "por unidad", short: "GPS" },
  gateway: { bg: colors.infoSoft, fg: colors.info, unit: "1 por finca", short: "GW" },
};

function ProductArt({ id, color }: { id: string; color: string }) {
  const tag = "M20 2a7 7 0 0 1 7 7v3h7a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4h7V9a7 7 0 0 1 7-7z";
  if (id === "gps") return (
    <Svg width={60} height={54} viewBox="0 0 52 46"><Path d={tag} fill={color} /><Circle cx={20} cy={9} r={2.6} fill="#FFFFFF" />
      <Path d="M43 12a12 12 0 0 1 0 16M47 7a19 19 0 0 1 0 26" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" /></Svg>
  );
  if (id === "gateway") return (
    <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 12v9M8 21h8M7.8 4.8a6 6 0 0 0 0 8.4M16.2 4.8a6 6 0 0 1 0 8.4M5 2a10 10 0 0 0 0 14M19 2a10 10 0 0 1 0 14" /><Circle cx={12} cy={9} r={2} /></Svg>
  );
  if (id === "lector") return (
    <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 2h4a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zM10 6h4" /><Circle cx={12} cy={15} r={2.5} /></Svg>
  );
  if (id === "insumo") return (
    <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" /></Svg>
  );
  return <Svg width={46} height={54} viewBox="0 0 40 46"><Path d={tag} fill={color} /><Circle cx={20} cy={9} r={2.6} fill="#FFFFFF" /></Svg>;
}

/**
 * Store (Tienda.dc + Carrito.dc + Pedido.dc): TrazAgro hardware plus a restock list from the farm's own inventory.
 * Online payment is not connected yet, so the order goes out as a message to the TrazAgro advisor.
 */
export default function TiendaScreen() {
  const router = useRouter();
  const { farm } = useFarm();
  const today = todayDay();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cat, setCat] = useState<Cat>("todo");
  const [q, setQ] = useState("");
  const [withRestock, setWithRestock] = useState(false);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<{ total: number; lines: number; shared: boolean }>();
  const { data: products } = useDbQuery(async (d) => (farm ? listProducts(d, farm.id) : []), [farm?.id]);
  const restock = (products ?? []).filter((p) => p.stock <= 5 || (p.expiresOn && daysBetween(today, p.expiresOn) <= EXPIRY_WARN_DAYS));
  const total = CATALOG.reduce((n, c) => n + (cart[c.id] ?? 0) * c.price, 0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0) + (withRestock ? restock.length : 0);
  const setQty = (id: string, n: number) => { setSent(undefined); setCart({ ...cart, [id]: Math.max(0, n) }); };

  const needle = q.trim().toLowerCase();
  const shown = CATALOG.filter((c) => (cat === "todo" || CAT_OF[c.id] === cat) && (!needle || `${c.name} ${c.detail}`.toLowerCase().includes(needle)));
  const kit = CATALOG.find((c) => c.id === "kit-rfid")!;
  const showRestock = restock.length > 0 && (cat === "todo" || cat === "insumos") && (!needle || restock.some((p) => p.name.toLowerCase().includes(needle)));

  async function order() {
    const lines = [
      `Pedido TrazAgro — ${farm?.name ?? ""}${farm ? ` (${farm.municipality}, ${farm.department})` : ""}`,
      ...CATALOG.filter((c) => cart[c.id]).map((c) => `· ${cart[c.id]} × ${c.name} = ${money(cart[c.id]! * c.price)}`),
      `Total aproximado: ${money(total)}`,
      ...(withRestock && restock.length ? ["", "Insumos por reponer:", ...restock.map((p) => `· ${p.name} (quedan ${num(p.stock)} ${p.unit})`)] : []),
    ];
    const r = await shareText("Pedido TrazAgro", lines.join("\n"), "Pedido_TrazAgro.txt");
    if (r !== "cancelled") setSent({ shared: r === "shared", total, lines: CATALOG.filter((c) => cart[c.id]).length + (withRestock ? restock.length : 0) });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.crema }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <CuentaHeader kicker="TIENDA TRAZAGRO" title="Equipa tu finca"
          right={
            <Tap accessibilityRole="button" accessibilityLabel={`Carrito, ${count} productos`} onPress={() => setOpen(true)} style={s.cartBtn}>
              <Icon name="store" color={colors.selva} size={20} width={2.2} />
              <Txt w="extrabold" size={14} color={colors.selva}>Carrito</Txt>
              <View style={s.cartCount}><Txt w="extrabold" size={12} color={colors.lima}>{String(count)}</Txt></View>
            </Tap>
          }>
          <View style={s.search}>
            <Icon name="search" color={colors.textMuted} size={20} />
            <TextInput value={q} onChangeText={setQ} placeholder="Aretes, GPS, lector…" placeholderTextColor="#9AA39D" accessibilityLabel="Buscar producto"
              style={[{ flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 15, color: colors.text, height: "100%" }, { outlineStyle: "none" } as never]} />
          </View>
        </CuentaHeader>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }} accessibilityLabel="Categorías">
          {CATS.map((c) => <Chip key={c.id} label={c.label} active={cat === c.id} onPress={() => setCat(c.id)} />)}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Rise index={0}>
            <View style={s.info}>
              <Icon name="card" color={colors.info} size={22} />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt w="extrabold" size={14} color="#0D3B66">Pago en línea: próximamente</Txt>
                <Txt size={12} color="#0D3B66">Arma tu pedido y envíalo: un asesor te confirma precio, envío y forma de pago.</Txt>
              </View>
            </View>
          </Rise>

          {sent ? <StatusCard icon="check" tone="ok" title="Pedido listo para enviar" detail="Un asesor de TrazAgro te contacta para confirmarlo." /> : null}

          {showRestock ? (
            <Rise index={1}>
              <SoftCard style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20 }}>
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt w="extrabold" size={14}>Por reponer en tu bodega</Txt>
                  <Txt size={12} color={colors.textMuted} numberOfLines={2}>{restock.map((p) => `${p.name}: quedan ${num(p.stock)} ${p.unit}`).join(" · ")}</Txt>
                </View>
                <Tap accessibilityRole="button" accessibilityLabel={withRestock ? "Quitar insumos del pedido" : "Agregar insumos al pedido"} onPress={() => { setSent(undefined); setWithRestock(!withRestock); }}
                  style={[s.smallBtn, withRestock && { backgroundColor: colors.limaSoft }]}>
                  <Txt w="bold" size={13} color={withRestock ? colors.selva : colors.onDark}>{withRestock ? "Agregado" : "Agregar"}</Txt>
                </Tap>
              </SoftCard>
            </Rise>
          ) : cat === "insumos" ? (
            <SoftCard style={{ alignItems: "center", gap: 4 }}>
              <Txt w="bold" size={16}>Tu bodega está al día</Txt>
              <Txt size={13} color={colors.textMuted} style={{ textAlign: "center" }}>Cuando un insumo se esté acabando o por vencer aparece aquí para cotizarlo.</Txt>
            </SoftCard>
          ) : null}

          {(cat === "todo" || cat === "kits") && !needle ? (
            <Rise index={2}>
              <Tap accessibilityRole="button" accessibilityLabel={`Agregar ${kit.name} al carrito`} onPress={() => setQty(kit.id, (cart[kit.id] ?? 0) + 1)} style={s.hero}>
                <Svg width={180} height={180} viewBox="0 0 160 160" style={{ position: "absolute", right: -40, top: -40 }} pointerEvents="none">
                  <Circle cx={80} cy={80} r={62} fill="none" stroke="rgba(174,213,129,0.35)" strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" />
                  <Circle cx={80} cy={18} r={6} fill={colors.lima} /><Circle cx={18} cy={80} r={6} fill={colors.lima} /><Circle cx={124} cy={124} r={6} fill={colors.lima} />
                </Svg>
                <View style={s.heroBadge}><Txt w="bold" size={11} color={colors.selva} style={{ letterSpacing: 1.8 }}>KIT PARA EMPEZAR</Txt></View>
                <Txt w="extrabold" size={24} color={colors.onDark} style={{ lineHeight: 27 }}>{kit.name}</Txt>
                <Txt size={14} color={colors.onDarkMuted} style={{ maxWidth: 250, lineHeight: 20 }}>{kit.detail}</Txt>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Txt w="extrabold" size={26} color={colors.onDark}>{money(kit.price)}</Txt>
                  <Txt size={13} color={colors.onDarkMuted}>{cart[kit.id] ? `${cart[kit.id]} en el carrito` : "toca para agregar"}</Txt>
                </View>
              </Tap>
            </Rise>
          ) : null}

          <View style={s.grid} accessibilityLabel="Productos">
            {shown.map((c, i) => (
              <Rise key={c.id} index={i + 3} style={{ width: "48.5%" }}>
                <ProductCard item={c} qty={cart[c.id] ?? 0} onAdd={() => setQty(c.id, (cart[c.id] ?? 0) + 1)} />
              </Rise>
            ))}
          </View>
          {!shown.length && cat !== "insumos" ? <Txt size={14} color={colors.textMuted} style={{ textAlign: "center", padding: 16 }}>No encontramos ese producto.</Txt> : null}
        </View>
      </ScrollView>

      <Sheet open={open} onClose={() => setOpen(false)} title={sent ? "" : "Tu pedido"}>
        {sent ? (
          <OrderSent total={sent.total} lines={sent.lines} shared={sent.shared} onHome={() => { setOpen(false); router.navigate("/"); }} onMore={() => { setOpen(false); setCart({}); setWithRestock(false); setSent(undefined); }} />
        ) : (
          <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ gap: 12 }}>
            <SectionKicker>{`ENTREGA EN ${farm?.name.toUpperCase() ?? "TU FINCA"}`}</SectionKicker>
            {count ? (
              <SoftCard style={{ paddingVertical: 4, paddingHorizontal: 14, borderWidth: 1, borderColor: "#EEF2E8", shadowOpacity: 0 }}>
                {CATALOG.filter((c) => cart[c.id]).map((c, i, arr) => (
                  <View key={c.id} style={[s.line, (i < arr.length - 1 || (withRestock && restock.length)) ? s.lineSep : null]}>
                    <View style={[s.lineIcon, { backgroundColor: TILE[c.id]!.bg }]}><Txt w="extrabold" size={11} color={TILE[c.id]!.fg}>{TILE[c.id]!.short}</Txt></View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt w="bold" size={15}>{c.name}</Txt>
                      <Txt size={13} color={colors.textMuted}>{`${cart[c.id]} × ${money(c.price)} = ${money(cart[c.id]! * c.price)}`}</Txt>
                    </View>
                    <View accessibilityLabel={`Cantidad de ${c.name}`} style={s.stepper}>
                      <Tap accessibilityRole="button" accessibilityLabel={`Quitar uno de ${c.name}`} onPress={() => setQty(c.id, cart[c.id]! - 1)} style={s.stepBtn}>
                        <Icon name="minus" color={colors.selva} size={16} width={2.6} />
                      </Tap>
                      <Txt w="extrabold" size={15} style={{ minWidth: 22, textAlign: "center" }}>{String(cart[c.id])}</Txt>
                      <Tap accessibilityRole="button" accessibilityLabel={`Agregar uno de ${c.name}`} onPress={() => setQty(c.id, cart[c.id]! + 1)} style={[s.stepBtn, { backgroundColor: colors.selva }]}>
                        <Icon name="plus" color="#FFFFFF" size={16} width={2.6} />
                      </Tap>
                    </View>
                  </View>
                ))}
                {withRestock ? restock.map((p, i) => (
                  <View key={p.id} style={[s.line, i < restock.length - 1 ? s.lineSep : null]}>
                    <View style={[s.lineIcon, { backgroundColor: colors.warnSoft }]}><Icon name="box" color={colors.warn} size={20} /></View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt w="bold" size={15}>{p.name}</Txt>
                      <Txt size={13} color={colors.textMuted}>{`Quedan ${num(p.stock)} ${p.unit} · se cotiza`}</Txt>
                    </View>
                  </View>
                )) : null}
              </SoftCard>
            ) : (
              <Txt size={14} color={colors.textMuted}>Tu carrito está vacío. Toca + en un producto para agregarlo.</Txt>
            )}

            <SectionKicker>CÓMO PAGAR</SectionKicker>
            <Pay on label="Con asesor TrazAgro" sub="Te confirma el precio; pagas al recibir o por transferencia" />
            <Pay label="PSE, Nequi o tarjeta" sub="Disponible en la fase 2" disabled />

            <View style={s.totalBox}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Txt w="bold" size={16}>Total aproximado</Txt>
                <Txt w="extrabold" size={26} style={{ letterSpacing: -0.3 }}>{money(total)}</Txt>
              </View>
              {withRestock && restock.length ? <Txt size={12} color={colors.textMuted}>Los insumos de tu bodega se cotizan aparte.</Txt> : null}
              <Tap accessibilityRole="button" accessibilityLabel={total ? `Enviar pedido · ${money(total)}` : "Enviar lista de compras"} disabled={!count} onPress={order} style={s.orderBtn}>
                <Icon name="send" color="#FFFFFF" size={18} />
                <Txt w="bold" size={16} color={colors.onDark}>{total ? "Enviar pedido por mensaje" : "Enviar lista de compras"}</Txt>
              </Tap>
              <Txt size={12} color={colors.textMuted} style={{ textAlign: "center" }}>No se cobra nada en la app: el pedido sale como mensaje para el asesor.</Txt>
            </View>
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

function ProductCard({ item, qty, onAdd }: { item: Item; qty: number; onAdd: () => void }) {
  const t = TILE[item.id]!;
  return (
    <View style={s.product}>
      <View style={[s.tile, { backgroundColor: t.bg }]}>
        <ProductArt id={item.id === "kit-rfid" ? "rfid" : item.id} color={t.fg} />
        {t.badge ? <View style={s.tileBadge}><Txt w="bold" size={10} color={colors.selva} style={{ letterSpacing: 0.8 }}>{t.badge}</Txt></View> : null}
        {qty ? <View style={s.qty}><Txt w="extrabold" size={12} color={colors.lima}>{`${qty} en carrito`}</Txt></View> : null}
      </View>
      <Txt w="bold" size={14} style={{ lineHeight: 17, minHeight: 35 }} numberOfLines={2}>{item.name}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Txt w="extrabold" size={16}>{money(item.price)}</Txt>
          <Txt size={11} color={colors.textMuted} numberOfLines={1}>{t.unit}</Txt>
        </View>
        <Tap accessibilityRole="button" accessibilityLabel={`Agregar ${item.name} al carrito`} onPress={onAdd} style={s.add}>
          <Icon name="plus" color={colors.lima} size={20} width={2.6} />
        </Tap>
      </View>
    </View>
  );
}

function Pay({ label, sub, on, disabled }: { label: string; sub: string; on?: boolean; disabled?: boolean }) {
  return (
    <View accessibilityRole="radio" accessibilityState={{ checked: !!on, disabled: !!disabled }} aria-checked={!!on} accessibilityLabel={label}
      style={[s.pay, on && { borderColor: colors.selva }, disabled && { opacity: 0.6 }]}>
      <View style={[s.radio, on && { borderColor: colors.selva }]}>{on ? <View style={s.dot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="bold" size={15}>{label}</Txt>
        <Txt size={12} color={colors.textMuted}>{sub}</Txt>
      </View>
    </View>
  );
}

/** Pedido.dc confirmation: orbit check, then the honest next steps (no tracking yet). */
function OrderSent({ total, lines, shared, onHome, onMore }: { total: number; lines: number; shared: boolean; onHome: () => void; onMore: () => void }) {
  const steps: [string, string, "done" | "now" | "next"][] = [
    ["Pedido armado", `${lines} ${lines === 1 ? "producto" : "productos"} · ${money(total)}`, "done"],
    [shared ? "Enviado al asesor" : "Archivo del pedido listo", shared ? "Lo compartiste desde tu celular" : "Se descargó: envíaselo al asesor", "now"],
    ["Confirmación", "El asesor te confirma precio, envío y pago", "next"],
    ["Entrega en tu finca", "Con instalación si lleva gateway", "next"],
  ];
  return (
    <View accessibilityRole="alert" style={{ alignItems: "center", gap: 12 }}>
      <Svg width={120} height={120} viewBox="0 0 160 160">
        <Circle cx={80} cy={80} r={62} fill={colors.limaSoft} />
        <Circle cx={80} cy={80} r={74} fill="none" stroke={colors.pasto} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" />
        <Circle cx={80} cy={6} r={6} fill={colors.link} /><Circle cx={6} cy={80} r={6} fill={colors.lima} /><Circle cx={132} cy={132} r={6} fill={colors.link} />
        <Path d="M54 82l18 18 36-38" fill="none" stroke={colors.selva} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Txt w="extrabold" size={26}>¡Pedido listo!</Txt>
      <View style={{ alignSelf: "stretch", paddingHorizontal: 4 }}>
        <View style={s.dash} />
        {steps.map(([t, d, st]) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 }}>
            <View style={[s.stepDot, st === "done" ? { backgroundColor: colors.selva, borderWidth: 0 } : st === "now" ? { backgroundColor: colors.lima, borderWidth: 5, borderColor: colors.limaSoft } : null]}>
              {st === "done" ? <Icon name="check" color="#FFFFFF" size={14} width={3} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Txt w={st === "now" ? "extrabold" : "semibold"} size={15} color={st === "next" ? "#8A918C" : colors.text}>{t}</Txt>
              <Txt size={12} color={colors.textMuted}>{d}</Txt>
            </View>
          </View>
        ))}
      </View>
      <View style={{ alignSelf: "stretch" }}>
        <Tap accessibilityRole="button" accessibilityLabel="Volver al inicio" onPress={onHome} style={s.orderBtn}>
          <Txt w="bold" size={16} color={colors.onDark}>Volver al inicio</Txt>
        </Tap>
      </View>
      <Tap accessibilityRole="button" accessibilityLabel="Hacer otro pedido" onPress={onMore} style={{ minHeight: 44, justifyContent: "center" }}>
        <Txt w="bold" size={15} color={colors.link}>Hacer otro pedido</Txt>
      </Tap>
    </View>
  );
}

const shadowSoft = { shadowColor: colors.selva, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 } as const;
const s = StyleSheet.create({
  cartBtn: { height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.lima, flexDirection: "row", alignItems: "center", gap: 8 },
  cartCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 50, paddingHorizontal: 18, backgroundColor: colors.card, borderRadius: 25, marginTop: 2 },
  info: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.infoSoft },
  smallBtn: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  hero: { overflow: "hidden", gap: 10, padding: 18, borderRadius: 26, backgroundColor: colors.selva },
  heroBadge: { alignSelf: "flex-start", backgroundColor: colors.lima, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  product: { backgroundColor: colors.card, borderRadius: 22, padding: 10, gap: 8, ...shadowSoft },
  tile: { height: 112, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tileBadge: { position: "absolute", left: 8, top: 8, backgroundColor: colors.card, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  qty: { position: "absolute", right: 8, bottom: 8, backgroundColor: colors.selva, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  add: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  lineSep: { borderBottomWidth: 1, borderBottomColor: "#EEF2E8" },
  lineIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.tint, borderRadius: 22, padding: 2 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  pay: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.outline },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.selva },
  totalBox: { gap: 10, paddingTop: 4 },
  orderBtn: { height: 56, borderRadius: 28, backgroundColor: colors.selva, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  dash: { position: "absolute", left: 18, top: 22, bottom: 22, width: 0, borderLeftWidth: 2, borderStyle: "dashed", borderColor: colors.pasto },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.outline, alignItems: "center", justifyContent: "center", zIndex: 1 },
});
