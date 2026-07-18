import sharp from "sharp";
import type { GeneratedPost } from "./types.js";
import { escapeXml, moscowDateParts } from "./utils.js";

const CARD_WIDTH = 1080;
const TITLE_X = 76;
const TITLE_RIGHT = 1008;
const TITLE_MAX_WIDTH = TITLE_RIGHT - TITLE_X;
const TITLE_MAX_LINES = 5;
const TITLE_START_Y = 360;
const TITLE_BOTTOM_Y = 820;

function charWidthFactor(char: string): number {
  if (/\s/u.test(char)) return 0.32;
  if (/[.,:;!?'"`|()\[\]{}\-–—]/u.test(char)) return 0.34;
  if (/[1ilIjtfr]/u.test(char)) return 0.36;
  if (/[mwMWЖШЩЮФЫжшщюфы@%&]/u.test(char)) return 0.84;
  if (/[A-ZА-ЯЁ0-9]/u.test(char)) return 0.68;
  return 0.6;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((sum, char) => sum + charWidthFactor(char) * fontSize, 0);
}

function trimToWidth(text: string, maxWidth: number, fontSize: number, suffix = "…"): string {
  let value = text.trimEnd();
  while (value && estimateTextWidth(`${value}${suffix}`, fontSize) > maxWidth) {
    value = value.slice(0, -1).trimEnd();
  }
  return `${value}${suffix}`;
}

function splitLongWord(word: string, maxWidth: number, fontSize: number): string[] {
  const parts: string[] = [];
  let current = "";

  for (const char of word) {
    const candidate = `${current}${char}`;
    if (current && estimateTextWidth(candidate, fontSize) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }

  if (current) parts.push(current);
  return parts;
}

function wrapTitle(text: string, fontSize: number): string[] {
  const sourceWords = text.trim().split(/\s+/u).filter(Boolean);
  const words = sourceWords.flatMap((word) =>
    estimateTextWidth(word, fontSize) > TITLE_MAX_WIDTH
      ? splitLongWord(word, TITLE_MAX_WIDTH, fontSize)
      : [word],
  );

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || estimateTextWidth(candidate, fontSize) <= TITLE_MAX_WIDTH) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function fitTitle(text: string): { lines: string[]; fontSize: number; lineHeight: number } {
  const candidates = [72, 68, 64, 60, 56, 52, 48];

  for (const fontSize of candidates) {
    const lineHeight = Math.round(fontSize * 1.24);
    const lines = wrapTitle(text, fontSize);
    const blockBottom = TITLE_START_Y + (lines.length - 1) * lineHeight;

    if (lines.length <= TITLE_MAX_LINES && blockBottom <= TITLE_BOTTOM_Y) {
      return { lines, fontSize, lineHeight };
    }
  }

  const fontSize = 48;
  const lineHeight = Math.round(fontSize * 1.24);
  const lines = wrapTitle(text, fontSize).slice(0, TITLE_MAX_LINES);

  if (lines.length === TITLE_MAX_LINES) {
    lines[TITLE_MAX_LINES - 1] = trimToWidth(lines[TITLE_MAX_LINES - 1], TITLE_MAX_WIDTH, fontSize);
  }

  return { lines, fontSize, lineHeight };
}

export async function createPostCard(post: GeneratedPost, channelUsername: string): Promise<Buffer> {
  const { lines, fontSize, lineHeight } = fitTitle(post.title);
  const titleSvg = lines
    .map(
      (line, index) =>
        `<text x="${TITLE_X}" y="${TITLE_START_Y + index * lineHeight}" class="title">${escapeXml(line)}</text>`,
    )
    .join("\n");
  const date = moscowDateParts().label;
  const source = post.sourceName.length > 42 ? `${post.sourceName.slice(0, 39)}…` : post.sourceName;
  const categoryWidth = Math.min(720, Math.max(240, post.category.length * 21 + 70));

  const svg = `
  <svg width="${CARD_WIDTH}" height="1080" viewBox="0 0 ${CARD_WIDTH} 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#07101f"/>
        <stop offset="0.55" stop-color="#14233b"/>
        <stop offset="1" stop-color="#214a78"/>
      </linearGradient>
      <radialGradient id="glow" cx="82%" cy="15%" r="70%">
        <stop offset="0" stop-color="#60a5fa" stop-opacity="0.75"/>
        <stop offset="1" stop-color="#60a5fa" stop-opacity="0"/>
      </radialGradient>
      <style>
        .brand { font: 800 46px system-ui, -apple-system, Segoe UI, sans-serif; letter-spacing: 1px; fill: #f8fafc; }
        .category { font: 800 24px system-ui, -apple-system, Segoe UI, sans-serif; letter-spacing: 2px; fill: #bae6fd; }
        .title { font: 800 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif; fill: #ffffff; }
        .meta { font: 600 25px system-ui, -apple-system, Segoe UI, sans-serif; fill: #cbd5e1; }
        .small { font: 600 22px system-ui, -apple-system, Segoe UI, sans-serif; fill: #93c5fd; }
      </style>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <rect width="1080" height="1080" fill="url(#glow)"/>
    <circle cx="930" cy="170" r="190" fill="none" stroke="#e0f2fe" stroke-opacity="0.18" stroke-width="2"/>
    <circle cx="930" cy="170" r="130" fill="none" stroke="#e0f2fe" stroke-opacity="0.22" stroke-width="2"/>
    <path d="M70 180 H1010" stroke="#94a3b8" stroke-opacity="0.3" stroke-width="2"/>
    <text x="70" y="105" class="brand">FACEFORM</text>
    <text x="70" y="148" class="small">LOOK • STYLE • CARE</text>
    <rect x="70" y="238" width="${categoryWidth}" height="64" rx="32" fill="#0f172a" stroke="#7dd3fc" stroke-opacity="0.6"/>
    <text x="104" y="281" class="category">${escapeXml(post.category)}</text>
    ${titleSvg}
    <rect x="70" y="882" width="940" height="2" fill="#94a3b8" fill-opacity="0.3"/>
    <text x="70" y="938" class="meta">Источник: ${escapeXml(source)}</text>
    <text x="70" y="983" class="meta">${escapeXml(date)}</text>
    <text x="1010" y="983" text-anchor="end" class="small">${escapeXml(channelUsername)}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 9 }).toBuffer();
}
