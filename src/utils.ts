import crypto from "node:crypto";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function escapeXml(value: string): string {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["ref", "source", "s"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function stableHash(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex").slice(0, 16);
}

export function isLikelyDuplicate(
  title: string,
  sourceUrl: string,
  previous: Array<{ title: string; sourceUrl: string }>,
): boolean {
  const url = normalizeUrl(sourceUrl);
  const hash = stableHash(title);
  return previous.some((item) => normalizeUrl(item.sourceUrl) === url || stableHash(item.title) === hash);
}

export function moscowDateParts(date = new Date()): { date: string; hour: number; label: string } {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
  const label = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return { date: isoDate, hour: Number(parts.hour), label };
}

