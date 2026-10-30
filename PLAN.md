# TRAZAGRO — Plan completo de especificaciones (v1.0)

*Documento consolidado con todas las decisiones tomadas. Sirve como base del plan del Fondo Emprender y como guía de construcción.*

---

## 1. Resumen del negocio

| Campo | Definición |
|---|---|
| **Producto** | Plataforma de gestión ganadera individual (app offline-first) + reventa de hardware de identificación y rastreo (RFID/LoRa/GPS) |
| **Cliente** | Ganadero pequeño-mediano (20-500 cabezas) vía **canal gremio** (Comité de Ganaderos Huila) |
| **Proyecto** | Fondo Emprender SENA — hasta 80 SMLMV, 4 fases de 12 meses |
| **Nombre** | TrazAgro (verificar antecedentes en SIC antes de registrar) |
| **Diferencial** | Offline-first en español + $0 de mensualidad de conectividad + canal gremial + complemento SNIITA/ICA + drones + malla Meshtastic (I+D) |
| **Competencia** | Identigan (lectores + app gratis ≤50 animales, sin GPS ni gremio) — reposicionar en el plan |

## 2. Stack tecnológico (decidido)

| Capa | Elección |
|---|---|
| **App móvil** | React Native + **Expo SDK 58** (RN 0.88), TypeScript |
| **Offline** | **expo-sqlite** local + sync propia con backend |
| **UI** | Componentes propios (NativeWind opcional); verde agro + tierra |
| **Backend** | Node.js + TypeScript, API REST, **Prisma + PostgreSQL (Neon)** |
| **Auth** | OTP por teléfono + email | 
| **Monorepo** | **pnpm + Turborepo**: `apps/mobile`, `apps/backend`, `apps/admin` (posterior), `packages/shared` |
| **Infra** | Railway (API), Neon (BD), dominio `.com`, GitHub |
| **Push** | Expo Notifications (nativa) |
| **Mapas** | MapLibre GL + OpenStreetMap (offline-friendly) |
| **Multi-tenant** | Sí, desde el inicio (finca como unidad) |

## 3. Roles

Roles dentro de cada finca (permisos ajustables por persona):

1. **Dueño** — todo, incluidos pagos y quién entra a la finca
2. **Administrador o mayordomo** — todo menos pagos y usuarios
3. **Técnico de campo** — salud, pesajes y reportes de las fincas asignadas
4. **Vaquero** — registra eventos y pesajes; no ve costos
5. **Solo ver** — consulta fichas y alertas sin cambiar nada

Además, **super-admin** (Brayan) a nivel de plataforma: suscripciones, afiliados, métricas globales.

## 4. Módulos (23 diseñados)

Los 21 originales: Dashboard de finca · Animales (fichas) · Salud e historial clínico · Reproducción y crías · Pesajes y crecimiento · Lotes y ubicación · Alertas in-app + push · Reportes exportables · Usuarios y permisos · Suscripción y pagos · Módulo drones (agenda + entrega de resultados) · Inventario de insumos/vacunas · Agenda y calendario sanitario · Costos y rentabilidad · Métricas del hato · Días de espera (carne/leche) · Fotos documentales por evento · Mapa GPS de lotes · QR imprimible por animal · Multi-finca por usuario · Importar/exportar datos · Integra VetConecta Rural (fase 2-3).

Agregados en el diseño: **Tienda virtual** (aretes, insumos, recompra) y **Transferencia de animales** entre usuarios al vender. Peso estimado por foto y asistente IA de VetConecta quedan para fase 2-3.

**Alcance de la Fase 1 (lo que se programa primero):** inicio de sesión por SMS, fincas, animales, nuevo animal con arete, ficha, registro de vacuna/tratamiento/pesaje manual/parto, días de retiro automáticos (con bloqueo de venta o sacrificio), alertas básicas y reporte ICA. Modelo de datos y sincronización: `docs/MODELO_DATOS.md`.

**Excluido del MVP (decidido):** WhatsApp (fase 2+), pagos Wompi (fase 2), GPS/geocercas y temperatura (fase 2), tienda, IA, drones y modo noche (fase 3+).

## 5. Roadmap en 4 fases (12 meses)

| Fase | Meses | Contenido |
|---|---|---|
| **Fase 1 — MVP + validación** | 1-3 | Monorepo + app offline-first core (finca, animales, salud, QR, alertas, reportes) + backend + auth · **Prototipo Meshtastic (2-3 placas <USD $200)** · Muestras de hardware (RFID + 2-3 GPS LoRa) · **Piloto en 2 fincas aliadas (60 días)** |
| **Fase 2 — Rastreo + ingresos** | 4-6 | Integración GPS LoRaWAN (MQTT/API a TrazAgro) + mapa y geocerca · NFC en arete · Pagos Wompi/PSE/Nequi · Planes de suscripción en vivo · SNIITA/ICA (inicio) · **Primeras ventas: 10 kits vía gremio** |
| **Fase 3 — Profundización** | 7-9 | Módulos avanzados: reproducción, pesajes, costos, días de espera, drones, inventario, agenda · **Acelerómetro: celo + animal inmóvil/muerto** · SNIITA/ICA completo · **Convenio con el ICA para enviar novedades directo a SINIGAN V6 (hoy solo por sinigan.co o su app; no hay API pública)** · WhatsApp · Escala a ~30 fincas |
| **Fase 4 — Diferenciación** | 10-12 | Ambiental de establo (si hay demanda lechera) · I+D analítica acústica ML · Maduración Meshtastic · Optimización y cierre de resultados Fondo Emprender · Expansión a otros gremios |

**Módulos de roadmap confirmados (análisis AnimalWatch365):** NFC (fase 2) · Acelerómetro celo/inmóvil (fase 2-3) · Ambiental establo (fase 4) · Acústica ML (fase 4+).

## 6. Hardware y estrategia de enlace (decidido)

| Capa | Tecnología | Rol | Costo est. (puesto) | Pventa sugerido |
|---|---|---|---|---|
| **Base (100% hato)** | **RFID DIN 134,2kHz** (Res. 219/2026) | Identificación legal + ficha en app | $6.200-6.800/par | **$14.000** |
| **Rastreo estándar** | **LoRaWAN 915MHz + 1 gateway/finca** (usa el internet de la casa) | Ubicación real, **$0/mes** para el finquero | Tag $153K · Gateway $1,1M | **$250.000 · $1.300.000** |
| **Diferencial I+D** | **Meshtastic** (malla animal→sin gateway) | Prototipo fase 1, eliminación del gateway | <USD $200 (placas) | Producto fase 4 |
| **Premium sin cobertura** | **GSatSolar prepagado** (3 años incluidos) | Fincas aisladas sin internet | ~$480K/tag | $750-900K |
| **Opcional** | 4G con SIM anual incluida (~USD $10-20/año) | Sin infraestructura | según tag | Kit premium |
| **Lectura** | Cámara/manual (gratis) + lector P180 opcional | Registro de aretes | $249K | +$400-500K |
| **Proveedores** | Lansitec (calidad, API/MQTT) · OEM China (precio) | Compra | Cotizar | — |

**Reglas de compra:** muestras primero → piloto → compra contra pedido · Trade Assurance · verificar **915MHz legal (MinTIC/ICFEC)**, **MQTT servidor propio**, **formato DIN bovino**.

### Costos de importación (referencia)

- **RFID par:** FOB $2.500 → puesto en Colombia ≈ **$6.800** (orden 100 uds) / ≈ $5.800-6.200 (orden 440 uds)
- **Orejera GPS LoRa:** FOB $100.000 → puesto ≈ **$153.000** (orden 30 uds)
- **Gateway LoRa + antena:** ≈ **$1.100.000** puesto

## 7. Modelo de negocio y precios (cerrado)

**Suscripción mensual:**

| Plan | Precio/mes | Incluye |
|---|---|---|
| **Esencial** | **$49.000-69.000** | Hasta 50 animales, RFID, fichas, salud, alertas, reportes ICA |
| **Pro** | **$149.000** | Todo + GPS LoRa ilimitado, mapa, geocerca |
| **Gremio/Multi-finca** | **$299.000+** | Varias fincas, métricas agregadas |
| **Anual** | 2 meses gratis | Fidelización + caja upfront |

**Hardware/servicios (una sola vez):**

| Concepto | Precio |
|---|---|
| Par arete RFID DIN | $14.000 |
| Orejera GPS LoRa | $250.000 |
| Gateway + instalación | $1.300.000 |
| Kit finca GPS (10 GPS + gateway + instalación + 30 RFID) | **~$4.820.000** |
| Kit finca RFID (50 RFID + registro) | **~$950.000** |
| Instalación/gremio | $400-900K por finca |

**Proyección con 10 clientes (3 GPS + 7 RFID):** inversión ~$11M → **utilidad año 1 ≈ $21M** → **pasivo año 2+ ≈ $11-13M/año**.

## 8. Diseño visual (decidido)

- **Dirección:** "Órbita conectada" · verde selva `#1B5E20` + lima `#AED581` + tierra `#6D4C41` sobre crema `#F7F5EF`
- **Tipografía:** Outfit (títulos y texto) · botones grandes y lenguaje del campo
- **Elementos:** encabezado verde con ola de pasto, arete con número como chip, anillos de órbita del logo
- **Tokens en código:** `packages/shared/src/tokens.ts` (fuente única de colores, fuentes, radios y sombras)
- **Modo noche "Noche de campo"** diseñado (fase 3) · fotografías de campo reales
- **Onboarding:** asistente guiado + **datos demo** para explorar sin miedo

## 9. Validación obligatoria ANTES de invertir (reglas anti-riesgo)

1. **Cartas de intención** del Comité de Ganaderos (o depósitos) → inventario solo contra pedido
2. **Piloto 60 días** en 2 fincas: medir cobertura LoRa, retención de aretes, batería real, MQTT
3. **Verificaciones legales:** 915MHz · homologación de radio · Res. 219/2026 · Ley 1581 (datos) · SIC (marca)
4. Escenario piso: si no se vende nada → pérdida máxima ~$5-6M (inventario recuperable)

## 10. Estado de construcción (actualizado)

- ✅ Monorepo `C:\Users\BRAYAN\OneDrive\Desktop\TrazAgro` (pnpm + Turborepo)
- ✅ `apps/mobile` Expo SDK 58 + Expo Router: pantallas Fincas → Animales → Ficha (datos demo, colores de marca)
- ✅ `apps/backend` Fastify + Prisma (esqueleto)
- ✅ `packages/shared` tipos de dominio
- ⏳ Pendiente: repo GitHub (requiere `gh auth login`), SQLite offline, auth OTP, sync
