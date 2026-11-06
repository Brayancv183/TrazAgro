import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { ageText, animalLabel, colors, daysBetween, num, todayDay } from "@trazagro/shared";
import type { HerdRow } from "../../db/animales";
import { addPhoto } from "../../db/photos";
import { Icon } from "../Icon";
import { Sheet, Txt } from "../kit";
import { Tap } from "../motion";
import { FlexTap } from "./parts";
import { pickPhoto } from "./photo";
import { statusOf } from "./status";

/** Mini profile that opens from a row of the herd list (SheetAnimal.dc). */
export function AnimalSheet({ row, onClose, canEdit, onChanged }: { row?: HerdRow; onClose: () => void; canEdit: boolean; onChanged: () => void }) {
  const router = useRouter();
  const db = useSQLiteContext();
  const today = todayDay();
  const r = row;
  const label = r ? animalLabel(r.a) : "";
  const go = (fn: () => void) => { onClose(); setTimeout(fn, 10); };

  async function photo() {
    if (!r) return;
    const uri = await pickPhoto("camera");
    if (!uri) return;
    await addPhoto(db, { farmId: r.a.farmId, animalId: r.a.id, uri });
    onChanged();
  }

  const left = r ? [r.retiro.milk && r.w.milkUntil ? { what: "leche", days: daysBetween(today, r.w.milkUntil) } : undefined, r.retiro.meat && r.w.meatUntil ? { what: "carne", days: daysBetween(today, r.w.meatUntil) } : undefined].filter((x): x is { what: string; days: number } => !!x) : [];

  return (
    <Sheet open={!!row} onClose={onClose} title={label}>
      {r ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: -8, flexWrap: "wrap" }}>
            <View style={s.status}><Txt w="bold" size={12} color={colors.selva}>{statusOf(r)}</Txt></View>
            <Txt size={13} color={colors.textMuted} style={{ flexShrink: 1 }}>
              {[r.a.tagVisual ? `#${r.a.tagVisual}` : "Sin arete", r.a.sex === "hembra" ? "Hembra" : "Macho", r.a.breed, r.lotShort].filter(Boolean).join(" · ")}
            </Txt>
          </View>

          <View style={s.photo} accessibilityLabel={r.photo ? `Foto de ${label}` : `${label} todavía no tiene foto`}>
            {r.photo ? <Image source={{ uri: r.photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
              <>
                <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                  <Defs><RadialGradient id="g" cx="60%" cy="55%" r="75%"><Stop offset="0" stopColor={colors.hoja} /><Stop offset="1" stopColor={colors.selva} /></RadialGradient></Defs>
                  <Rect width="100%" height="100%" fill="url(#g)" />
                </Svg>
                <View style={{ alignItems: "center", gap: 6 }}>
                  <View style={s.photoRing}><Icon name="camera" color={colors.lima} size={26} /></View>
                  <Txt size={12} color={colors.onDarkMuted}>Todavía no tiene foto</Txt>
                </View>
              </>
            )}
            {canEdit ? (
              <View style={{ position: "absolute", right: 14, bottom: 12 }}>
                <Tap accessibilityRole="button" accessibilityLabel={`Tomar foto de ${label}`} onPress={photo} style={s.photoBtn}>
                  <Icon name="camera" color={colors.selva} size={14} width={2.4} />
                  <Txt w="bold" size={12} color={colors.selva}>Foto</Txt>
                </Tap>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Mini k="Edad" v={ageText(r.a.birthDate, today).replace(" a ", "a ").replace(" m", "m")} />
            <Mini k="Peso" v={r.weightKg ? `${num(r.weightKg, 0)} kg` : "—"} />
            {r.a.sex === "hembra" ? <Mini k="Leche" v={r.milkAvg !== undefined ? `${num(r.milkAvg)} L` : "—"} /> : <Mini k="Lote" v={r.lotShort ?? "—"} />}
            {r.a.sex === "hembra" ? <Mini k="Partos" v={String(r.births)} /> : <Mini k="Raza" v={r.a.breed ?? "—"} />}
          </View>

          {left.length ? (
            <View style={s.warn}>
              <Icon name="drop" color={colors.warn} size={18} />
              <Txt w="semibold" size={13} color={colors.signalText} style={{ flex: 1 }}>
                {left.map((x) => `No vender ${x.what} · ${x.days <= 0 ? "último día hoy" : `faltan ${x.days} ${x.days === 1 ? "día" : "días"}`}`).join("\n")}
              </Txt>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            {canEdit ? (
              <FlexTap accessibilityRole="button" accessibilityLabel={`Registrar para ${label}`} style={[s.btn, { backgroundColor: "#E8EFE0" }]}
                onPress={() => go(() => router.push({ pathname: "/evento/nuevo", params: { farmId: r.a.farmId, animalId: r.a.id } }))}>
                <Txt w="bold" size={15} color={colors.selva}>Registrar</Txt>
              </FlexTap>
            ) : null}
            <FlexTap flex={1.4} accessibilityRole="button" accessibilityLabel="Ver perfil completo" style={[s.btn, { backgroundColor: colors.selva }]}
              onPress={() => go(() => router.push({ pathname: "/animal/[id]", params: { id: r.a.id } }))}>
              <Txt w="bold" size={15} color={colors.onDark}>Ver perfil completo</Txt>
            </FlexTap>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.mini}>
      <Txt size={11} color={colors.textMuted}>{k}</Txt>
      <Txt w="extrabold" size={16} numberOfLines={1}>{v}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  status: { backgroundColor: colors.limaSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  photo: { height: 150, borderRadius: 22, overflow: "hidden", backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  photoRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(174,213,129,0.18)", borderWidth: 2, borderStyle: "dashed", borderColor: colors.lima, alignItems: "center", justifyContent: "center" },
  photoBtn: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.92)", flexDirection: "row", alignItems: "center", gap: 6 },
  mini: { flex: 1, backgroundColor: colors.crema, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8 },
  warn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.warnSoft },
  btn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
});
