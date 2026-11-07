import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { authRoutes, type SmsSender } from "./auth";
import type { Db } from "./db";
import type { RateLimits } from "./rateLimit";
import { memberRoutes } from "./members";
import { vetRoutes } from "./vet";
import { syncRoutes } from "./sync";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; phone: string };
    user: { sub: string; phone: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AppOptions {
  db: Db;
  sms: SmsSender;
  jwtSecret: string;
  logger?: boolean;
  /** Login rate limits per IP (defaults in rateLimit.ts). */
  limits?: RateLimits;
  /** Behind a proxy (Railway, Nginx) set true so req.ip is the client's, not the proxy's. */
  trustProxy?: boolean;
}

export async function buildApp({ db, sms, jwtSecret, logger = false, limits, trustProxy = false }: AppOptions) {
  const app = Fastify({ logger, bodyLimit: 5 * 1024 * 1024, trustProxy });
  await app.register(cors, { origin: true, methods: ["GET", "POST", "PATCH", "DELETE"] });
  await app.register(jwt, { secret: jwtSecret });
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "Inicia sesión de nuevo" });
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "trazagro-backend" }));
  authRoutes(app, db, sms, jwtSecret, limits);
  syncRoutes(app, db);
  memberRoutes(app, db);
  vetRoutes(app);
  return app;
}
