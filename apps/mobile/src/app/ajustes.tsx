import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { colors, shortDate } from "@trazagro/shared";
import { getPref, setPref } from "../db/repo";
import { API_URL } from "../lib/api";
import { useFarm } from "../lib/farm";
import { Banner, Button, Card, Chip, GreenHeader, MenuRow, Txt } from "../ui/kit";

/** Device settings: demo farm visibility, privacy (Ley 1581) and app info. */
export default function AjustesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { farms, refresh } = useFarm();
  const [hideDemo, setHideDemo] = useState(false);
  const [consent, setConsent] = useState<string>();
  const hasReal = farms.some((f) => !f.isDemo);

  useFocusEffect(useCallback(() => {
    getPref(db, "hide_demo").then((v) => setHideDemo(v === "1"));
    getPref(db, "consent_1581").then(setConsent);
  }, [db]));

  async function toggleDemo(v: boolean) {
    await setPref(db, "hide_demo", v ? "1" : "0");
    setHideDemo(v);
    await refresh();
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <GreenHeader back kicker="TRAZAGRO" title="Ajustes" />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Card style={{ gap: 8 }}>
          <Txt w="bold" size={16}>Finca de prueba</Txt>
          <Txt size={13} color={colors.textMuted}>{hasReal ? "Ocúltala cuando ya no la necesites. Sus datos no se borran." : "Se puede ocultar cuando registres tu propia finca."}</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Mostrar" active={!hideDemo} onPress={() => toggleDemo(false)} />
            <Chip label="Ocultar" active={hideDemo} onPress={() => hasReal && toggleDemo(true)} />
          </View>
        </Card>

        <Card style={{ gap: 6 }}>
          <Txt w="bold" size={16}>Modo noche</Txt>
          <Txt size={13} color={colors.textMuted}>El tema oscuro “Noche de campo” está diseñado y llega en una próxima versión.</Txt>
        </Card>

        <Card style={{ gap: 6 }}>
          <Txt w="bold" size={16}>Privacidad y datos personales</Txt>
          <Txt size={13} color={colors.textMuted}>
            {consent ? `Autorizaste el tratamiento de datos el ${shortDate(consent.slice(0, 10))} (Ley 1581 de 2012).` : "Todavía no has autorizado el tratamiento de datos."}
          </Txt>
          <Txt size={13} color={colors.textMuted}>Para consultar, corregir o borrar tus datos de la nube escribe a datos@trazagro.co. Cerrar sesión borra tus fincas de este celular.</Txt>
          <Button kind="soft" label="Ver la autorización otra vez" onPress={() => router.push("/bienvenida")} />
        </Card>

        <MenuRow icon="check" title="Cuenta y respaldo" detail="Iniciar o cerrar sesión" onPress={() => router.push("/cuenta")} />
        <Banner icon="note" tone="ok" title="TrazAgro 1.0 · piloto" text={`Servidor: ${API_URL}`} />
      </View>
    </ScrollView>
  );
}
