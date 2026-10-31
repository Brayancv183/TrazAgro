import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { colors, noveltiesFor, plural, radius, shadow, shortDate, todayDay, type Animal, type Novelty, type NoveltyKind } from "@trazagro/shared";
import { loadFarmBundle, markReported } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { shareText } from "../lib/share";
import { useDbQuery } from "../lib/useDb";
import { Banner, Button, Card, Chip, EarTag, GreenHeader, Txt } from "../ui/kit";

const KIND_LABEL: Record<NoveltyKind, string> = { nacimiento: "Nacimiento", ingreso: "Ingreso (compra)", venta: "Venta", muerte: "Muerte o pérdida", sacrificio: "Sacrificio", traslado: "Traslado entre fincas" };

export default function IcaScreen() {
  const { farmId: farmParam } = useLocalSearchParams<{ farmId?: string }>();
  const farmId = useFarmId(farmParam);
  const canMark = useFarm().can("events");
  const db = useSQLiteContext();
  const today = todayDay();
  const [busy, setBusy] = useState<string>();
  const { data, reload } = useDbQuery((d) => loadFarmBundle(d, farmId), [farmId]);

  if (!data?.farm) return <GreenHeader back title="Reporte ICA" />;
  const { farm, animals, events } = data;
  const active = animals.filter((a) => a.status === "activo");
  const withTag = active.filter((a) => a.tagVisual).length;
  const withRfid = active.filter((a) => a.rfid).length;
  const novelties = noveltiesFor(farm, animals, events, today);
  const pending = novelties.filter((n) => !n.reported);
  const done = novelties.length - pending.length;
  const byId = new Map(animals.map((a) => [a.id, a]));

  async function mark(n: Novelty) {
    setBusy(`${n.animalId}:${n.kind}`);
    await markReported(db, farmId, n.animalId, n.kind);
    setBusy(undefined);
    reload();
  }

  function share() {
    const lines = pending.map((n) => {
      const a = byId.get(n.animalId);
      return `• ${KIND_LABEL[n.kind]} · ${a?.name ?? ""} arete ${a?.tagVisual ?? "sin arete"}${a?.rfid ? ` (RFID ${a.rfid})` : ""} · ${shortDate(n.date, today)}`;
    });
    shareText("Novedades ICA", `Novedades por reportar en SINIGAN — ${farm.name}${farm.icaRegistration ? ` (${farm.icaRegistration})` : ""}\n${lines.join("\n")}`).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker={`ICA · SINIGAN · ${farm.name.toUpperCase()}`} title="Reporte ICA">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>{farm.icaRegistration ? `Predio ${farm.icaRegistration}` : "Sin registro ICA del predio"}</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        <View style={s.stats}>
          <Stat value={`${withTag}/${active.length}`} label="con arete visual" ok={withTag === active.length} />
          <Stat value={`${withRfid}/${active.length}`} label="con chip RFID" ok={withRfid === active.length} />
          <Stat value={String(pending.length)} label="novedades pendientes" ok={!pending.length} />
        </View>

        <Banner icon="note" tone="warn" title="El ICA no recibe estos datos por correo ni por la app"
          text="Las novedades se registran en SINIGAN (sinigan.co o su app oficial). TrazAgro te deja la lista lista y te recuerda qué falta." />

        <Txt w="extrabold" size={20}>Por reportar</Txt>
        {!pending.length ? <Banner icon="check" tone="ok" title="No tienes novedades pendientes" text="De los últimos 90 días." /> : null}
        {pending.map((n) => {
          const a = byId.get(n.animalId);
          return <NoveltyRow key={`${n.animalId}:${n.kind}`} n={n} a={a} today={today} busy={busy === `${n.animalId}:${n.kind}`} onDone={canMark ? () => mark(n) : undefined} />;
        })}
        {pending.length ? <Button kind="soft" label="Compartir la lista" onPress={share} /> : null}
        {done ? <Txt size={13} color={colors.textMuted}>{plural(done, "ya marcada como reportada", "ya marcadas como reportadas")}.</Txt> : null}

        <Card style={{ gap: 8 }}>
          <Txt w="bold" size={16}>Cómo reportarlas en SINIGAN</Txt>
          {["Entra a sinigan.co o a la app oficial con tu usuario de productor.", "Registra cada novedad con el número del arete (visual y RFID).", "Vuelve aquí y toca “Ya lo reporté” para que no se te olvide ninguna."].map((t, i) => (
            <View key={t} style={{ flexDirection: "row", gap: 10 }}>
              <View style={s.num}><Txt w="extrabold" size={13} color={colors.onDark}>{i + 1}</Txt></View>
              <Txt size={14} style={{ flex: 1 }}>{t}</Txt>
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label, ok }: { value: string; label: string; ok: boolean }) {
  return (
    <View style={s.stat}>
      <Txt w="extrabold" size={24} color={ok ? colors.selva : colors.warn}>{value}</Txt>
      <Txt size={12} color={colors.textMuted}>{label}</Txt>
    </View>
  );
}

function NoveltyRow({ n, a, today, busy, onDone }: { n: Novelty; a?: Animal; today: string; busy: boolean; onDone?: () => void }) {
  return (
    <View style={s.row}>
      <EarTag code={a?.tagVisual} size={38} tone={a?.sex === "macho" ? colors.tierra : colors.selva} />
      <View style={{ flex: 1, gap: 2 }}>
        <Chip label={KIND_LABEL[n.kind]} tone={{ bg: colors.warnSoft, fg: colors.warn }} />
        <Txt w="bold" size={15}>{a?.name ?? `#${a?.tagVisual ?? "sin arete"}`}</Txt>
        <Txt size={13} color={colors.textMuted}>{shortDate(n.date, today)}{a?.tagVisual ? "" : " · falta el arete"}</Txt>
      </View>
      {onDone ? <Button kind="soft" label={busy ? "…" : "Ya lo reporté"} onPress={onDone} disabled={busy} style={{ minHeight: 44, paddingHorizontal: 14 }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
});
