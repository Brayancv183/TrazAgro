import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";

/**
 * Loads data from the local database and reloads it every time the screen comes into focus.
 * Call `reload()` after a write that happens without leaving the screen.
 */
export function useDbQuery<T>(load: (db: SQLiteDatabase) => Promise<T>, deps: unknown[]) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [version, setVersion] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load(db).then((d) => alive && setData(d)).catch((e) => alive && setError(e));
      return () => { alive = false; };
      // The caller passes the deps of `load`, so the list is built here on purpose.
      // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
    }, [db, version, ...deps]),
  );
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}
