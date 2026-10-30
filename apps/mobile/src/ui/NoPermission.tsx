import type { ReactNode } from "react";
import { View } from "react-native";
import type { SyncTable } from "@trazagro/shared";
import { ROLE_LABEL } from "@trazagro/shared";
import { useFarm } from "../lib/farm";
import { Banner, GreenHeader } from "./kit";

/** Renders `children` only when the person's role may change `table` on the current farm. */
export function RequireWrite({ table, children }: { table: SyncTable; children: ReactNode }) {
  const { can, role } = useFarm();
  if (can(table)) return <>{children}</>;
  return (
    <View style={{ flex: 1 }}>
      <GreenHeader back title="Sin permiso" />
      <View style={{ paddingHorizontal: 16 }}>
        <Banner icon="users" tone="warn" title={`Tu rol en esta finca es ${ROLE_LABEL[role]}`} text="Pídele al dueño o al administrador que haga este registro o que te cambie el rol." />
      </View>
    </View>
  );
}
