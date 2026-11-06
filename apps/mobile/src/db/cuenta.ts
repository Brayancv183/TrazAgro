import type { SQLiteDatabase } from "expo-sqlite";
import { todayDay, type AnimalOrigin, type AnimalSex } from "@trazagro/shared";
import { createAnimal, DuplicateTagError } from "./repo";

/** Columns of the animal import, in order. "origen" is optional (nacido | comprado; default nacido). */
export const IMPORT_COLUMNS = ["arete", "rfid", "nombre", "sexo", "raza", "nacimiento", "origen"] as const;
export const IMPORT_TEMPLATE = "arete;rfid;nombre;sexo;raza;nacimiento\n00201;982000123456789;Paloma;hembra;Gyr;2022-03-15\n00202;;Tornado;macho;Brahman;10/08/2023\n";

export interface ImportRow {
  line: number;
  tagVisual?: string;
  rfid?: string;
  name?: string;
  sex: AnimalSex;
  breed?: string;
  birthDate: string;
  origin: AnimalOrigin;
}
export interface ImportProblem { line: number; text: string }

/** Splits one CSV line on `sep`, honoring "quoted; fields" and doubled quotes. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const pad = (n: string) => n.padStart(2, "0");

/** Accepts 2022-03-15, 15/03/2022, 15-03-2022 and 15/3/22. Returns YYYY-MM-DD or undefined. */
export function parseBirth(raw: string): string | undefined {
  const v = raw.trim();
  let y: string | undefined, m: string | undefined, d: string | undefined;
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(v);
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(v);
  if (iso) [, y, m, d] = iso;
  else if (dmy) { [, d, m, y] = dmy; if (y!.length === 2) y = `20${y}`; }
  else return undefined;
  const day = `${y}-${pad(m!)}-${pad(d!)}`;
  const dt = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== day) return undefined;
  if (day > todayDay() || Number(y) < 1990) return undefined;
  return day;
}

function parseSex(raw: string): AnimalSex | undefined {
  const v = raw.trim().toLowerCase();
  if (["hembra", "h", "f", "vaca", "novilla", "ternera"].includes(v)) return "hembra";
  if (["macho", "m", "toro", "novillo", "ternero"].includes(v)) return "macho";
  return undefined;
}

/**
 * Reads pasted or picked CSV text (columns arete;rfid;nombre;sexo;raza;nacimiento[;origen]; separator ; , or tab).
 * A first row with column names is skipped. Rows with problems are returned apart, with their line number.
 */
export function parseAnimalsCsv(text: string): { rows: ImportRow[]; problems: ImportProblem[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const first = lines.find((l) => l.trim()) ?? "";
  const sep = first.includes(";") ? ";" : first.includes("\t") ? "\t" : ",";
  const rows: ImportRow[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Set<string>();
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const c = splitLine(raw, sep);
    if (/^(arete|n[uú]mero|tag)/i.test(c[0] ?? "") && /sexo/i.test(raw)) return; // header
    const [tag = "", rfid = "", name = "", sexRaw = "", breed = "", birthRaw = "", originRaw = ""] = c;
    const tagVisual = tag.replace(/\s+/g, "") || undefined;
    const chip = rfid.replace(/\s+/g, "") || undefined;
    if (!tagVisual && !chip && !name) return problems.push({ line, text: "Falta el arete, el RFID o el nombre." });
    const sex = parseSex(sexRaw);
    if (!sex) return problems.push({ line, text: `Sexo “${sexRaw || "vacío"}”: escribe hembra o macho.` });
    const birthDate = parseBirth(birthRaw);
    if (!birthDate) return problems.push({ line, text: `Fecha de nacimiento “${birthRaw || "vacía"}”: usa 2022-03-15 o 15/03/2022.` });
    for (const code of [tagVisual, chip]) {
      if (!code) continue;
      if (seen.has(code)) return problems.push({ line, text: `El arete ${code} está repetido en el archivo.` });
      seen.add(code);
    }
    const o = originRaw.trim().toLowerCase();
    const origin: AnimalOrigin = o.startsWith("compr") ? "comprado" : "nacido";
    rows.push({ line, tagVisual, rfid: chip, name: name || undefined, sex, breed: breed || undefined, birthDate, origin });
  });
  return { rows, problems };
}

/** Saves the parsed rows into the farm with createAnimal (one by one, so a duplicate tag only skips its row). */
export async function importAnimals(db: SQLiteDatabase, farmId: string, rows: ImportRow[]): Promise<{ created: number; problems: ImportProblem[] }> {
  let created = 0;
  const problems: ImportProblem[] = [];
  for (const r of rows) {
    try {
      await createAnimal(db, { farmId, tagVisual: r.tagVisual, rfid: r.rfid, name: r.name, sex: r.sex, breed: r.breed, birthDate: r.birthDate, origin: r.origin });
      created++;
    } catch (e) {
      problems.push({ line: r.line, text: e instanceof DuplicateTagError ? e.message : "No se pudo guardar." });
    }
  }
  return { created, problems };
}
