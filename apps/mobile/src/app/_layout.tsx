import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from "@expo-google-fonts/outfit";
import { colors, fonts } from "@trazagro/shared";
import { migrate } from "../db/schema";
import { FarmProvider } from "../lib/farm";

export default function RootLayout() {
  const [dbError, setDbError] = useState<Error>();
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold });
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.lima} />
      </View>
    );
  }
  if (dbError) {
    // Most often on web: the database file is locked by another open TrazAgro tab.
    return (
      <View style={{ flex: 1, backgroundColor: colors.crema, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, textAlign: "center" }}>No se pudo abrir tus datos</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, textAlign: "center" }}>
          Cierra otras ventanas de TrazAgro y vuelve a abrir la app. Tus datos siguen guardados.
        </Text>
      </View>
    );
  }
  return (
    <SQLiteProvider databaseName="trazagro.db" onInit={migrate} onError={setDbError}>
      <StatusBar style="light" />
      <FarmProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.crema } }} />
      </FarmProvider>
    </SQLiteProvider>
  );
}
