// End-to-end suite for the TrazAgro web build. Needs the app (pnpm --filter @trazagro/mobile web) and, for the
// account section, the API (pnpm --filter @trazagro/backend dev). Each section runs on a fresh "phone".
// Usage: node e2e/suite.mjs [section…]   sections: pantallas animales campo finca cuenta (default: all)
import { mkdirSync } from "node:fs";
import { API, closeBrowser, openApp, recorder } from "./harness.mjs";

mkdirSync(new URL("./shots/", import.meta.url), { recursive: true });
const wanted = process.argv.slice(2);
const run = (name) => !wanted.length || wanted.includes(name);
const r = recorder("e2e");
const noErrors = (app, where) => r.check(`${where}: sin errores de consola`, app.errors.length === 0, app.errors.join(" | "));
const label = (app, l) => app.page.locator(`[aria-label="${l}"]`).last();

const ROUTES = [
  "/", "/animales", "/escanear", "/alertas", "/modulos", "/animal/demo-a-canela", "/animal/nuevo", "/animal/editar?id=demo-a-canela",
  "/animal/baja?id=demo-a-rosa", "/evento/nuevo", "/agenda", "/salud", "/pesajes", "/reproduccion", "/leche", "/fincas", "/finca/nueva",
  "/lotes", "/inventario", "/costos", "/metricas", "/reportes", "/ica", "/cuenta", "/equipo", "/suscripcion", "/tienda", "/vetconecta", "/mapa", "/ajustes",
];

if (run("pantallas")) {
  const app = await openApp();
  for (const route of ROUTES) {
    await r.step(`abre ${route}`, async () => {
      await app.go(route);
      r.check(`abre ${route}`, (await app.text()).trim().length > 20);
    });
  }
  noErrors(app, "pantallas");
}

if (run("animales")) {
  const app = await openApp();
  await r.step("nuevo animal con madre", async () => {
    await app.go("/animal/nuevo");
    await app.tap("Siguiente", 500);
    r.check("arete obligatorio", await app.has("Escribe el número del arete"));
    await app.fill("Ej: 00127", "00777"); await app.tap("Siguiente", 700);
    await app.fill("Ej: Luna", "Lunita"); await app.tap("Siguiente", 700);
    await label(app, "Madre: No sé").click(); await app.wait(800);
    await app.page.locator("[role=button]").filter({ hasText: "Rosa" }).last().click(); await app.wait(600);
    await app.tap("Siguiente", 700); await app.tap("Guardar animal", 1500);
    r.check("animal guardado", await app.has("Lunita ya está en tu finca"));
  });
  await r.step("arete repetido", async () => {
    await app.go("/animal/nuevo"); await app.tap("Registrar otro", 600).catch(() => {});
    await app.fill("Ej: 00127", "00123"); await app.tap("Siguiente", 500);
    await app.tap("Siguiente", 500); await app.tap("La compré", 300); await app.fill("Ej: Finca Los Naranjos", "Vecino");
    await app.tap("Siguiente", 500); await app.tap("Guardar animal", 1200);
    r.check("bloquea el arete de Miel", await app.has("Ese arete ya es de Miel"));
  });
  await r.step("filtros y hoja rápida", async () => {
    await app.go("/animales");
    await app.tap("Más filtros", 900);
    await label(app, "Hembras").click(); await label(app, "Días de espera").click(); await app.wait(400);
    await app.page.locator('[aria-label^="Ver "]').last().click(); await app.wait(900);
    r.check("filtra hembras en retiro", (await app.has("Canela")) && !(await app.has("Capitán")));
    await app.tap("Todos", 600);
    await app.tap("Canela", 900);
    r.check("hoja rápida", !!(await app.btn("Ver perfil completo")));
  });
  await r.step("baja con aviso al comprador", async () => {
    await label(app, "Ver perfil completo").click(); await app.wait(1500);
    await label(app, "Dar de baja a Canela").click(); await app.wait(1500);
    await app.tap("Se vendió para carne", 500);
    r.check("venta para carne bloqueada en retiro", (await app.btn("Confirmar baja"))?.disabled === true);
    await app.tap("Se vendió para cría o leche", 500);
    await app.tap("Confirmar baja", 600);
    r.check("pide avisar al comprador", await app.has("Confirma que le avisaste"));
    await app.tap("Le avisé al comprador", 300);
    await app.fill("Ej: 2800000", "3100000");
    await app.tap("Confirmar baja", 1500);
    await app.tap("Volver a los animales", 1500);
    r.check("Canela sale de la lista", !(await app.has("Canela")));
  });
  noErrors(app, "animales");
}

if (run("campo")) {
  const app = await openApp();
  await r.step("vacuna a un lote", async () => {
    await app.go("/evento/nuevo");
    await app.tap("Siguiente"); await app.tap("Todo el Lote 1");
    await app.tap("Siguiente"); await app.tap("Aftosa"); await app.fill("Ej: 2 dosis", "1");
    await app.tap("Siguiente"); await app.tap("Guardar registro", 1500);
    r.check("vacuna guardada", !!(await app.btn("Registrar otro")));
  });
  await r.step("inventario descontado", async () => {
    await app.go("/inventario");
    r.check("Aftosa baja de 38 a 32 dosis", await app.has(/Aftosa bivalente[\s\S]{0,80}32/));
  });
  await r.step("ordeño del tanque", async () => {
    await app.go("/leche");
    await app.tap("Anotar ordeño", 900);
    await app.tap("Total del tanque"); await app.fill("Ej: 85", "20");
    r.check("botón con el total", !!(await app.btn("Guardar 20 litros")));
    await app.tap("Guardar 20 litros", 1500);
  });
  await r.step("palpación solo con servicio", async () => {
    await app.go("/reproduccion");
    await app.tap("Registrar para Miel", 900);
    r.check("Miel (servida) puede palparse", !!(await app.btn("Palpación: preñada o vacía")));
    await app.page.keyboard.press("Escape"); await app.wait(500);
  });
  noErrors(app, "campo");
}

if (run("finca")) {
  const app = await openApp();
  await r.step("lotes", async () => {
    await app.go("/lotes");
    await app.tap("Mover animales a Lote 3"); await app.wait(700);
    await app.tap("Luna"); await app.wait(300);
    await app.tap("Pasar 1 animal"); await app.wait(1200);
    r.check("mueve un animal", await app.has("1 animal pasó a Lote 3"));
    await app.go("/lotes");
    await app.tap("Nuevo lote"); await app.wait(700);
    await app.fill("Ej: Lote 2 · Levante", "Lote 4 · Ceba"); await app.tap("Guardar"); await app.wait(1000);
    r.check("crea un lote", await app.has("Lote 4 · Ceba"));
  });
  await r.step("inventario compra y descarte", async () => {
    await app.go("/inventario");
    await app.tap("Comprar Aftosa bivalente"); await app.wait(700);
    await app.fill("Ej: 50", "10"); await app.tap("Sumar al inventario"); await app.wait(1000);
    r.check("38 + 10 = 48", await app.has("48"));
    await app.tap("Descartar Aftosa bivalente"); await app.wait(700);
    await app.fill("Hay 48", "3"); await app.tap("Descartar", 400); await app.wait(1000);
    r.check("48 − 3 = 45", await app.has("45"));
  });
  await r.step("validaciones de finca", async () => {
    await app.go("/fincas");
    await app.tap("Registrar otra finca"); await app.wait(900);
    await app.tap("Guardar finca"); await app.wait(500);
    r.check("campos obligatorios", await app.has("Escribe el nombre, el municipio y el departamento."));
    await app.fill("Ej: Finca La Esperanza", "Finca Prueba UI"); await app.fill("Ej: Pitalito", "Neiva");
    await app.fill("Ej: 45", "abc"); await app.tap("Guardar finca"); await app.wait(500);
    r.check("hectáreas inválidas", await app.has("Revisa las hectáreas."));
  });
  await r.step("ICA y costos", async () => {
    await app.go("/ica");
    if (await app.has("Ya lo reporté")) {
      await app.tap("Ya lo reporté"); await app.wait(1200);
      r.check("novedad marcada", await app.has("No tienes novedades pendientes"));
    }
    await app.go("/costos"); await app.tap("Año"); await app.wait(700);
    r.check("periodo de 12 meses", await app.has(/ÚLTIMOS 12 MESES/i));
  });
  noErrors(app, "finca");
}

if (run("cuenta")) {
  await r.step("bienvenida y autorización", async () => {
    const a = await openApp({ onboard: false });
    await a.page.waitForURL("**/bienvenida", { timeout: 90000 }); await a.wait(1500);
    await a.page.getByRole("radio", { name: "Dueño o ganadero" }).click(); await a.wait(400);
    await a.tap("Continuar", 700);
    await a.tap("Saltar", 700);
    r.check("explorar bloqueado sin autorizar", (await a.btn("Explorar con la finca de prueba"))?.disabled === true);
    await a.page.getByRole("checkbox").click(); await a.wait(400);
    await a.page.getByText("Explorar con la finca de prueba").click(); await a.wait(2500);
    r.check("llega a Inicio", await a.has("bajo control"));
    noErrors(a, "bienvenida");
  });
  await r.step("importar animales desde CSV", async () => {
    const a = await openApp();
    await a.go("/ajustes");
    await a.tap("Pegar el texto del Excel", 500);
    await a.page.getByRole("textbox", { name: "Texto del Excel" }).fill(
      "arete;rfid;nombre;sexo;raza;nacimiento\n00901;;Paloma QA;hembra;Gyr;15/03/2022\n00902;;Tornado QA;m;Brahman;2023-08-10\n00903;;Mala;vaca loca;;2023-01-01\n00901;;Repetida;hembra;;2023-01-01\n");
    await a.wait(600);
    r.check("2 filas buenas, 2 con problemas", !!(await a.btn("Guardar 2 animales")));
    await a.tap("Guardar 2 animales", 2500);
    await a.go("/animales");
    r.check("importados en la lista", (await a.has("Paloma QA")) && (await a.has("Tornado QA")));
    noErrors(a, "importar");
  });
  const apiUp = await fetch(`${API}/health`).then((x) => x.ok).catch(() => false);
  if (!apiUp) r.check("servidor disponible para login y equipo", false, `no responde ${API}`);
  else {
    await r.step("login, finca, sincronizar e invitar", async () => {
      const a = await openApp();
      await a.go("/cuenta");
      await a.fill("Ej: 315 444 0099", "31" + String(Date.now()).slice(-8));
      await a.tap("Enviarme el código por SMS", 2000);
      const code = (await a.text()).match(/tu código es (\d{6})/)?.[1];
      r.check("código de desarrollo", !!code);
      await a.fill("••••••", code ?? ""); await a.tap("Entrar", 6000);
      await a.go("/finca/nueva");
      await a.fill("Ej: Finca La Esperanza", "Finca Equipo QA"); await a.fill("Ej: Pitalito", "Garzón");
      await a.tap("Guardar finca", 2500);
      await a.go("/cuenta"); await a.tap("Sincronizar ahora", 4000);
      await a.go("/equipo"); await a.wait(1500);
      await a.tap("Agregar persona", 900);
      await a.fill("Número de celular", "320 111 " + String(Date.now()).slice(-4));
      await a.fill("Nombre de la persona (opcional)", "Don Jairo");
      await a.tap("Enviar invitación", 2500);
      r.check("invitación lista", await a.has("Invitación lista"));
      noErrors(a, "cuenta");
    });
  }
}

r.print();
await closeBrowser();
process.exit(r.results.some((x) => !x.ok) ? 1 : 0);
