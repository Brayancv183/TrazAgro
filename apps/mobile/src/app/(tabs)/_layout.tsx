import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@trazagro/shared";
import { getPref } from "../../db/repo";
import { TabBar } from "../../ui/TabBar";

export default function TabsLayout() {
  const db = useSQLiteContext();
  const router = useRouter();

  // First open: welcome screens and the data consent before anything else.
  useEffect(() => {
    getPref(db, "consent_1581").then((v) => { if (!v) router.replace("/bienvenida"); });
  }, [db, router]);

  return (
    <Tabs tabBar={() => <TabBar />} screenOptions={{ headerShown: false, animation: "shift", sceneStyle: { backgroundColor: colors.crema } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="animales" />
      <Tabs.Screen name="escanear" />
      <Tabs.Screen name="alertas" />
      <Tabs.Screen name="modulos" />
    </Tabs>
  );
}
