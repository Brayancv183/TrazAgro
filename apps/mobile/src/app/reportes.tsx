import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  addDays, categoryOf, colors, inWithdrawal, shortDate, todayDay, weightSummary, withdrawalFor,
} from "@trazagro/shared";
import { listLots, listMilk, loadFarmBundle } from "../db/repo";
import { useFarm, useFarmId } from "../lib/farm";
import { csvRow, shareText } from "../lib/share";
import { Banner, GreenHeader, MenuRow, Txt } from "../ui/kit";

const EVENT_LABEL: Record<string, string> = { vacuna: "Vacuna", tratamiento: "Tratamiento", desparasitacion: "Desparasitación" };
const SESSION_LABEL = { manana: "Mañana", tarde: "Tarde", dia: "Todo el día" } as const;
const STATUS = { activo: "Activo", vendido: "Vendido", muerto: "Muerto", sacrificado: "Sacrificado", perdido: "Perdido", trasladado: "Trasladado" } as const;

/** Reports to send to the accountant, the vet, a buyer or the bank: CSV opens in Excel, text goes to WhatsApp. */
export default function ReportesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const farmId = useFarmId();
  const money = useFarm().can("movements");
  const [done, setDone] = useState<string>();
  const today = todayDay();

  async function run(kind: "inventario" | "sanidad" | "finanzas" | "leche") {
    setDone(undefined);
    const b = await loadFarmBundle(db, farmId);
    if (!b.farm) return;
    const slug = b.farm.name.replace(/\s+/g, "_");
    let r: Awaited<ReturnType<typeof shareText>>;
    if (kind === "inventario") {
      const lots = await listLots(db, farmId);
      const rows = b.animals.sort((x, y) => (x.tagVisual ?? "").localeCompare(y.tagVisual ?? "")).map((a) => {
        const ev = b.events.filter((e) => e.animalId === a.id);
        const w = weightSummary(ev);
        return csvRow([a.tagVisual, a.rfid, a.name, a.sex, a.breed, a.birthDate, categoryOf(a.sex, a.birthDate, ev.filter((e) => e.type === "parto").length, today),
          lots.find((l) => l.id === a.lotId)?.name, a.origin, w.lastKg, w.lastDate, STATUS[a.status]]);
      });
      r = await shareText(`Inventario ${b.farm.name}`, [csvRow(["Arete", "RFID", "Nombre", "Sexo", "Raza", "Nacimiento", "Categoría", "Lote", "Origen", "Último peso (kg)", "Fecha peso", "Estado"]), ...rows].join("\n"), `Inventario_${slug}_${today}.csv`);
    } else if (kind === "finanzas") {
      const from = addDays(today, -365);
      const rows = b.movements.filter((m) => m.date >= from).map((m) => csvRow([m.date, m.kind === "ingreso" ? "Ingreso" : "Gasto", m.category, m.description, m.kind === "ingreso" ? m.amount : -m.amount]));
      r = await shareText(`Finanzas ${b.farm.name}`, [csvRow(["Fecha", "Tipo", "Categoría", "Descripción", "Valor"]), ...rows].join("\n"), `Finanzas_${slug}_${today}.csv`);
    } else if (kind === "leche") {
      const milk = await listMilk(db, farmId, addDays(today, -30));
      const rows = milk.map((m) => {
        const a = b.animals.find((x) => x.id === m.animalId);
        return csvRow([m.date, SESSION_LABEL[m.session], a ? a.name ?? a.tagVisual : "Tanque", String(m.liters).replace(".", ",")]);
      });
      r = await shareText(`Leche ${b.farm.name}`, [csvRow(["Fecha", "Ordeño", "Vaca", "Litros"]), ...rows].join("\n"), `Leche_${slug}_${today}.csv`);
    } else {
      const active = b.animals.filter((a) => a.status === "activo");
      const retiro = active.map((a) => ({ a, w: withdrawalFor(b.events.filter((e) => e.animalId === a.id), b.products) })).filter((x) => { const on = inWithdrawal(x.w, today); return on.milk || on.meat; });
      const recent = b.events.filter((e) => ["vacuna", "tratamiento", "desparasitacion"].includes(e.type) && e.date >= addDays(today, -90)).sort((x, y) => y.date.localeCompare(x.date));
      const name = (id: string) => { const a = b.animals.find((x) => x.id === id); return a ? `${a.name ?? ""} #${a.tagVisual ?? ""}`.trim() : "?"; };
      const text = [
        `Reporte sanitario — ${b.farm.name} (${b.farm.municipality}, ${b.farm.department})${b.farm.icaRegistration ? ` · ${/^ICA/i.test(b.farm.icaRegistration) ? "" : "ICA "}${b.farm.icaRegistration}` : ""}`,
        `Fecha: ${shortDate(today)} · ${active.length} animales activos`,
        "",
        retiro.length ? "EN DÍAS DE RETIRO:" : "Ningún animal en días de retiro.",
        ...retiro.map(({ a, w }) => `· ${name(a.id)}: leche hasta ${w.milkUntil ? shortDate(w.milkUntil) : "—"}, carne hasta ${w.meatUntil ? shortDate(w.meatUntil) : "—"}`),
        "",
        "APLICACIONES (90 días):",
        ...recent.map((e) => `· ${shortDate(e.date)} ${EVENT_LABEL[e.type] ?? e.type} — ${name(e.animalId)} — ${b.products.find((p) => p.id === e.productId)?.name ?? ""} ${e.dose ?? ""}`.trim()),
        "",
        "Generado con TrazAgro",
      ].join("\n");
      r = await shareText(`Sanidad ${b.farm.name}`, text, `Sanidad_${slug}_${today}.txt`);
    }
    if (r !== "cancelled") setDone(r === "downloaded" ? "Reporte descargado" : "Reporte listo para enviar");
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker="FINCA" title="Reportes">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>Para el contador, el veterinario, el comprador o el banco.</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {done ? <Banner icon="check" tone="ok" title={done} /> : null}
        <MenuRow icon="tag" title="Inventario del hato" detail="Excel (CSV) con aretes, categorías, lotes y pesos" onPress={() => run("inventario")} />
        <MenuRow icon="syringe" title="Reporte sanitario" detail="Retiros activos y aplicaciones de 90 días" onPress={() => run("sanidad")} />
        {money ? <MenuRow icon="money" title="Ingresos y gastos" detail="Excel (CSV) del último año" onPress={() => run("finanzas")} /> : null}
        <MenuRow icon="milk" title="Producción de leche" detail="Excel (CSV) de 30 días" onPress={() => run("leche")} />
        <MenuRow icon="note" title="Novedades ICA" detail="Nacimientos, compras y salidas para SINIGAN" onPress={() => router.push("/ica")} />
        <Txt size={12} color={colors.textMuted}>Los archivos CSV abren en Excel o Google Sheets. El PDF con logo llega en la app instalada.</Txt>
      </View>
    </ScrollView>
  );
}
