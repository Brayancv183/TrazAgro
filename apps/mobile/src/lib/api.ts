import type { Member, MyFarm, OtpRequestResponse, OtpVerifyResponse, PullResponse, PushResponse, Role, SyncChange } from "@trazagro/shared";

/** Server address. Set EXPO_PUBLIC_API_URL for a phone on the same Wi-Fi or for the deployed server. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string; device?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      // Fastify refuses an empty body declared as JSON, so the header only goes with a body.
      headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.device ? { "x-device-id": init.device } : {}) },
    });
  } catch {
    throw new ApiError(0, "Sin conexión con el servidor");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? "Error del servidor");
  return body as T;
}

export const api = {
  requestCode: (phone: string) => call<OtpRequestResponse>("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyCode: (phone: string, code: string) => call<OtpVerifyResponse>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) }),
  push: (token: string, changes: SyncChange[], device?: string) => call<PushResponse>("/sync/push", { method: "POST", token, device, body: JSON.stringify({ changes }) }),
  pull: (token: string, since: number, device?: string) => call<PullResponse>(`/sync/pull?since=${since}`, { token, device }),
  myFarms: (token: string) => call<MyFarm[]>("/me/farms", { token }),
  members: (token: string, farmId: string) => call<Member[]>(`/farms/${encodeURIComponent(farmId)}/members`, { token }),
  invite: (token: string, farmId: string, phone: string, role: Role, fullName?: string) =>
    call<{ ok: true }>(`/farms/${encodeURIComponent(farmId)}/members`, { method: "POST", token, body: JSON.stringify({ phone, role, fullName }) }),
  changeRole: (token: string, farmId: string, userId: string, role: Role) =>
    call<{ ok: true }>(`/farms/${encodeURIComponent(farmId)}/members/${userId}`, { method: "PATCH", token, body: JSON.stringify({ role }) }),
  vetAsk: (token: string, messages: { role: "user" | "assistant"; content: string }[]) =>
    call<{ answer: string }>("/vet/ask", { method: "POST", token, body: JSON.stringify({ messages }) }),
  removeMember: (token: string, farmId: string, userId: string) =>
    call<{ ok: true }>(`/farms/${encodeURIComponent(farmId)}/members/${userId}`, { method: "DELETE", token }),
};
