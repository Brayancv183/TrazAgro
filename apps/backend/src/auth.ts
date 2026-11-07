import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizePhone, type OtpRequestResponse, type OtpVerifyResponse } from "@trazagro/shared";
import type { Db } from "./db";
import { DEFAULT_LIMITS, fixedWindow, type RateLimits } from "./rateLimit";

export interface SmsSender {
  /** False when the code was not really sent (development); the code is then returned to the app. */
  readonly delivers: boolean;
  send(phone: string, text: string): Promise<void>;
}

/** Development sender: prints the code in the server console instead of sending an SMS. */
export const consoleSms: SmsSender = {
  delivers: false,
  async send(phone, text) {
    console.log(`[SMS → ${phone}] ${text}`);
  },
};

const CODE_TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;

const PhoneBody = z.object({ phone: z.string().min(7).max(20) });
const VerifyBody = PhoneBody.extend({ code: z.string().regex(/^\d{6}$/), fullName: z.string().max(80).optional() });

export function authRoutes(app: FastifyInstance, db: Db, sms: SmsSender, secret: string, limits: RateLimits = DEFAULT_LIMITS) {
  const requestLimit = fixedWindow(limits.otpRequest.max, limits.otpRequest.windowMs);
  const verifyLimit = fixedWindow(limits.otpVerify.max, limits.otpVerify.windowMs);
  const tooMany = (wait: number) => ({ error: `Demasiados intentos desde esta conexión. Intenta en ${Math.ceil(wait / 60)} minutos.` });
  const hash = (phone: string, code: string) => createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");

  app.post("/auth/otp/request", async (req, reply) => {
    const wait = requestLimit.hit(req.ip);
    if (wait) return reply.code(429).header("retry-after", String(wait)).send(tooMany(wait));
    const body = PhoneBody.safeParse(req.body);
    const phone = body.success ? normalizePhone(body.data.phone) : undefined;
    if (!phone) return reply.code(400).send({ error: "Número de celular no válido" });

    const [last] = await db.query<{ created_at: Date }>("SELECT created_at FROM otp_codes WHERE phone = $1", [phone]);
    if (last && Date.now() - new Date(last.created_at).getTime() < RESEND_AFTER_MS) {
      return reply.code(429).send({ error: "Espera un minuto para pedir otro código" });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.query(
      `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, created_at) VALUES ($1, $2, $3, 0, now())
       ON CONFLICT (phone) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = now()`,
      [phone, hash(phone, code), new Date(Date.now() + CODE_TTL_MS)],
    );
    await sms.send(phone, `Tu código de TrazAgro es ${code}. Vence en 5 minutos.`);
    const res: OtpRequestResponse = sms.delivers ? { ok: true } : { ok: true, devCode: code };
    return res;
  });

  app.post("/auth/otp/verify", async (req, reply) => {
    const wait = verifyLimit.hit(req.ip);
    if (wait) return reply.code(429).header("retry-after", String(wait)).send(tooMany(wait));
    const body = VerifyBody.safeParse(req.body);
    const phone = body.success ? normalizePhone(body.data.phone) : undefined;
    if (!body.success || !phone) return reply.code(400).send({ error: "Datos no válidos" });

    const [row] = await db.query<{ code_hash: string; expires_at: Date; attempts: number }>(
      "SELECT code_hash, expires_at, attempts FROM otp_codes WHERE phone = $1", [phone],
    );
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return reply.code(401).send({ error: "El código venció. Pide uno nuevo." });
    if (row.attempts >= MAX_ATTEMPTS) return reply.code(429).send({ error: "Demasiados intentos. Pide un código nuevo." });

    const ok = timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash(phone, body.data.code)));
    if (!ok) {
      await db.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1", [phone]);
      return reply.code(401).send({ error: "Código incorrecto" });
    }
    await db.query("DELETE FROM otp_codes WHERE phone = $1", [phone]);
    const [user] = await db.query<{ id: string; phone: string; full_name: string | null }>(
      `INSERT INTO users (phone, full_name) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET full_name = COALESCE(users.full_name, EXCLUDED.full_name)
       RETURNING id, phone, full_name`,
      [phone, body.data.fullName ?? null],
    );
    const res: OtpVerifyResponse = {
      token: app.jwt.sign({ sub: user!.id, phone }, { expiresIn: "30d" }),
      user: { id: user!.id, phone: user!.phone, fullName: user!.full_name ?? undefined },
    };
    return res;
  });
}
