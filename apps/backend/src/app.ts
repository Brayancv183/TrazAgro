import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { authRoutes, type SmsSender } from "./auth";
import type { Db } from "./db";
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
}

export async function buildApp({ db, sms, jwtSecret, logger = false }: AppOptions) {
  const app = Fastify({ logger, bodyLimit: 5 * 1024 * 1024 });
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
  authRoutes(app, db, sms, jwtSecret);
  syncRoutes(app, db);
  memberRoutes(app, db);
  vetRoutes(app);
  return app;
}
