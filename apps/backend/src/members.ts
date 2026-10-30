import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { canManageTeam, normalizePhone, ROLES, type Member, type MyFarm, type Role } from "@trazagro/shared";
import type { Db } from "./db";
import { farmRoles } from "./sync";

const Invite = z.object({ phone: z.string().min(7).max(20), role: z.enum(ROLES as [Role, ...Role[]]), fullName: z.string().max(80).optional() });
const Change = z.object({ role: z.enum(ROLES as [Role, ...Role[]]) });

/** Who works on each farm and with which role. Only the owner and administrators manage the team. */
export function memberRoutes(app: FastifyInstance, db: Db) {
  app.get("/me/farms", { onRequest: [app.authenticate] }, async (req) => {
    const res: MyFarm[] = [...(await farmRoles(db, req.user.sub))].map(([farmId, role]) => ({ farmId, role }));
    return res;
  });

  app.get<{ Params: { farmId: string } }>("/farms/:farmId/members", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await farmRoles(db, req.user.sub)).has(req.params.farmId)) return reply.code(403).send({ error: "No tienes acceso a esta finca" });
    const rows = await db.query<{ user_id: string; phone: string; full_name: string | null; role: Role }>(
      `SELECT m.user_id, u.phone, u.full_name, m.role FROM farm_members m JOIN users u ON u.id = m.user_id
       WHERE m.farm_id = $1 ORDER BY m.role = 'dueno' DESC, u.phone`, [req.params.farmId],
    );
    const res: Member[] = rows.map((r) => ({ userId: r.user_id, phone: r.phone, fullName: r.full_name ?? undefined, role: r.role }));
    return res;
  });

  app.post<{ Params: { farmId: string } }>("/farms/:farmId/members", { onRequest: [app.authenticate] }, async (req, reply) => {
    const me = (await farmRoles(db, req.user.sub)).get(req.params.farmId);
    if (!me || !canManageTeam(me)) return reply.code(403).send({ error: "Solo el dueño o un administrador pueden invitar" });
    const body = Invite.safeParse(req.body);
    const phone = body.success ? normalizePhone(body.data.phone) : undefined;
    if (!body.success || !phone) return reply.code(400).send({ error: "Escribe un celular colombiano válido" });
    if (body.data.role === "dueno") return reply.code(400).send({ error: "Cada finca tiene un solo dueño" });
    if (body.data.role === "administrador" && me !== "dueno") return reply.code(403).send({ error: "Solo el dueño nombra administradores" });
    // The person may not have an account yet: they get it the first time they log in with this phone.
    const [user] = await db.query<{ id: string }>(
      `INSERT INTO users (phone, full_name) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET full_name = COALESCE(users.full_name, EXCLUDED.full_name) RETURNING id`,
      [phone, body.data.fullName ?? null],
    );
    const [existing] = await db.query("SELECT 1 FROM farm_members WHERE farm_id = $1 AND user_id = $2", [req.params.farmId, user!.id]);
    if (existing) return reply.code(409).send({ error: "Esa persona ya está en la finca" });
    await db.query("INSERT INTO farm_members (farm_id, user_id, role) VALUES ($1, $2, $3)", [req.params.farmId, user!.id, body.data.role]);
    return { ok: true };
  });

  app.patch<{ Params: { farmId: string; userId: string } }>("/farms/:farmId/members/:userId", { onRequest: [app.authenticate] }, async (req, reply) => {
    const err = await guard(req.user.sub, req.params.farmId, req.params.userId);
    if (err) return reply.code(err.code).send({ error: err.error });
    const body = Change.safeParse(req.body);
    if (!body.success || body.data.role === "dueno") return reply.code(400).send({ error: "Rol no válido" });
    await db.query("UPDATE farm_members SET role = $3 WHERE farm_id = $1 AND user_id = $2", [req.params.farmId, req.params.userId, body.data.role]);
    return { ok: true };
  });

  app.delete<{ Params: { farmId: string; userId: string } }>("/farms/:farmId/members/:userId", { onRequest: [app.authenticate] }, async (req, reply) => {
    const err = await guard(req.user.sub, req.params.farmId, req.params.userId);
    if (err) return reply.code(err.code).send({ error: err.error });
    await db.query("DELETE FROM farm_members WHERE farm_id = $1 AND user_id = $2", [req.params.farmId, req.params.userId]);
    return { ok: true };
  });

  /** Changing or removing someone: needs team rights, never touches the owner, admins only by the owner. */
  async function guard(me: string, farmId: string, target: string): Promise<{ code: number; error: string } | undefined> {
    const myRole = (await farmRoles(db, me)).get(farmId);
    if (!myRole || !canManageTeam(myRole)) return { code: 403, error: "Solo el dueño o un administrador manejan el equipo" };
    const [row] = await db.query<{ role: Role }>("SELECT role FROM farm_members WHERE farm_id = $1 AND user_id = $2", [farmId, target]);
    if (!row) return { code: 404, error: "Esa persona no está en la finca" };
    if (row.role === "dueno") return { code: 403, error: "Al dueño no se le puede cambiar ni quitar" };
    if (row.role === "administrador" && myRole !== "dueno") return { code: 403, error: "Solo el dueño cambia a un administrador" };
    return undefined;
  }
}
