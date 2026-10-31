import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors, daysBetween, EXPIRY_WARN_DAYS, money, num, radius, shadow, shortDate, todayDay, type Product, type ProductKind } from "@trazagro/shared";
import { adjustStock, listProducts, saveProduct } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { DateField, splitDay, toDay, type DayParts } from "../ui/DateField";
import { Icon, type IconName } from "../ui/Icon";
import { Banner, Button, Chip, Empty, Field, GreenHeader, Sheet, Txt } from "../ui/kit";

const KIND: Record<ProductKind, { label: string; icon: IconName }> = {
  vacuna: { label: "Vacunas", icon: "syringe" },
  medicina: { label: "Medicinas", icon: "drop" },
  insumo: { label: "Insumos", icon: "box" },
  herramienta: { label: "Herramientas", icon: "gear" },
};

const decimal = (t: string) => Number(t.replace(",", ".")) || 0;

/** Farm stock of vaccines, drugs, feed and tools. Uses on animals are subtracted automatically. */
export default function InventarioScreen() {
  const db = useSQLiteContext();
  const farmId = useFarmId();
  const canEdit = useFarm().can("products");
  const today = todayDay();
  const [filter, setFilter] = useState<ProductKind | "todos">("todos");
  const [editing, setEditing] = useState<Partial<Product>>();
  const [buying, setBuying] = useState<Product>();
  const [discarding, setDiscarding] = useState<Product>();
  const { data, reload } = useDbQuery((d) => listProducts(d, farmId), [farmId]);
  const products = (data ?? []).filter((p) => filter === "todos" || p.kind === filter);

  const status = (p: Product) =>
    p.expiresOn && p.expiresOn < today ? { text: "Vencido", bg: colors.dangerSoft, fg: colors.danger }
    : p.stock <= 0 ? { text: "Agotado", bg: colors.dangerSoft, fg: colors.danger }
    : p.expiresOn && daysBetween(today, p.expiresOn) <= EXPIRY_WARN_DAYS ? { text: `Vence ${shortDate(p.expiresOn, today)}`, bg: colors.warnSoft, fg: colors.warn }
    : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker="FINCA" title="Inventario">
          <Txt w="medium" size={15} color={colors.onDarkMuted}>Lo que aplicas a un animal se descuenta solo.</Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Todos" active={filter === "todos"} onPress={() => setFilter("todos")} />
            {(Object.keys(KIND) as ProductKind[]).map((k) => <Chip key={k} label={KIND[k].label} active={filter === k} onPress={() => setFilter(k)} />)}
          </View>
          {data && !products.length ? <Empty title="Nada por aquí" text="Agrega lo que tienes en la bodega para saber cuándo comprar." /> : null}
          {products.map((p) => {
            const st = status(p);
            return (
              <View key={p.id} style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={s.icon}><Icon name={KIND[p.kind].icon} color={colors.selva} size={20} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt w="bold" size={16}>{p.name}</Txt>
                    <Txt size={13} color={colors.textMuted}>
                      {[p.withdrawalMilkDays || p.withdrawalMeatDays ? `Retiro: leche ${p.withdrawalMilkDays} d · carne ${p.withdrawalMeatDays} d` : "Sin retiro", p.expiresOn ? `vence ${shortDate(p.expiresOn, today)}` : ""].filter(Boolean).join(" · ")}
                    </Txt>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Txt w="extrabold" size={20} color={p.stock <= 0 ? colors.danger : colors.text}>{num(p.stock)}</Txt>
                    <Txt size={12} color={colors.textMuted}>{p.unit}</Txt>
                  </View>
                </View>
                {st ? <View style={[s.status, { backgroundColor: st.bg }]}><Txt w="bold" size={12} color={st.fg}>{st.text}</Txt></View> : null}
                {canEdit ? <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Comprar ${p.name}`} onPress={() => setBuying(p)} style={s.action}><Txt w="bold" size={14} color={colors.selva}>+ Compré</Txt></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Descartar ${p.name}`} onPress={() => setDiscarding(p)} style={s.action}><Txt w="bold" size={14} color={colors.selva}>− Descartar</Txt></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${p.name}`} onPress={() => setEditing(p)} style={s.action}><Txt w="bold" size={14} color={colors.selva}>Editar</Txt></Pressable>
                </View> : null}
              </View>
            );
          })}
          {canEdit ? <Button icon="plus" label="Agregar producto" onPress={() => setEditing({ kind: filter === "todos" ? "medicina" : filter })} /> : null}
        </View>
      </ScrollView>

      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.id ? "Editar producto" : "Nuevo producto"}>
        {editing ? (
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            <ProductForm product={editing} onSave={async (input, stock, price) => {
              await saveProduct(db, { ...input, id: editing.id, farmId }, stock, price, today);
              setEditing(undefined);
              reload();
            }} />
          </ScrollView>
        ) : null}
      </Sheet>

      <Sheet open={!!buying} onClose={() => setBuying(undefined)} title={`Compré ${buying?.name ?? ""}`}>
        {buying ? <BuyForm product={buying} onSave={async (qty, price, expires) => {
          const { stock: _s, ...rest } = buying;
          await saveProduct(db, { ...rest, expiresOn: expires ?? buying.expiresOn }, qty, price, today);
          setBuying(undefined);
          reload();
        }} /> : null}
      </Sheet>

      <Sheet open={!!discarding} onClose={() => setDiscarding(undefined)} title={`Descartar ${discarding?.name ?? ""}`}>
        {discarding ? <DiscardForm product={discarding} onSave={async (qty) => {
          await adjustStock(db, discarding, qty);
          setDiscarding(undefined);
          reload();
        }} /> : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

type ProductFields = { name: string; kind: ProductKind; unit: string; withdrawalMilkDays: number; withdrawalMeatDays: number; expiresOn?: string };

function ProductForm({ product, onSave }: { product: Partial<Product>; onSave: (p: ProductFields, stock: number, price: number) => void }) {
  const [name, setName] = useState(product.name ?? "");
  const [kind, setKind] = useState<ProductKind>(product.kind ?? "medicina");
  const [unit, setUnit] = useState(product.unit ?? (product.kind === "vacuna" ? "dosis" : "ml"));
  const [milk, setMilk] = useState(String(product.withdrawalMilkDays ?? 0));
  const [meat, setMeat] = useState(String(product.withdrawalMeatDays ?? 0));
  const [hasExpiry, setHasExpiry] = useState(!!product.expiresOn);
  const [expires, setExpires] = useState<DayParts>(splitDay(product.expiresOn ?? todayDay()));
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string>();
  const [unitTouched, setUnitTouched] = useState(!!product.id);
  // A new product suggests the usual unit for its type until the person writes one.
  const pickKind = (k: ProductKind) => {
    setError(undefined);
    setKind(k);
    if (!unitTouched) setUnit({ vacuna: "dosis", medicina: "ml", insumo: "bulto", herramienta: "unidad" }[k]);
  };
  const withdrawal = kind === "vacuna" || kind === "medicina";

  function save() {
    if (!name.trim() || !unit.trim()) return setError("Escribe el nombre y la unidad.");
    const exp = hasExpiry ? toDay(expires) : undefined;
    if (hasExpiry && !exp) return setError("Revisa la fecha de vencimiento.");
    onSave({ name: name.trim(), kind, unit: unit.trim(), withdrawalMilkDays: withdrawal ? Math.round(decimal(milk)) : 0, withdrawalMeatDays: withdrawal ? Math.round(decimal(meat)) : 0, expiresOn: exp },
      product.id ? 0 : decimal(stock), product.id ? 0 : Number(price.replace(/\D/g, "")) || 0);
  }

  return (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Field label="Nombre" value={name} onChangeText={(t) => { setError(undefined); setName(t); }} placeholder="Ej: Ivermectina 1 %" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(Object.keys(KIND) as ProductKind[]).map((k) => <Chip key={k} label={KIND[k].label} active={kind === k} onPress={() => pickKind(k)} />)}
      </View>
      <Field label="Unidad" value={unit} onChangeText={(t) => { setError(undefined); setUnitTouched(true); setUnit(t); }} placeholder="ml, dosis, bulto, kg" />
      {kind === "vacuna" || kind === "medicina" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Retiro leche (días)" value={milk} onChangeText={setMilk} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Retiro carne (días)" value={meat} onChangeText={setMeat} keyboardType="number-pad" /></View>
        </View>
      ) : null}
      <Chip label={hasExpiry ? "Tiene fecha de vencimiento ✓" : "Agregar fecha de vencimiento"} active={hasExpiry} onPress={() => setHasExpiry(!hasExpiry)} />
      {hasExpiry ? <DateField label="Vence el" value={expires} onChange={(v) => { setError(undefined); setExpires(v); }} /> : null}
      {product.id ? null : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Cantidad que tienes" value={stock} onChangeText={setStock} keyboardType="decimal-pad" placeholder="Ej: 100" /></View>
          <View style={{ flex: 1 }}><Field label="Lo que costó (opcional)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="$" /></View>
        </View>
      )}
      {error ? <Banner icon="note" tone="danger" title={error} /> : null}
      <Button label="Guardar" onPress={save} />
    </View>
  );
}

function BuyForm({ product, onSave }: { product: Product; onSave: (qty: number, price: number, expires?: string) => void }) {
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [expires, setExpires] = useState<DayParts>(splitDay(product.expiresOn ?? todayDay()));
  const amount = Number(price.replace(/\D/g, "")) || 0;
  return (
    <View style={{ gap: 12 }}>
      <Field label={`Cantidad (${product.unit})`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="Ej: 50" />
      <Field label="Lo que pagaste (opcional)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="$" />
      {product.expiresOn ? <DateField label="Vencimiento del lote nuevo" value={expires} onChange={setExpires} /> : null}
      {amount ? <Txt size={13} color={colors.textMuted}>Se anota {money(amount)} como gasto en Costos.</Txt> : null}
      <Button label="Sumar al inventario" disabled={!(decimal(qty) > 0)} onPress={() => onSave(decimal(qty), amount, product.expiresOn ? toDay(expires) : undefined)} />
    </View>
  );
}

function DiscardForm({ product, onSave }: { product: Product; onSave: (qty: number) => void }) {
  const [qty, setQty] = useState("");
  const n = decimal(qty);
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} color={colors.textMuted}>Para lo que se dañó, venció o se perdió. Lo que se aplica a un animal se descuenta solo.</Txt>
      <Field label={`Cantidad (${product.unit})`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder={`Hay ${num(product.stock)}`} />
      <Button kind="danger" label="Descartar" disabled={!(n > 0 && n <= product.stock)} onPress={() => onSave(n)} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 10, ...shadow },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  status: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  action: { flex: 1, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
});
