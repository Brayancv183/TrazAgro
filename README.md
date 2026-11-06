# TrazAgro

**Tu ganado, conectado.** App de trazabilidad ganadera para productores pequeños y medianos del Huila: registra cada animal por su arete (visual + RFID), sus vacunas, tratamientos, pesajes y partos, calcula los días de retiro, prepara las novedades para SINIGAN del ICA y lleva los costos de la finca. Funciona **sin internet** y se sincroniza cuando hay señal.

> Estado: **Fase 1 (MVP) programada** con datos de prueba. Aún no está en producción. Ver [Qué falta](#qué-falta).

---

## Estructura

Monorepo con **pnpm** + **Turborepo**:

```
TrazAgro/
├── apps/
│   ├── mobile/     App Expo (SDK 58, Expo Router, SQLite local) — Android, iOS y web de prueba
│   └── backend/    Servidor Fastify + Postgres (login por SMS y sincronización)
├── packages/
│   └── shared/     Tipos, reglas de negocio, colores de marca y contrato de sincronización
├── docs/
│   └── MODELO_DATOS.md   Modelo de datos, reglas y API del servidor
└── PLAN.md         Plan de negocio y especificaciones
```

| Carpeta | Lo más importante |
|---|---|
| `apps/mobile/src/app/` | Pantallas (cada archivo es una ruta de Expo Router) |
| `apps/mobile/src/db/` | Base local: migraciones (`schema.ts`), datos de prueba (`seed.ts`), consultas (`repo.ts`) |
| `apps/mobile/src/sync/engine.ts` | Sube la bandeja de salida y baja los cambios del servidor |
| `apps/mobile/src/ui/` | Componentes con la identidad visual (encabezado verde, arete, botones) |
| `apps/backend/src/` | `auth.ts` (código SMS), `sync.ts` (subir/bajar), `db.ts` (Postgres / PGlite) |
| `packages/shared/src/` | `rules.ts` (días de retiro, edad, categoría), `farm.ts` (alertas, ICA, costos), `tokens.ts` (marca) |

---

## Requisitos

- **Node.js 20 o superior** (probado con 24).
- **pnpm 12** — se activa con Corepack:

```bash
corepack enable
```

- Para probar en un celular: la app **Expo Go** no sirve porque la app usa módulos nativos; hace falta una *development build* (ver más abajo).

No necesitas instalar Postgres: en desarrollo el servidor usa **PGlite** (Postgres embebido).

---

## Instalar

Desde la raíz del proyecto:

```bash
pnpm install
```

---

## Arrancar en desarrollo

Abre **dos terminales** en la raíz.

**1. Servidor** (queda en `http://localhost:4000`):

```bash
pnpm --filter @trazagro/backend dev
```

**2. App en el navegador** (vista de celular para probar rápido):

```bash
pnpm --filter @trazagro/mobile exec expo start --web
```

Abre la dirección que muestra la terminal (normalmente `http://localhost:8081`) y usa las herramientas del navegador en modo celular.

### Iniciar sesión en desarrollo

Todavía no hay proveedor de SMS. Al pedir el código, **el servidor lo imprime en su terminal y la app lo muestra en pantalla** ("Modo desarrollo: tu código es …"). Usa cualquier celular colombiano de 10 dígitos, por ejemplo `315 444 0099`.

### Datos de prueba

La primera vez, la app muestra la bienvenida y la autorización de datos (Ley 1581). Luego crea sola dos fincas de ejemplo (**Finca La Esperanza**, Pitalito, y **Hacienda El Roble**, Garzón) con animales, vacunas, tratamientos, pesajes, servicios y palpaciones, dos semanas de leche y movimientos. Esa finca **nunca se sube al servidor**. Para probar la sincronización y el equipo, crea una finca real en **Módulos → Mis fincas → Registrar otra finca**. La finca de prueba se puede ocultar en **Ajustes**.

### Probar en un celular Android

**Opción A — Expo Go (en minutos, sin compilar).** Sirve para probar y pedir cambios: cada cambio en el código aparece en el celular al instante.

1. Instala **Expo Go** desde la Play Store.
2. Conecta el PC y el celular a la **misma red Wi-Fi**.
3. Arranca el servidor (para iniciar sesión y sincronizar):

```bash
pnpm --filter @trazagro/backend dev
```

4. En otra terminal, arranca la app con la IP del PC (búscala con `ipconfig`, "Dirección IPv4" de la red Wi-Fi):

```bash
cd apps/mobile
```

```powershell
$env:EXPO_PUBLIC_API_URL="http://20.20.3.154:4000"; npx expo start
```


5. Abre Expo Go → **Scan QR code** y escanea el código que sale en la terminal.

Si el celular no carga (redes de universidad o empresa suelen aislar los equipos), usa el modo túnel: `npx expo start --tunnel`. La app funciona igual; solo iniciar sesión necesita llegar al servidor. Si Windows pregunta por el firewall para Node.js, permite **redes privadas**.

**Opción B — APK instalable (la app con su ícono, sin Expo Go).** Se compila en la nube de Expo (gratis, ~15 min):

```bash
cd apps/mobile
```

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest build --profile preview --platform android
```

La primera vez pregunta si crea el proyecto en Expo y la llave de Android: responde que sí. Al terminar da un enlace y un QR: ábrelo en el celular, descarga el APK e instálalo (Android pide permitir "instalar apps de origen desconocido").

- La dirección del servidor queda fija dentro del APK (`EXPO_PUBLIC_API_URL` en `apps/mobile/eas.json`, perfil `preview`). Si cambia la IP del PC, cámbiala ahí y vuelve a compilar.
- El APK permite conexiones `http://` (sin HTTPS) solo para estas pruebas (`usesCleartextTraffic` en `app.json`). **Quitarlo** cuando el servidor tenga HTTPS en producción.

---

## Variables de entorno

| Variable | Dónde | Para qué | Por defecto |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | app | Dirección del servidor | `http://localhost:4000` |
| `PORT` | servidor | Puerto | `4000` |
| `JWT_SECRET` | servidor | Firma de las sesiones | `solo-para-desarrollo` (obligatoria en producción) |
| `DATABASE_URL` | servidor | Postgres de producción (Neon) | Si falta, usa PGlite |
| `PGLITE_DIR` | servidor | Carpeta de PGlite en desarrollo | `./.data` |
| `ANTHROPIC_API_KEY` | servidor | Activa VetConecta (asistente veterinario con Claude) | Si falta, VetConecta responde "todavía no está activo" |
| `NODE_ENV` | servidor | `production` exige `JWT_SECRET`, `DATABASE_URL` y un proveedor de SMS | — |

> En producción el servidor **se niega a arrancar** hasta que se configure un proveedor de SMS, para que nadie quede sin poder iniciar sesión.

---

## Pruebas y revisión

Desde la raíz:

```bash
pnpm typecheck
```

```bash
pnpm test
```

- `packages/shared` (32 pruebas): días de retiro, categorías, alertas, novedades ICA, costos, reproducción (preñez, parto esperado, secado), agenda, leche y métricas del hato.
- `apps/backend` (14 pruebas): login por SMS, permisos entre fincas, sincronización sin duplicados, "gana el cambio más reciente", equipo con roles y VetConecta.

Revisar las versiones de Expo:

```bash
cd apps/mobile && npx expo-doctor
```

---

## Qué hace hoy

El diseño sigue los mockups de TrazAgro (encabezado verde con la onda de pasto, aretes con su forma, hojas inferiores y transiciones tipo iPhone: deslizar para volver, contenido que entra subiendo, botones que se encogen al tocar). La app tiene barra inferior con **Inicio, Animales, Escanear, Alertas y Módulos**, y trabaja sobre la finca elegida (se cambia tocando su nombre en Inicio).

| Módulo | Qué hace |
|---|---|
| Inicio | Animales bajo control, % vacunados, ruta del día por urgencia, accesos rápidos y botón **+** para registrar |
| Animales | Lista con búsqueda y filtros (sexo, retiro, lote); ficha con edad, peso, reproducción, leche, familia y trazabilidad; **editar** y **compartir ficha** |
| Escanear | Buscar por arete o RFID (los lectores Bluetooth escriben solos en el campo) y **corral rápido**: escanear varios y registrarles lo mismo |
| Registrar | Vacuna, tratamiento, desparasitación, pesaje (uno o un lote), parto y nota |
| Salud | Animales en días de retiro, cobertura de vacunación y desparasitación, últimas aplicaciones |
| Reproducción | Vacía / servida / preñada / recién parida; servicio (monta o IA), palpación, secado, parto esperado (283 días) |
| Pesajes | Último peso y ganancia diaria por animal y por lote |
| Leche | Ordeño por vaca o total del tanque, gráfica de 14 días y promedio por vaca |
| Lotes | Crear, renombrar y pasar animales entre lotes (queda en la historia) |
| Agenda | Palpaciones, partos, secados, revacunas, pesajes, fin de retiros y vencimientos |
| Inventario | Productos con retiro y vencimiento; compras (anotan el gasto) y descartes; se descuenta solo al aplicar |
| Costos y Métricas | Ingresos y gastos del mes; natalidad, mortalidad, ganancia de peso, intervalo entre partos, utilidad por animal y costo por litro |
| Reportes | Inventario, finanzas y leche en CSV (Excel) y reporte sanitario para compartir |
| Reporte ICA | Novedades (nacimientos, compras, salidas, traslados) para SINIGAN |
| Dar de baja | Venta, muerte, sacrificio, pérdida o **traslado a otra finca propia**; bloquea venta para carne en retiro |
| Equipo | Invitar por celular con rol (administrador, técnico, vaquero, solo ver); el servidor hace cumplir los permisos y el vaquero no ve la plata |
| Cuenta | Login por código SMS, sincronización, cambios rechazados con opción de descartarlos |
| VetConecta | Chat con asistente veterinario (Claude) — necesita `ANTHROPIC_API_KEY` en el servidor |
| Tienda, Plan, Mapa | Catálogo de aretes/GPS con pedido por mensaje, planes y aviso del kit GPS y drones |
| Ajustes y Bienvenida | Ocultar finca de prueba, autorización de datos (Ley 1581) |
| Fotos y QR | Fotos de cada animal en su ficha (cámara o galería; se guardan en el celular) y código QR imprimible por animal |
| Importar animales | En Ajustes: plantilla CSV/Excel, vista previa de filas buenas y con problemas, y guardado en la finca actual |

## Qué falta

- **Conectar servicios externos:** proveedor de SMS, pagos Wompi/PSE/Nequi (Tienda y Plan hoy envían el pedido por mensaje), clave de Claude para VetConecta, collares GPS LoRa y drones.
- **App instalada:** el APK de prueba ya se puede compilar (ver arriba); falta la versión de tienda. Con la app instalada entran la lectura con cámara/NFC, fotos por evento, QR imprimible y PDF con logo.
- **Pendientes técnicos:** modo noche, límite de pedidos de SMS por IP, lint y pruebas de la app móvil, y evitar que la sincronización vuelva a bajar los propios cambios.
- **Servidor en producción:** desplegar (Railway + Neon).

---

## Problemas comunes

- **"No se pudo abrir tus datos" en el navegador:** otra pestaña de TrazAgro tiene la base abierta. Ciérrala y recarga.
- **El puerto 8081 está ocupado:** Expo ofrece otro (8082); úsalo o cierra el proceso anterior.
- **El celular no se conecta al servidor:** revisa `EXPO_PUBLIC_API_URL` y que el PC y el celular estén en la misma red.
- **El servidor falla al arrancar con `RuntimeError: unreachable` (PGlite):** la base de desarrollo quedó dañada por un cierre brusco. Detén el servidor y vacía `apps/backend/.data` (solo tiene datos de prueba).
- **Metro: `EINVAL: invalid argument, readlink` en `node_modules`:** es la caché de Metro con OneDrive. Borra la carpeta `metro-file-map-*` de `%LOCALAPPDATA%\Temp` y vuelve a arrancar.
