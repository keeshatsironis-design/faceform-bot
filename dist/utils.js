import crypto from "node:crypto";
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
export function escapeXml(value) {
    return escapeHtml(value).replaceAll("'", "&apos;");
}
export function normalizeUrl(value) {
    try {
        const url = new URL(value);
        url.hash = "";
        for (const key of [...url.searchParams.keys()]) {
            if (key.startsWith("utm_") || ["ref", "source", "s"].includes(key)) {
                url.searchParams.delete(key);
            }
        }
        return url.toString();
    }
    catch {
        return value.trim();
    }
}
export function stableHash(value) {
    return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex").slice(0, 16);
}
export function isLikelyDuplicate(title, sourceUrl, previous) {
    const url = normalizeUrl(sourceUrl);
    const hash = stableHash(title);
    return previous.some((item) => normalizeUrl(item.sourceUrl) === url || stableHash(item.title) === hash);
}
export function moscowDateParts(date = new Date()) {
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
//# sourceMappingURL=utils.js.map