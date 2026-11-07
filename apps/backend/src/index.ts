import { buildApp } from "./app";
import { DEFAULT_LIMITS } from "./rateLimit";
import { consoleSms } from "./auth";
import { embeddedDb, migrate, postgresDb } from "./db";

const production = process.env.NODE_ENV === "production";
const secret = process.env.JWT_SECRET ?? (production ? undefined : "solo-para-desarrollo");
if (!secret) throw new Error("Falta JWT_SECRET");
if (production && !process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
// No SMS provider yet: in production that would leave people unable to log in, so refuse to start.
if (production) throw new Error("Configura un proveedor de SMS antes de desplegar en producción");

const db = process.env.DATABASE_URL ? postgresDb(process.env.DATABASE_URL) : await embeddedDb(process.env.PGLITE_DIR ?? "./.data");
await migrate(db);

// Development runs many logins from localhost (tests, several tabs): only production uses the strict limits.
const limits = process.env.NODE_ENV === "production" ? DEFAULT_LIMITS
  : { otpRequest: { max: 500, windowMs: 15 * 60_000 }, otpVerify: { max: 1000, windowMs: 15 * 60_000 } };
const app = await buildApp({ db, sms: consoleSms, jwtSecret: secret, logger: true, limits, trustProxy: process.env.TRUST_PROXY === "1" });
const port = Number(process.env.PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
