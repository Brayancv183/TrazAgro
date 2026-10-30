import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { SessionUser } from "@trazagro/shared";

const KEY = "trazagro.session";

export interface Session {
  token: string;
  user: SessionUser;
}

// SecureStore (Keychain / Keystore) on phones; it has no web version, so the web preview uses localStorage.
const store = Platform.OS === "web"
  ? {
      get: async () => globalThis.localStorage?.getItem(KEY) ?? null,
      set: async (v: string) => globalThis.localStorage?.setItem(KEY, v),
      del: async () => globalThis.localStorage?.removeItem(KEY),
    }
  : {
      get: () => SecureStore.getItemAsync(KEY),
      set: (v: string) => SecureStore.setItemAsync(KEY, v),
      del: () => SecureStore.deleteItemAsync(KEY),
    };

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await store.get();
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export const saveSession = (s: Session) => store.set(JSON.stringify(s));
export const clearSession = () => store.del();
