import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { animalLabel, colors, type Animal } from "@trazagro/shared";
import { shareText } from "../../lib/share";
import { Icon } from "../Icon";
import { Txt } from "../kit";
import { EASE, Tap } from "../motion";
import { FlexTap, SegTabs } from "./parts";

/** What the printed code says: scanning it in TrazAgro opens this animal. */
export const qrValue = (a: Animal) => `trazagro:animal:${a.id}|${a.tagVisual ?? ""}`;

type Size = "etiqueta" | "hoja";

/** Printable QR of the animal (ModalQR.dc): pops in the middle over a dark scrim. */
export function QrModal({ open, onClose, animal, farmName, ica }: { open: boolean; onClose: () => void; animal: Animal; farmName?: string; ica?: string }) {
  const [size, setSize] = useState<Size>("etiqueta");
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (open) { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 320, easing: EASE, useNativeDriver: true }).start(); }
  }, [open, v]);
  const label = animalLabel(animal);
  const title = `${animal.name ?? "Animal"}${animal.tagVisual ? ` · #${animal.tagVisual}` : ""}`;
  const sub = [animal.rfid ? `RFID ${animal.rfid}` : undefined, farmName].filter(Boolean).join(" · ");
  const web = Platform.OS === "web";

  function print() {
    // Web only: copy the drawn QR into a print page with one 5 cm label or a sheet of 6.
    const svg = document.getElementById("qr-animal")?.querySelector("svg")?.outerHTML;
    if (!svg) return;
    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const one = `<div class="lab"><div class="qr">${svg}</div><b>${esc(title)}</b><small>${esc(sub)}${ica ? `<br>Reg. ${esc(ica)}` : ""}</small><i>TRAZAGRO</i></div>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR ${esc(title)}</title><style>
      body{font-family:system-ui,sans-serif;margin:1cm;display:flex;flex-wrap:wrap;gap:.6cm}
      .lab{width:5cm;border:1px dashed #bbb;border-radius:.4cm;padding:.3cm;display:flex;flex-direction:column;align-items:center;gap:.1cm;text-align:center}
      .qr svg{width:3.6cm;height:3.6cm} b{font-size:12pt} small{font-size:7pt;color:#555} i{font-style:normal;font-size:6pt;font-weight:800;letter-spacing:.14em;color:#1B5E20}
    </style></head><body>${(size === "hoja" ? Array(6).fill(one) : [one]).join("")}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,25,17,0.55)", opacity: v }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>
      <Animated.View accessibilityViewIsModal style={[s.card, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt w="extrabold" size={20} style={{ flex: 1 }}>{`Código QR de ${label}`}</Txt>
          <Tap accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={s.close}><Icon name="x" color={colors.text} size={18} width={2.4} /></Tap>
        </View>
        <View style={s.label}>
          <View nativeID="qr-animal" accessibilityLabel={`Código QR del animal ${animal.tagVisual ?? label}`} style={{ padding: 8, backgroundColor: colors.card }}>
            <QRCode value={qrValue(animal)} size={168} color={colors.text} backgroundColor={colors.card} ecl="M" />
          </View>
          <Txt w="extrabold" size={22} style={{ letterSpacing: -0.2 }}>{title}</Txt>
          {sub || ica ? <Txt size={12} color={colors.textMuted} style={{ textAlign: "center" }}>{`${sub}${ica ? `\nReg. ${ica}` : ""}`}</Txt> : null}
          <Txt w="extrabold" size={11} color={colors.selva} style={{ letterSpacing: 1.5 }}>TRAZAGRO</Txt>
        </View>
        {web ? (
          <SegTabs<Size> bg={colors.sand} value={size} onChange={setSize} tabs={[{ id: "etiqueta", label: "Etiqueta 5 cm" }, { id: "hoja", label: "Hoja · 6 por página" }]} />
        ) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <FlexTap accessibilityRole="button" accessibilityLabel="Compartir código" style={[s.btn, { backgroundColor: colors.sand }]}
            onPress={() => shareText(`QR de ${label}`, `${title}\n${sub}\nCódigo TrazAgro: ${qrValue(animal)}`).catch(() => {})}>
            <Txt w="extrabold" size={14}>Compartir</Txt>
          </FlexTap>
          {web ? (
            <FlexTap accessibilityRole="button" accessibilityLabel="Imprimir" onPress={print} style={[s.btn, { backgroundColor: colors.selva }]}>
              <Txt w="extrabold" size={14} color={colors.onDark}>Imprimir</Txt>
            </FlexTap>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: { position: "absolute", left: 20, right: 20, top: 92, alignSelf: "center", maxWidth: 420, backgroundColor: colors.card, borderRadius: 30, padding: 20, gap: 16,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 60, shadowOffset: { width: 0, height: 24 }, elevation: 24 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  label: { borderWidth: 2, borderStyle: "dashed", borderColor: "#D5D0C4", borderRadius: 22, padding: 16, alignItems: "center", gap: 10 },
  btn: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
});
