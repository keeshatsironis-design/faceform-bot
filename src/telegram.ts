import { config } from "./config.js";
import type { GeneratedPost } from "./types.js";
import { escapeHtml, sleep } from "./utils.js";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface TelegramMessage {
  message_id: number;
}

export function formatPost(post: GeneratedPost): string {
  const bullets = post.points.map((item) => `• ${escapeHtml(item)}`).join("\n");
  const hashtags = post.hashtags
    .map((tag) => tag.replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");

  const text = [
    `<b>${escapeHtml(post.title)}</b>`,
    "",
    escapeHtml(post.lead),
    "",
    bullets,
    "",
    `<b>Что взять себе:</b> ${escapeHtml(post.takeaway)}`,
    "",
    `Источник: <a href="${escapeHtml(post.sourceUrl)}">${escapeHtml(post.sourceName)}</a>`,
    hashtags,
  ].join("\n");

  return text.length <= 1000 ? text : `${text.slice(0, 950).trimEnd()}…\n\n<a href="${escapeHtml(post.sourceUrl)}">Источник</a>`;
}

function keyboard(): string {
  return JSON.stringify({
    inline_keyboard: [[{ text: "🔍 Разобрать внешность в FaceForm", url: config.faceformBotUrl }]],
  });
}

async function telegramRequest<T>(method: string, body: BodyInit): Promise<T> {
  const endpoint = `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "POST", body });
      const payload = (await response.json()) as TelegramApiResponse<T>;
      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(`Telegram ${payload.error_code ?? response.status}: ${payload.description ?? "unknown error"}`);
      }
      return payload.result;
    } catch (error) {
      lastError = error;
      console.warn(`Telegram попытка ${attempt} не удалась:`, error);
      if (attempt < 3) await sleep(1200 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Telegram request failed");
}

export async function publishPost(post: GeneratedPost, card?: Buffer): Promise<TelegramMessage> {
  const caption = formatPost(post);

  if (config.dryRun) {
    console.log("\n--- DRY RUN: TELEGRAM POST ---\n");
    console.log(caption.replace(/<[^>]+>/g, ""));
    console.log("\n--- END ---\n");
    return { message_id: 0 };
  }

  if (card && !config.disableCard) {
    const form = new FormData();
    form.append("chat_id", config.telegramChannelId);
    form.append("photo", new Blob([new Uint8Array(card)], { type: "image/png" }), "faceform-post.png");
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("reply_markup", keyboard());
    return telegramRequest<TelegramMessage>("sendPhoto", form);
  }

  const form = new URLSearchParams();
  form.set("chat_id", config.telegramChannelId);
  form.set("text", caption);
  form.set("parse_mode", "HTML");
  form.set("reply_markup", keyboard());
  form.set("link_preview_options", JSON.stringify({ is_disabled: true }));
  return telegramRequest<TelegramMessage>("sendMessage", form);
}
