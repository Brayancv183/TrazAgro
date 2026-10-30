import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, plural } from "@trazagro/shared";
import { listAnimals, listLots } from "../db/repo";
import { useFarm } from "../lib/farm";
import { useDbQuery } from "../lib/useDb";
import { Banner, Button, Card, GreenHeader, Txt } from "../ui/kit";

/**
 * Map and GPS. Collars (LoRaWAN) and drone flights are phase 2–3: this screen shows the farm's lots
 * with their animals today and explains what the GPS kit adds.
 */
export default function MapaScreen() {
  const router = useRouter();
  const { farm } = useFarm();
  const { data } = useDbQuery(async (d) => (farm ? { lots: await listLots(d, farm.id), animals: await listAnimals(d, farm.id) } : null), [farm?.id]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker="SERVICIOS" title="Mapa y GPS">
        <Txt w="medium" size={15} color={colors.onDarkMuted}>{farm ? `${farm.name}${farm.hectares ? ` · ${farm.hectares} ha` : ""}` : ""}</Txt>
      </GreenHeader>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <Banner icon="pin" tone="warn" title="El rastreo GPS llega con el kit de collares"
          text="Con las orejeras GPS LoRa y un gateway en la casa verás cada animal en el mapa y te avisamos si sale del potrero. Sin plan de datos mensual." />
        {data?.lots.map((l) => {
          const n = data.animals.filter((a) => a.lotId === l.id).length;
          return (
            <Card key={l.id} style={{ gap: 2 }}>
              <Txt w="bold" size={16}>{l.name}</Txt>
              <Txt size={13} color={colors.textMuted}>{[l.purpose, plural(n, "animal", "animales")].filter(Boolean).join(" · ")}</Txt>
            </Card>
          );
        })}
        <Button kind="soft" label="Ordenar lotes y potreros" onPress={() => router.push("/lotes")} />
        <Button label="Cotizar kit GPS" onPress={() => router.push("/tienda")} />
        <Banner icon="layers" tone="ok" title="Drones: agenda de vuelos"
          text="Conteo de animales y estado de los potreros con dron. Se agenda con un asesor mientras sale el módulo en la app." />
      </View>
    </ScrollView>
  );
}
