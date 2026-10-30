import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { APPEND_ONLY, canWrite, isNewer, ROLE_LABEL, SYNC_TABLES, type PullResponse, type PushResponse, type Role, type SyncChange } from "@trazagro/shared";
import type { Db } from "./db";

const PAGE = 500;

const Change = z.object({
  table: z.enum(SYNC_TABLES),
  id: z.string().min(1).max(64),
  payload: z.record(z.unknown()),
});
const PushBody = z.object({ changes: z.array(Change).max(1000) });
const PullQuery = z.object({ since: z.coerce.number().int().min(0).default(0) });

/** The user's farms with their role in each. */
export async function farmRoles(db: Db, userId: string): Promise<Map<string, Role>> {
  const rows = await db.query<{ farm_id: string; role: Role }>("SELECT farm_id, role FROM farm_members WHERE user_id = $1", [userId]);
  return new Map(rows.map((r) => [r.farm_id, r.role]));
}

/** Applies one change. Returns a rejection reason, or undefined when stored or already present. */
async function apply(db: Db, userId: string, mine: Map<string, Role>, c: SyncChange): Promise<string | undefined> {
  if (c.payload.id !== c.id) return "El id no coincide con el registro";
  const farmId = c.table === "farms" ? c.id : String(c.payload.farmId ?? "");
  if (!farmId) return "Falta farmId";

  const [existing] = await db.query<{ payload: Record<string, unknown>; farm_id: string }>(
    "SELECT payload, farm_id FROM records WHERE table_name = $1 AND id = $2", [c.table, c.id],
  );

  if (c.table === "farms" && !existing) {
    // Whoever creates a farm owns it.
    await db.query("INSERT INTO farm_members (farm_id, user_id, role) VALUES ($1, $2, 'dueno') ON CONFLICT DO NOTHING", [farmId, userId]);
    mine.set(farmId, "dueno");
  }
  const role = mine.get(farmId);
  if (!role) return "No tienes acceso a esta finca";
  if (!canWrite(role, c.table)) return `Tu rol (${ROLE_LABEL[role]}) no permite este cambio`;
  if (existing && existing.farm_id !== farmId) return "El registro pertenece a otra finca";

  if (existing && (APPEND_ONLY.has(c.table) || !isNewer(c.payload, existing.payload))) return undefined;
  await db.query(
    `INSERT INTO records (table_name, id, farm_id, payload) VALUES ($1, $2, $3, $4)
     ON CONFLICT (table_name, id) DO UPDATE SET payload = EXCLUDED.payload, seq = nextval('change_seq'), received_at = now()`,
    [c.table, c.id, farmId, JSON.stringify(c.payload)],
  );
  return undefined;
}

export function syncRoutes(app: FastifyInstance, db: Db) {
  app.post("/sync/push", { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = PushBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Cambios no válidos" });
    const userId = req.user.sub;
    const res: PushResponse = { accepted: [], rejected: [] };
    await db.tx(async (t) => {
      const mine = await farmRoles(t, userId);
      // Farms first so their lots, animals and events in the same batch are allowed.
      const ordered = [...body.data.changes].sort((a, b) => SYNC_TABLES.indexOf(a.table) - SYNC_TABLES.indexOf(b.table));
      for (const c of ordered) {
        const reason = await apply(t, userId, mine, c as SyncChange);
        if (reason) res.rejected.push({ id: c.id, reason });
        else res.accepted.push(c.id);
      }
    });
    return res;
  });

  app.get("/sync/pull", { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = PullQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "Parámetro since no válido" });
    const mine = [...(await farmRoles(db, req.user.sub)).keys()];
    if (!mine.length) return { changes: [], cursor: q.data.since, more: false } satisfies PullResponse;
    const rows = await db.query<{ table_name: SyncChange["table"]; id: string; payload: Record<string, unknown>; seq: string }>(
      `SELECT table_name, id, payload, seq FROM records WHERE farm_id = ANY($1) AND seq > $2 ORDER BY seq LIMIT $3`,
      [mine, q.data.since, PAGE + 1],
    );
    const page = rows.slice(0, PAGE);
    const res: PullResponse = {
      changes: page.map((r) => ({ table: r.table_name, id: r.id, payload: r.payload })),
      cursor: page.length ? Number(page[page.length - 1]!.seq) : q.data.since,
      more: rows.length > PAGE,
    };
    return res;
  });
}
