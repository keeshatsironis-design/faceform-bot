import { normalizeUrl } from "./utils.js";

export interface RssArticle {
  title: string;
  url: string;
  sourceName: string;
  publishedAt?: string;
  description?: string;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name: string) => named[name.toLowerCase()] ?? `&${name};`);
}

function cleanText(value: string): string {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, names: string[]): string {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function attr(block: string, tagName: string, attrName: string): string {
  const match = block.match(new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, "i"));
  return match?.[1] ? decodeEntities(match[1]).trim() : "";
}

function parseRssItem(block: string): RssArticle | null {
  const title = tag(block, ["title"]);
  const link = tag(block, ["link", "guid"]);
  const sourceName = tag(block, ["source", "dc:creator", "author"]) || "Источник";
  const published = tag(block, ["pubDate", "dc:date", "published", "updated"]);
  const description = tag(block, ["description", "content:encoded", "summary", "content"]);
  if (!title || !link.startsWith("http")) return null;
  return {
    title,
    url: normalizeUrl(link),
    sourceName,
    publishedAt: published || undefined,
    description: description || undefined,
  };
}

function parseAtomEntry(block: string): RssArticle | null {
  const title = tag(block, ["title"]);
  const link = attr(block, "link", "href") || tag(block, ["link", "id"]);
  const sourceName = tag(block, ["name", "author", "source"]) || "Источник";
  const published = tag(block, ["published", "updated"]);
  const description = tag(block, ["summary", "content"]);
  if (!title || !link.startsWith("http")) return null;
  return {
    title,
    url: normalizeUrl(link),
    sourceName,
    publishedAt: published || undefined,
    description: description || undefined,
  };
}

export function parseFeed(xml: string): RssArticle[] {
  const rssBlocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  if (rssBlocks.length) return rssBlocks.map(parseRssItem).filter((item): item is RssArticle => Boolean(item));

  const atomBlocks = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]);
  return atomBlocks.map(parseAtomEntry).filter((item): item is RssArticle => Boolean(item));
}

export async function fetchFeed(url: string, timeoutMs: number): Promise<RssArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "FaceFormContentBot/2.0 (+https://t.me/faceform)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RSS ${response.status} ${response.statusText}`);
    return parseFeed(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}
