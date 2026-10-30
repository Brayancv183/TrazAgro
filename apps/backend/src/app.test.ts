import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PullResponse, PushResponse, SyncChange } from "@trazagro/shared";
import { buildApp } from "./app";
import type { SmsSender } from "./auth";
import { embeddedDb, migrate, type Db } from "./db";

let db: Db;
let app: FastifyInstance;
const sent: { phone: string; text: string }[] = [];
const sms: SmsSender = { delivers: false, send: async (phone, text) => { sent.push({ phone, text }); } };

beforeEach(async () => {
  sent.length = 0;
  db = await embeddedDb();
  await migrate(db);
  app = await buildApp({ db, sms, jwtSecret: "test-secret" });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

async function login(phone: string) {
  const req = await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone } });
  const { devCode } = req.json();
  const res = await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone, code: devCode } });
  return res.json().token as string;
}

const push = (token: string, changes: SyncChange[]) =>
  app.inject({ method: "POST", url: "/sync/push", headers: { authorization: `Bearer ${token}` }, payload: { changes } });
const pull = (token: string, since = 0) =>
  app.inject({ method: "GET", url: `/sync/pull?since=${since}`, headers: { authorization: `Bearer ${token}` } });

const farm = (id: string, updatedAt = "2026-10-30T10:00:00Z"): SyncChange =>
  ({ table: "farms", id, payload: { id, name: "Finca Prueba", municipality: "Neiva", department: "Huila", createdAt: updatedAt, updatedAt } });
const animal = (id: string, farmId: string, name: string, updatedAt: string): SyncChange =>
  ({ table: "animals", id, payload: { id, farmId, name, sex: "hembra", birthDate: "2024-01-01", origin: "nacido", status: "activo", createdAt: "2026-10-01T00:00:00Z", updatedAt } });
const event = (id: string, farmId: string, notes: string): SyncChange =>
  ({ table: "events", id, payload: { id, farmId, animalId: "a1", type: "nota", date: "2026-10-30", notes, createdAt: "2026-10-30T10:00:00Z" } });

describe("login por SMS", () => {
  it("sends a code and exchanges it for a session", async () => {
    const req = await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "315 444 0099" } });
    expect(req.statusCode).toBe(200);
    expect(sent[0]!.phone).toBe("+573154440099");
    expect(sent[0]!.text).toContain(req.json().devCode);
    const res = await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "3154440099", code: req.json().devCode } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.phone).toBe("+573154440099");
    expect(res.json().token).toBeTruthy();
  });

  it("rejects a wrong code and a reused code", async () => {
    const { devCode } = (await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "3154440099" } })).json();
    const wrong = devCode === "000000" ? "111111" : "000000";
    expect((await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "3154440099", code: wrong } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "3154440099", code: devCode } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "3154440099", code: devCode } })).statusCode).toBe(401);
  });

  it("locks the code after five wrong attempts", async () => {
    const { devCode } = (await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "3154440099" } })).json();
    const wrong = devCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "3154440099", code: wrong } });
    expect((await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "3154440099", code: devCode } })).statusCode).toBe(429);
  });

  it("refuses invalid numbers and a second code within a minute", async () => {
    expect((await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "8712345" } })).statusCode).toBe(400);
    await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "3154440099" } });
    expect((await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "3154440099" } })).statusCode).toBe(429);
  });

  it("requires a session for sync", async () => {
    expect((await app.inject({ method: "GET", url: "/sync/pull" })).statusCode).toBe(401);
    expect((await pull("not-a-token")).statusCode).toBe(401);
  });
});

describe("sincronización", () => {
  it("stores a farm with its animals and returns them on pull", async () => {
    const token = await login("3154440099");
    const res = await push(token, [animal("a1", "f1", "Miel", "2026-10-30T10:00:00Z"), farm("f1")]);
    expect(res.json<PushResponse>()).toEqual({ accepted: ["f1", "a1"], rejected: [] });
    const p = (await pull(token)).json<PullResponse>();
    expect(p.changes.map((c) => c.id)).toEqual(["f1", "a1"]);
    expect(p.more).toBe(false);
  });

  it("is idempotent: pushing the same event twice keeps one copy", async () => {
    const token = await login("3154440099");
    await push(token, [farm("f1"), event("e1", "f1", "primera")]);
    const again = await push(token, [event("e1", "f1", "cambiada")]);
    expect(again.json<PushResponse>().accepted).toEqual(["e1"]);
    const events = (await pull(token)).json<PullResponse>().changes.filter((c) => c.table === "events");
    expect(events).toHaveLength(1);
    expect(events[0]!.payload.notes).toBe("primera");
  });

  it("keeps the newest edit of an animal (last write wins)", async () => {
    const token = await login("3154440099");
    await push(token, [farm("f1"), animal("a1", "f1", "Miel", "2026-10-30T10:00:00Z")]);
    await push(token, [animal("a1", "f1", "Miel vieja", "2026-10-30T09:00:00Z")]);
    await push(token, [animal("a1", "f1", "Miel nueva", "2026-10-30T11:00:00Z")]);
    const a = (await pull(token)).json<PullResponse>().changes.find((c) => c.id === "a1");
    expect(a!.payload.name).toBe("Miel nueva");
  });

  it("pulls only what changed since the cursor", async () => {
    const token = await login("3154440099");
    await push(token, [farm("f1")]);
    const first = (await pull(token)).json<PullResponse>();
    await push(token, [event("e2", "f1", "nueva")]);
    const second = (await pull(token, first.cursor)).json<PullResponse>();
    expect(second.changes.map((c) => c.id)).toEqual(["e2"]);
  });

  it("does not let a user write to or read another person's farm", async () => {
    const owner = await login("3154440099");
    const other = await login("3001112233");
    await push(owner, [farm("f1")]);
    const res = (await push(other, [animal("a9", "f1", "Intrusa", "2026-10-30T12:00:00Z"), farm("f1", "2026-10-31T00:00:00Z")])).json<PushResponse>();
    expect(res.accepted).toEqual([]);
    expect(res.rejected.map((r) => r.id).sort()).toEqual(["a9", "f1"]);
    expect((await pull(other)).json<PullResponse>().changes).toEqual([]);
  });

  it("rejects a change whose payload id doesn't match", async () => {
    const token = await login("3154440099");
    const bad: SyncChange = { table: "farms", id: "f1", payload: { id: "otra" } };
    expect((await push(token, [bad])).json<PushResponse>().rejected[0]!.reason).toMatch(/id/);
  });
});

describe("equipo y permisos", () => {
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  it("the owner invites a cowhand who then sees the farm but can't touch the money", async () => {
    const owner = await login("3001112233");
    await push(owner, [farm("f1"), animal("a1", "f1", "Lola", "2026-10-30T10:00:00Z")]);
    const inv = await app.inject({ method: "POST", url: "/farms/f1/members", headers: auth(owner), payload: { phone: "310 555 0000", role: "vaquero" } });
    expect(inv.statusCode).toBe(200);

    const cowhand = await login("3105550000");
    expect((await app.inject({ method: "GET", url: "/me/farms", headers: auth(cowhand) })).json()).toEqual([{ farmId: "f1", role: "vaquero" }]);
    expect((await pull(cowhand)).json().changes.map((c: SyncChange) => c.id)).toEqual(["f1", "a1"]);

    const money: SyncChange = { table: "movements", id: "m1", payload: { id: "m1", farmId: "f1", kind: "gasto", category: "Sal", amount: 1, date: "2026-10-30", description: "", createdAt: "2026-10-30T10:00:00Z" } };
    const res = (await push(cowhand, [event("e1", "f1", "Vacunada"), money])).json() as PushResponse;
    expect(res.accepted).toEqual(["e1"]);
    expect(res.rejected[0]!.reason).toContain("Vaquero");

    const members = (await app.inject({ method: "GET", url: "/farms/f1/members", headers: auth(cowhand) })).json();
    expect(members.map((m: { role: string }) => m.role)).toEqual(["dueno", "vaquero"]);
    expect((await app.inject({ method: "POST", url: "/farms/f1/members", headers: auth(cowhand), payload: { phone: "3209990000", role: "vaquero" } })).statusCode).toBe(403);
  });

  it("protects the owner and lets the owner change or remove others", async () => {
    const owner = await login("3001112233");
    await push(owner, [farm("f1")]);
    await app.inject({ method: "POST", url: "/farms/f1/members", headers: auth(owner), payload: { phone: "3105550000", role: "administrador" } });
    const admin = await login("3105550000");
    const list = (await app.inject({ method: "GET", url: "/farms/f1/members", headers: auth(admin) })).json() as { userId: string; role: string }[];
    const ownerId = list.find((m) => m.role === "dueno")!.userId;
    const adminId = list.find((m) => m.role === "administrador")!.userId;
    expect((await app.inject({ method: "DELETE", url: `/farms/f1/members/${ownerId}`, headers: auth(admin) })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/farms/f1/members", headers: auth(owner), payload: { phone: "3105550000", role: "vaquero" } })).statusCode).toBe(409);
    expect((await app.inject({ method: "PATCH", url: `/farms/f1/members/${adminId}`, headers: auth(owner), payload: { role: "solo_ver" } })).statusCode).toBe(200);
    const readOnly = (await push(admin, [animal("a9", "f1", "X", "2026-10-30T10:00:00Z")])).json() as PushResponse;
    expect(readOnly.rejected).toHaveLength(1);
    expect((await app.inject({ method: "DELETE", url: `/farms/f1/members/${adminId}`, headers: auth(owner) })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/me/farms", headers: auth(admin) })).json()).toEqual([]);
  });
});

describe("VetConecta", () => {
  it("answers 503 when the server has no Claude key, and requires a session", async () => {
    expect((await app.inject({ method: "POST", url: "/vet/ask", payload: { messages: [{ role: "user", content: "hola" }] } })).statusCode).toBe(401);
    const token = await login("3001112233");
    const res = await app.inject({ method: "POST", url: "/vet/ask", headers: { authorization: `Bearer ${token}` }, payload: { messages: [{ role: "user", content: "hola" }] } });
    expect(process.env.ANTHROPIC_API_KEY ? [200, 502] : [503]).toContain(res.statusCode);
  });
});
