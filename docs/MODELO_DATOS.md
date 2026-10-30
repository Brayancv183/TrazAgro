# Modelo de datos y sincronización

TrazAgro funciona primero en el celular (offline-first). Todo se guarda en una base SQLite local y se sube al servidor cuando hay señal. Este documento fija las reglas para que eso funcione sin perder datos.

## Tablas (Fase 1)

| Tabla | Qué guarda | Notas |
|---|---|---|
| `farms` | Fincas | Una persona puede tener varias |
| `lots` | Lotes o potreros de una finca | |
| `animals` | Cada animal | `tag_visual` (arete DIN) y `rfid` (chip): la app no deja repetirlos entre animales activos; si dos celulares sin señal usan el mismo, se guardan ambos y sale la alerta "Arete repetido". Estado `trasladado` cuando pasa a otra finca propia |
| `events` | Todo lo que le pasa a un animal | **Solo se agregan, nunca se editan.** Tipos: vacuna, tratamiento, desparasitacion, pesaje, parto, servicio, diagnostico (palpación), secado, traslado (cambio de lote), baja, nota, reporte_ica |
| `milk` | Litros de leche por vaca o del tanque | Solo se agregan, como los eventos |
| `products` | Inventario: vacunas, medicinas, insumos | Lleva los días de retiro de leche y carne |
| `movements` | Contabilidad: ingresos y gastos | Una venta crea su ingreso automáticamente |
| `sync_outbox` | Cambios pendientes por subir | Se vacía cuando el servidor confirma |
| `sync_state` / `prefs` | Cursor de sincronización, cambios rechazados; finca actual, rol por finca, finca de prueba oculta, autorización Ley 1581 | Solo en el celular |

Los tipos están en `packages/shared/src/domain.ts` y las reglas de negocio en `packages/shared/src/rules.ts` (con pruebas en `rules.test.ts`).

## Reglas de sincronización

1. **IDs generados en el celular.** Todo registro nace con un UUID creado en el teléfono, así se puede crear sin señal y no choca con lo que crean otros.
2. **Los eventos solo se agregan.** Vacunas, tratamientos, pesajes, partos y bajas nunca se editan: una corrección es un evento nuevo que anula al anterior. Como dos personas sin señal solo agregan, no hay conflictos al sincronizar.
3. **Datos del animal (nombre, lote, raza): gana el último cambio.** Cada campo lleva su `updated_at`. Al sincronizar se queda el más reciente, y el cambio que pierde queda en el historial.
4. **Bandeja de salida.** Cada cambio local también se escribe en `sync_outbox` dentro de la misma transacción. El sincronizador sube la bandeja en orden y borra lo que el servidor confirma. Si se cae la señal a mitad de camino, se reintenta sin duplicar, porque el servidor ignora IDs que ya tiene.
5. **Inventario.** El stock no se edita directamente: se calcula a partir de compras y aplicaciones, que son eventos. Así dos aplicaciones simultáneas sin señal descuentan bien.

## Reglas de negocio ya programadas

- **Días de retiro:** cada producto aplicado suma sus días de retiro de leche y carne desde la fecha de aplicación; manda la fecha más lejana.
- **Salida de la finca:** el sacrificio o la venta para carne quedan **bloqueados** durante el retiro de carne. La venta para cría se permite, pero obliga a avisar al comprador.
- **Categoría:** ternera/ternero (menos de 12 meses), novilla (hembra sin partos), vaca (con partos), novillo (12 a 24 meses), toro (24 meses o más). Cambia sola con la edad.
- **Peso:** último pesaje y ganancia diaria entre los dos últimos.
- **Bajas:** una venta, muerte, sacrificio o pérdida es un evento `baja` y cambia el estado del animal; una venta con precio anota su ingreso en Costos.
- **Novedades ICA:** nacimientos, ingresos (compras después del inventario inicial) y salidas de los últimos 90 días. "Ya lo reporté" guarda un evento `reporte_ica`, así queda constancia y se sincroniza.
- **Reproducción:** vacía → servida (palpar a los 45 días) → preñada (parto esperado a los 283 días del servicio, secar 60 días antes) → recién parida. Reglas en `packages/shared/src/herd.ts`.
- **Agenda:** palpaciones, partos, secados, revacunas (6 meses), pesajes (60 días), fin de retiros y vencimientos de los próximos 45 días.
- **Métricas:** natalidad, mortalidad, ganancia de peso, intervalo entre partos, utilidad por animal al mes y costo por litro.
- **Traslado entre fincas propias:** el animal sale de la finca de origen (estado `trasladado`) y nace un registro nuevo en la de destino con los mismos aretes.
- **Alertas:** animales en retiro, productos vencidos o por vencer (30 días), productos agotados, animales sin arete, animales sin pesar en 60 días y novedades ICA pendientes. Reglas en `packages/shared/src/farm.ts`.

## Datos de prueba

Mientras no hay datos reales, la app arranca con una finca de ejemplo ("Finca La Esperanza", Pitalito) que se crea sola la primera vez (`apps/mobile/src/db/seed.ts`). La finca de ejemplo convive con las reales pero nunca se sincroniza: sus registros no pasan por `sync_outbox` (están marcados con `is_demo`). Se puede ocultar en Ajustes cuando ya hay una finca real.

## Servidor (Sprint 3)

`apps/backend` — Fastify + Postgres. En desarrollo usa **PGlite** (Postgres embebido, sin instalar nada; los datos quedan en `apps/backend/.data/`). En producción se conecta a Neon con `DATABASE_URL`.

| Ruta | Qué hace |
|---|---|
| `POST /auth/otp/request` | Envía un código de 6 dígitos al celular (vence en 5 min; uno por minuto). En desarrollo el código se muestra en la consola y en la app. |
| `POST /auth/otp/verify` | Cambia el código por una sesión (JWT de 30 días). 5 intentos como máximo. |
| `POST /sync/push` | Recibe cambios de la bandeja de salida. Responde cuáles aceptó y cuáles rechazó (por ejemplo, una finca ajena). |
| `GET /sync/pull?since=N` | Devuelve lo nuevo de las fincas del usuario desde el cursor `N`, de a 500. |
| `GET /me/farms` | Fincas del usuario con su rol. Si aparece una finca nueva (lo invitaron), la app vuelve a bajar todo. |
| `GET/POST /farms/:id/members` | Ver el equipo / invitar por celular con un rol. |
| `PATCH/DELETE /farms/:id/members/:userId` | Cambiar el rol o quitar a alguien. Al dueño no se le toca; solo el dueño maneja administradores. |
| `POST /vet/ask` | VetConecta: pregunta al asistente veterinario (Claude). Necesita `ANTHROPIC_API_KEY`. |

Quien sube una finca nueva queda como su **dueño**. Nadie puede leer ni escribir en fincas de las que no es miembro. Al subir cambios el servidor revisa el rol: el técnico escribe animales, eventos, inventario, leche y lotes; el vaquero animales, eventos y leche; "solo ver" no escribe. La plata (`movements`) y los datos de la finca solo los cambian dueño y administrador.

**Pendiente antes de producción:** contratar un proveedor de SMS (el servidor se niega a arrancar en producción sin él), limitar pedidos de código por IP y desplegar en Railway + Neon.

### Correr en desarrollo

```bash
pnpm --filter @trazagro/backend dev
pnpm --filter @trazagro/mobile exec expo start --web
```

Para probar en un celular en la misma red Wi-Fi, define `EXPO_PUBLIC_API_URL=http://<IP-de-tu-PC>:4000` antes de `expo start`.
