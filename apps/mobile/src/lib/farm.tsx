import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { canWrite, type Role, type SyncTable } from "@trazagro/shared";
import { getPref, listFarmsVisible, setPref, type FarmSummary } from "../db/repo";

interface FarmState {
  /** undefined while loading; null when there are no farms on this phone. */
  farm: FarmSummary | null | undefined;
  farms: FarmSummary[];
  /** The person's role on the current farm. Farms not shared with anyone are the person's own. */
  role: Role;
  /** Whether the person may change this kind of record on the current farm (the server enforces the same). */
  can: (table: SyncTable) => boolean;
  roleOf: (farmId: string) => Role;
  selectFarm: (id: string) => Promise<void>;
  /** Re-read the farm list (after creating, syncing or signing out). */
  refresh: () => Promise<void>;
}

const FarmContext = createContext<FarmState | null>(null);

/** Keeps the farm the person is working on. Real farms are preferred over the demo one. */
export function FarmProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [farms, setFarms] = useState<FarmSummary[]>([]);
  const [farmId, setFarmId] = useState<string | null | undefined>(undefined);
  const [roles, setRoles] = useState<Record<string, Role>>({});

  const refresh = useCallback(async () => {
    const list = await listFarmsVisible(db);
    setFarms(list);
    const saved = await getPref(db, "current_farm");
    const pick = list.find((f) => f.id === saved) ?? list.find((f) => !f.isDemo) ?? list[0];
    setFarmId(pick?.id ?? null);
    const map: Record<string, Role> = {};
    for (const f of list) {
      const r = (await getPref(db, `role:${f.id}`)) as Role | undefined;
      if (r) map[f.id] = r;
    }
    setRoles(map);
  }, [db]);

  useEffect(() => { refresh(); }, [refresh]);

  const selectFarm = useCallback(async (id: string) => {
    await setPref(db, "current_farm", id);
    await refresh();
  }, [db, refresh]);

  const farm = farmId === undefined ? undefined : farms.find((f) => f.id === farmId) ?? null;
  const roleOf = useCallback((id: string): Role => roles[id] ?? "dueno", [roles]);
  const role = farm ? roleOf(farm.id) : "dueno";
  const can = useCallback((table: SyncTable) => canWrite(role, table), [role]);
  return <FarmContext.Provider value={{ farm, farms, role, can, roleOf, selectFarm, refresh }}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmState {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used inside <FarmProvider>");
  return ctx;
}

/** The farm a screen works on: an explicit `farmId` param wins, otherwise the current farm. */
export function useFarmId(param?: string): string {
  const { farm } = useFarm();
  return param || farm?.id || "";
}
