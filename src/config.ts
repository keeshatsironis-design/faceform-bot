import "dotenv/config";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана обязательная переменная ${name}`);
  return value;
}

function bool(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function numberValue(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const sampleMode = bool("SAMPLE_MODE");
const dryRun = bool("DRY_RUN");

const DEFAULT_RSS_FEEDS = [
  "https://news.google.com/rss/search?q=%D0%BC%D0%BE%D0%B4%D0%B0+%D1%82%D1%80%D0%B5%D0%BD%D0%B4%D1%8B+%D1%81%D1%82%D0%B8%D0%BB%D1%8C&hl=ru&gl=RU&ceid=RU:ru",
  "https://news.google.com/rss/search?q=%D0%BF%D1%80%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8+%D0%B2%D0%BE%D0%BB%D0%BE%D1%81%D1%8B+%D1%82%D1%80%D0%B5%D0%BD%D0%B4%D1%8B&hl=ru&gl=RU&ceid=RU:ru",
  "https://news.google.com/rss/search?q=%D1%83%D1%85%D0%BE%D0%B4+%D0%B7%D0%B0+%D0%BA%D0%BE%D0%B6%D0%B5%D0%B9+beauty+%D0%BD%D0%BE%D0%B2%D0%BE%D1%81%D1%82%D0%B8&hl=ru&gl=RU&ceid=RU:ru",
  "https://news.google.com/rss/search?q=%D0%BC%D1%83%D0%B6%D1%81%D0%BA%D0%BE%D0%B9+%D1%81%D1%82%D0%B8%D0%BB%D1%8C+%D0%B3%D1%80%D1%83%D0%BC%D0%B8%D0%BD%D0%B3+%D0%B1%D0%BE%D1%80%D0%BE%D0%B4%D0%B0&hl=ru&gl=RU&ceid=RU:ru",
  "https://news.google.com/rss/search?q=beauty+tech+fashion+trend&hl=ru&gl=RU&ceid=RU:ru",
];

function rssFeeds(): string[] {
  const raw = process.env.RSS_FEEDS?.trim();
  if (!raw) return DEFAULT_RSS_FEEDS;
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.startsWith("http"));
}

export const config = {
  sampleMode,
  dryRun,
  disableCard: bool("DISABLE_CARD"),
  allowEvergreenFallback: bool("ALLOW_EVERGREEN_FALLBACK", true),
  telegramBotToken: sampleMode || dryRun ? process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "" : required("TELEGRAM_BOT_TOKEN"),
  telegramChannelId: sampleMode || dryRun ? process.env.TELEGRAM_CHANNEL_ID?.trim() || "@your_channel" : required("TELEGRAM_CHANNEL_ID"),
  faceformBotUrl: process.env.FACEFORM_BOT_URL?.trim() || "https://t.me/your_faceform_bot?startapp",
  channelName: process.env.CHANNEL_NAME?.trim() || "FaceForm | Разбор внешности",
  channelUsername: process.env.CHANNEL_USERNAME?.trim() || "@faceform",
  stateFile: process.env.STATE_FILE?.trim() || path.resolve("data/content-bot-state.json"),
  rssFeeds: rssFeeds(),
  maxArticleAgeDays: Math.max(1, Math.min(45, numberValue("MAX_ARTICLE_AGE_DAYS", 14))),
  requestTimeoutMs: Math.max(3000, Math.min(60000, numberValue("REQUEST_TIMEOUT_MS", 15000))),
};
