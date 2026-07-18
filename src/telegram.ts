import { config } from "./config.js";
import type { GeneratedPost } from "./types.js";
import { escapeHtml, normalizeUrl, sleep } from "./utils.js";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface TelegramMessage {
  message_id: number;
}

class TelegramApiError extends Error {
  constructor(
    readonly code: number,
    description: string,
  ) {
    super(`Telegram ${code}: ${description}`);
    this.name = "TelegramApiError";
  }
}

function compact(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function truncate(value: string, maxChars: number): string {
  const chars = Array.from(compact(value));

  if (chars.length <= maxChars) {
    return chars.join("");
  }

  return `${chars
    .slice(0, Math.max(1, maxChars - 1))
    .join("")
    .trimEnd()}…`;
}

function safeSourceUrl(value: string): string | undefined {
  try {
    const normalized = normalizeUrl(value);
    const url = new URL(normalized);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    const result = url.toString();

    return result.length <= 500 ? result : undefined;
  } catch {
    return undefined;
  }
}

function cleanHashtags(tags: string[], limit = 5): string[] {
  return tags
    .map((tag) => tag.replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter(Boolean)
    .slice(0, limit);
}

interface CaptionParts {
  title: string;
  lead: string;
  points: string[];
  takeaway: string;
  sourceName: string;
  sourceUrl?: string;
  hashtags: string[];
}

function buildHtmlCaption(parts: CaptionParts): string {
  const rows: string[] = [
    `<b>${escapeHtml(parts.title)}</b>`,
  ];

  if (parts.lead) {
    rows.push("", escapeHtml(parts.lead));
  }

  if (parts.points.length > 0) {
    rows.push(
      "",
      parts.points
        .map((item) => `• ${escapeHtml(item)}`)
        .join("\n"),
    );
  }

  if (parts.takeaway) {
    rows.push(
      "",
      `<b>Что взять себе:</b> ${escapeHtml(parts.takeaway)}`,
    );
  }

  const sourceLabel = escapeHtml(
    parts.sourceName || "Источник",
  );

  if (parts.sourceUrl) {
    rows.push(
      "",
      `Источник: <a href="${escapeHtml(parts.sourceUrl)}">${sourceLabel}</a>`,
    );
  } else {
    rows.push(
      "",
      `Источник: ${sourceLabel}`,
    );
  }

  if (parts.hashtags.length > 0) {
    rows.push(
      parts.hashtags
        .map((tag) => `#${tag}`)
        .join(" "),
    );
  }

  return rows.join("\n");
}

function buildPlainCaption(parts: CaptionParts): string {
  const rows: string[] = [
    parts.title,
  ];

  if (parts.lead) {
    rows.push("", parts.lead);
  }

  if (parts.points.length > 0) {
    rows.push(
      "",
      parts.points
        .map((item) => `• ${item}`)
        .join("\n"),
    );
  }

  if (parts.takeaway) {
    rows.push(
      "",
      `Что взять себе: ${parts.takeaway}`,
    );
  }

  rows.push(
    "",
    `Источник: ${parts.sourceName || "Источник"}`,
  );

  if (parts.sourceUrl) {
    rows.push(parts.sourceUrl);
  }

  if (parts.hashtags.length > 0) {
    rows.push(
      parts.hashtags
        .map((tag) => `#${tag}`)
        .join(" "),
    );
  }

  return rows.join("\n");
}

function prepareCaptionParts(
  post: GeneratedPost,
): CaptionParts {
  return {
    title: truncate(post.title, 180),
    lead: truncate(post.lead, 230),
    points: post.points
      .slice(0, 3)
      .map((item) => truncate(item, 155)),
    takeaway: truncate(post.takeaway, 180),
    sourceName: truncate(
      post.sourceName || "Источник",
      80,
    ),
    sourceUrl: safeSourceUrl(post.sourceUrl),
    hashtags: cleanHashtags(post.hashtags),
  };
}

function fitCaption(
  parts: CaptionParts,
  render: (value: CaptionParts) => string,
): string {
  // У подписи фотографии Telegram есть лимит.
  // Оставляем запас и не режем готовый HTML
  // посередине тега <a> или HTML-сущности.
  const limit = 980;

  let result = render(parts);

  while (
    result.length > limit &&
    parts.points.length > 1
  ) {
    parts.points.pop();
    result = render(parts);
  }

  if (result.length > limit) {
    parts.lead = truncate(parts.lead, 140);
    result = render(parts);
  }

  if (result.length > limit) {
    parts.takeaway = truncate(
      parts.takeaway,
      100,
    );
    result = render(parts);
  }

  if (result.length > limit) {
    parts.hashtags = [];
    result = render(parts);
  }

  if (result.length > limit) {
    parts.title = truncate(parts.title, 120);
    result = render(parts);
  }

  if (result.length > limit) {
    parts.points = parts.points.map((item) =>
      truncate(item, 90),
    );

    result = render(parts);
  }

  if (result.length > limit) {
    parts.sourceUrl = undefined;
    result = render(parts);
  }

  return result;
}

export function formatPost(
  post: GeneratedPost,
): string {
  return fitCaption(
    prepareCaptionParts(post),
    buildHtmlCaption,
  );
}

export function formatPlainPost(
  post: GeneratedPost,
): string {
  return fitCaption(
    prepareCaptionParts(post),
    buildPlainCaption,
  );
}

function keyboard(): string {
  return JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "🔍 Разобрать внешность в FaceForm",
          url: config.faceformBotUrl,
        },
      ],
    ],
  });
}

async function telegramRequest<T>(
  method: string,
  body: BodyInit,
): Promise<T> {
  const endpoint =
    `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body,
      });

      const payload =
        (await response.json()) as TelegramApiResponse<T>;

      if (
        !response.ok ||
        !payload.ok ||
        !payload.result
      ) {
        throw new TelegramApiError(
          payload.error_code ?? response.status,
          payload.description ?? "unknown error",
        );
      }

      return payload.result;
    } catch (error) {
      lastError = error;

      console.warn(
        `Telegram попытка ${attempt} не удалась:`,
        error,
      );

      // Повтор одинакового запроса не исправит
      // ошибку разметки или другой ответ 4xx.
      if (
        error instanceof TelegramApiError &&
        error.code >= 400 &&
        error.code < 500
      ) {
        break;
      }

      if (attempt < 3) {
        await sleep(1200 * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Telegram request failed");
}

function isEntityParseError(
  error: unknown,
): boolean {
  return (
    error instanceof Error &&
    /can't parse entities|parse entities/iu.test(
      error.message,
    )
  );
}

async function sendPhoto(
  post: GeneratedPost,
  card: Buffer,
  useHtml: boolean,
): Promise<TelegramMessage> {
  const form = new FormData();

  form.append(
    "chat_id",
    config.telegramChannelId,
  );

  form.append(
    "photo",
    new Blob(
      [new Uint8Array(card)],
      { type: "image/png" },
    ),
    "faceform-post.png",
  );

  form.append(
    "caption",
    useHtml
      ? formatPost(post)
      : formatPlainPost(post),
  );

  if (useHtml) {
    form.append("parse_mode", "HTML");
  }

  form.append(
    "reply_markup",
    keyboard(),
  );

  return telegramRequest<TelegramMessage>(
    "sendPhoto",
    form,
  );
}

async function sendText(
  post: GeneratedPost,
  useHtml: boolean,
): Promise<TelegramMessage> {
  const form = new URLSearchParams();

  form.set(
    "chat_id",
    config.telegramChannelId,
  );

  form.set(
    "text",
    useHtml
      ? formatPost(post)
      : formatPlainPost(post),
  );

  if (useHtml) {
    form.set("parse_mode", "HTML");
  }

  form.set(
    "reply_markup",
    keyboard(),
  );

  form.set(
    "link_preview_options",
    JSON.stringify({
      is_disabled: true,
    }),
  );

  return telegramRequest<TelegramMessage>(
    "sendMessage",
    form,
  );
}

export async function publishPost(
  post: GeneratedPost,
  card?: Buffer,
): Promise<TelegramMessage> {
  if (config.dryRun) {
    console.log(
      "\n--- DRY RUN: TELEGRAM POST ---\n",
    );

    console.log(formatPlainPost(post));

    console.log("\n--- END ---\n");

    return {
      message_id: 0,
    };
  }

  try {
    if (
      card &&
      !config.disableCard
    ) {
      return await sendPhoto(
        post,
        card,
        true,
      );
    }

    return await sendText(
      post,
      true,
    );
  } catch (error) {
    // Если Telegram не принял HTML,
    // автоматически отправляем обычный текст.
    if (!isEntityParseError(error)) {
      throw error;
    }

    console.warn(
      "Telegram не принял HTML-разметку, повторяем безопасным простым текстом.",
    );

    if (
      card &&
      !config.disableCard
    ) {
      return sendPhoto(
        post,
        card,
        false,
      );
    }

    return sendText(
      post,
      false,
    );
  }
}
