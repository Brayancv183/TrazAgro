import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@trazagro/shared";
import { Icon } from "../Icon";
import { Sheet, Txt } from "../kit";
import { Tap } from "../motion";
import { FlexTap, SegTabs } from "./parts";

export type SharePart = "id" | "salud" | "peso" | "repro";
const PARTS: [SharePart, string][] = [["id", "Identificación, raza y edad"], ["salud", "Vacunas y tratamientos"], ["peso", "Pesajes"], ["repro", "Partos y familia"]];

type Mode = "app" | "texto";

/**
 * "Compartir a Miel #00123" (SheetCompartir.dc). Sending the animal to another TrazAgro user needs the
 * server side that doesn't exist yet, so that tab says so honestly and offers the move between own farms.
 */
export function ShareSheet({ open, onClose, title, onShare, onMoveFarm }: {
  open: boolean; onClose: () => void; title: string;
  onShare: (parts: Set<SharePart>) => Promise<"shared" | "downloaded" | "cancelled">;
  onMoveFarm?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("texto");
  const [inc, setInc] = useState<Set<SharePart>>(new Set(["id", "salud", "peso", "repro"]));
  const [done, setDone] = useState<"shared" | "downloaded">();
  // A new opening starts on the form again (reset during render when `open` turns true).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDone(undefined);
  }
  const toggle = (k: SharePart) => { const n = new Set(inc); if (n.has(k)) n.delete(k); else n.add(k); setInc(n); };

  return (
    <Sheet open={open} onClose={onClose} title={done ? "Ficha enviada" : title}>
      {done ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 6 }}>
          <View style={s.doneIcon}><Icon name="check" color={colors.selva} size={36} width={3} /></View>
          <Txt w="extrabold" size={22}>{done === "shared" ? "Ficha compartida" : "Ficha descargada"}</Txt>
          <Txt size={14} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 21 }}>
            {done === "shared" ? "Le llega como mensaje con lo que elegiste." : "Quedó en tus descargas. La puedes enviar por WhatsApp o correo."}
          </Txt>
          <View style={{ alignSelf: "stretch", marginTop: 6 }}>
            <Tap accessibilityRole="button" accessibilityLabel="Listo" onPress={onClose} style={[s.btn, { backgroundColor: colors.selva }]}>
              <Txt w="bold" size={16} color={colors.onDark}>Listo</Txt>
            </Tap>
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <SegTabs<Mode> bg={colors.tint} value={mode} onChange={setMode} tabs={[{ id: "app", label: "A un usuario TrazAgro" }, { id: "texto", label: "Mensaje o archivo" }]} />
          {mode === "app" ? (
            <View style={{ gap: 12 }}>
              <View style={s.soon}>
                <View style={s.soonIcon}><Icon name="users" color={colors.selva} size={22} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt w="extrabold" size={15}>Pronto</Txt>
                  <Txt size={13} color={colors.textMuted} style={{ lineHeight: 18 }}>Podrás pasarle el animal a otra persona que use TrazAgro, con toda su trazabilidad. Mientras tanto, envíale la ficha como mensaje.</Txt>
                </View>
              </View>
              {onMoveFarm ? (
                <Tap accessibilityRole="button" accessibilityLabel="Pasar a otra de mis fincas" onPress={onMoveFarm} style={s.move}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt w="bold" size={15}>¿Pasa a otra de tus fincas?</Txt>
                    <Txt size={12} color={colors.textMuted}>Se mueve con todo su historial</Txt>
                  </View>
                  <Txt w="bold" size={14} color={colors.selva}>Pasar ›</Txt>
                </Tap>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View accessibilityLabel="Qué incluir" style={s.parts}>
                {PARTS.map(([k, label], i) => {
                  const on = inc.has(k);
                  return (
                    <Tap key={k} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on }} aria-checked={on} onPress={() => toggle(k)}
                      style={[s.part, i < PARTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#EAE6DC" }]}>
                      <Txt w="semibold" size={14} style={{ flex: 1 }}>{label}</Txt>
                      <View style={[s.box, on && { backgroundColor: colors.selva, borderWidth: 0 }]}>{on ? <Icon name="check" color={colors.onDark} size={14} width={3} /> : null}</View>
                    </Tap>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <FlexTap accessibilityRole="button" accessibilityLabel="Enviar ficha" disabled={!inc.size} style={[s.btn, { backgroundColor: colors.selva }]}
                  onPress={async () => { const r = await onShare(inc).catch(() => "cancelled" as const); if (r !== "cancelled") setDone(r); }}>
                  <Txt w="bold" size={15} color={colors.onDark}>Enviar ficha</Txt>
                </FlexTap>
              </View>
              <Txt size={12} color={colors.textMuted}>Sale como texto por WhatsApp, correo o la app que elijas. En un computador se descarga como archivo.</Txt>
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  btn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  soon: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 20, backgroundColor: colors.tint },
  soonIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  move: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, borderWidth: 2, borderColor: colors.line },
  parts: { backgroundColor: colors.crema, borderRadius: 20, paddingVertical: 2, paddingHorizontal: 14 },
  part: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#B0B8AA", alignItems: "center", justifyContent: "center" },
});
