import { Stack } from "expo-router";
import { colors } from "../data/demo";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mis Fincas" }} />
      <Stack.Screen name="finca/[id]" options={{ title: "Animales" }} />
      <Stack.Screen name="animal/[id]" options={{ title: "Ficha del animal" }} />
    </Stack>
  );
}
