import { Platform, Share } from "react-native";

/**
 * Shares a text report through the phone's share sheet (WhatsApp, correo…). On a computer browser
 * without a share sheet the report downloads as a file instead.
 */
export async function shareText(title: string, text: string, fileName = `${title}.txt`): Promise<"shared" | "downloaded" | "cancelled"> {
  if (Platform.OS !== "web") {
    const r = await Share.share({ title, message: text });
    return r.action === Share.dismissedAction ? "cancelled" : "shared";
  }
  const nav = navigator as Navigator & { share?: (data: { title: string; text: string }) => Promise<void> };
  if (nav.share && !fileName.endsWith(".csv")) {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (e) {
      // The person closed the sheet: do nothing. Not allowed here: fall back to a download.
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }
  const blob = new Blob(["﻿" + text], { type: fileName.endsWith(".csv") ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return "downloaded";
}

/** One CSV line; fields with separators or quotes are quoted. Semicolons open correctly in Excel (es-CO). */
export const csvRow = (cells: (string | number | undefined)[]) =>
  cells.map((c) => {
    const v = c === undefined ? "" : String(c);
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(";");
