import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const SYSTEM = `Eres VetConecta, el asistente veterinario de TrazAgro para ganaderos de Colombia (bovinos de leche, carne y doble propósito).
Responde en español sencillo, como le hablarías a un finquero: frases cortas, pasos concretos, sin tecnicismos innecesarios.
- Orienta sobre manejo, sanidad, reproducción, nutrición y días de retiro de leche y carne. Recuerda que los días de retiro los fija la etiqueta del producto.
- Ten en cuenta el calendario y las normas del ICA (aftosa, brucelosis, registro de novedades en SINIGAN).
- No reemplazas al veterinario. Si hay señales de urgencia (animal caído, sangrado, dificultad para respirar, parto que no avanza, fiebre alta, varios animales enfermos o muertos de golpe), di primero que llame a un veterinario ya.
- No des dosis exactas de medicamentos de prescripción: indica el tipo de tratamiento y que el veterinario defina la dosis.
- Si no sabes o falta información, pregunta lo necesario (edad, síntomas, desde cuándo, qué se le aplicó).`;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).min(1).max(20),
});

/**
 * VetConecta: a veterinary assistant backed by Claude. Needs ANTHROPIC_API_KEY on the server;
 * without it the endpoint answers 503 and the app explains that the service is not active yet.
 */
export function vetRoutes(app: FastifyInstance) {
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : undefined;

  app.post("/vet/ask", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!client) return reply.code(503).send({ error: "VetConecta todavía no está activo en este servidor" });
    const body = Body.safeParse(req.body);
    if (!body.success || body.data.messages[0]!.role !== "user") return reply.code(400).send({ error: "Pregunta no válida" });
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: body.data.messages.slice(-12),
      });
      if (response.stop_reason === "refusal") {
        return { answer: "No puedo ayudarte con esa pregunta. Para este caso consulta directamente a un veterinario." };
      }
      const answer = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return { answer: answer || "No tengo una respuesta ahora. Intenta preguntar de otra forma." };
    } catch (e) {
      req.log.error(e);
      if (e instanceof Anthropic.RateLimitError) return reply.code(429).send({ error: "VetConecta está ocupado. Intenta en un minuto." });
      if (e instanceof Anthropic.AuthenticationError) return reply.code(503).send({ error: "VetConecta no está bien configurado en el servidor" });
      return reply.code(502).send({ error: "VetConecta no respondió. Intenta de nuevo." });
    }
  });
}
