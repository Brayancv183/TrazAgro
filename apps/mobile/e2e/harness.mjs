// Playwright harness for the TrazAgro web build (Expo). Used by e2e/suite.mjs.
// Each call to openApp() starts a fresh browser context = fresh phone (own SQLite/OPFS data).
import { chromium } from "playwright";

export const APP = process.env.E2E_APP_URL ?? "http://localhost:8081";
export const API = process.env.E2E_API_URL ?? "http://localhost:4000";

let browser;
export async function getBrowser() {
  browser ??= await chromium.launch({ headless: true });
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

/**
 * Opens the app in a new phone-sized context. With onboard=true it accepts the welcome/consent and lands
 * on Inicio with the demo farm "Finca La Esperanza".
 * Returns helpers:
 *   go(path)        in-app navigation without reload (history push + popstate)
 *   btn(name)       async: {disabled,label} of the visible control (exact aria-label, then label prefix, then text prefix) or null
 *   tap(name)       btn(name).click() + short wait
 *   field(ph)       first visible input by placeholder (exact string)
 *   fill(ph, v)     field(ph).fill(v)
 *   text()          whole visible body text (innerText: placeholders and input values are NOT included)
 *   has(re)         boolean: body text matches regex/string
 *   errors          array of console errors / page errors collected so far
 *   shot(name)      screenshot into ./shots/<name>.png
 */
export async function openApp({ onboard = true } = {}) {
  const b = await getBrowser();
  const context = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.goto(APP + "/");
  if (onboard) {
    await page.waitForURL("**/bienvenida", { timeout: 90000 });
    await page.getByText("Saltar").click();
    await page.getByRole("checkbox").click();
    await page.getByText("Explorar con la finca de prueba").click();
    await page.waitForTimeout(2500);
  }
  const wait = (ms) => page.waitForTimeout(ms);
  const go = async (p) => {
    await page.evaluate((p) => { history.pushState({}, "", p); dispatchEvent(new PopStateEvent("popstate")); }, p);
    await wait(1400);
  };
  // Finds a visible control: exact aria-label, then aria-label prefix, then visible text prefix.
  const find = (name) => page.evaluate((name) => {
    const els = [...document.querySelectorAll("[role=button],[role=checkbox],[role=tab],[role=link],button")].filter((e) => e.offsetParent !== null);
    const label = (e) => e.getAttribute("aria-label") || "";
    const el = els.find((e) => label(e) === name) || els.find((e) => label(e).startsWith(name)) || els.find((e) => e.innerText.trim().startsWith(name));
    if (!el) return null;
    document.querySelectorAll("[data-e2e-target]").forEach((x) => x.removeAttribute("data-e2e-target"));
    el.setAttribute("data-e2e-target", "1");
    return { disabled: el.getAttribute("aria-disabled") === "true" || el.disabled === true, label: label(el) || el.innerText.trim().slice(0, 60) };
  }, name);
  /** Returns {disabled,label} or null when no such visible control exists. */
  const btn = (name) => find(name);
  const tap = async (name, ms = 500) => {
    const f = await find(name);
    if (!f) throw new Error(`No visible control "${name}"`);
    await page.locator("[data-e2e-target]").click({ timeout: 8000, force: true });
    await wait(ms);
  };
  const field = (ph) => page.getByPlaceholder(ph, { exact: true }).filter({ visible: true }).first();
  const fill = async (ph, v) => { await field(ph).fill(v); await wait(150); };
  const text = () => page.locator("body").innerText();
  const has = async (re) => { const t = await text(); return typeof re === "string" ? t.includes(re) : re.test(t); };
  const shot = (name) => page.screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") });
  return { page, context, errors, wait, go, btn, tap, field, fill, text, has, shot };
}

/** Tiny assertion recorder: check(name, condition, detail) collects PASS/FAIL lines. */
export function recorder(area) {
  const results = [];
  return {
    results,
    check(name, ok, detail = "") { results.push({ area, name, ok: !!ok, detail: String(detail).slice(0, 400) }); },
    async step(name, fn) {
      try { await fn(); } catch (e) { results.push({ area, name, ok: false, detail: `EXCEPTION: ${String(e).split("\n")[0].slice(0, 300)}` }); }
    },
    print() {
      for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} [${r.area}] ${r.name}${r.detail ? " — " + r.detail : ""}`);
      const f = results.filter((r) => !r.ok).length;
      console.log(`\n${results.length - f} passed, ${f} failed`);
    },
  };
}
