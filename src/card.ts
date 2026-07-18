import sharp from "sharp";
import type { GeneratedPost } from "./types.js";
import { escapeXml, moscowDateParts } from "./utils.js";

function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

export async function createPostCard(post: GeneratedPost, channelUsername: string): Promise<Buffer> {
  const lines = wrapWords(post.title, 24);
  const titleSvg = lines
    .map((line, index) => `<text x="76" y="${360 + index * 92}" class="title">${escapeXml(line)}</text>`)
    .join("\n");
  const date = moscowDateParts().label;
  const source = post.sourceName.length > 42 ? `${post.sourceName.slice(0, 39)}…` : post.sourceName;

  const svg = `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
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
        .title { font: 800 72px system-ui, -apple-system, Segoe UI, sans-serif; fill: #ffffff; }
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
    <rect x="70" y="238" width="${Math.max(240, post.category.length * 21 + 70)}" height="64" rx="32" fill="#0f172a" stroke="#7dd3fc" stroke-opacity="0.6"/>
    <text x="104" y="281" class="category">${escapeXml(post.category)}</text>
    ${titleSvg}
    <rect x="70" y="882" width="940" height="2" fill="#94a3b8" fill-opacity="0.3"/>
    <text x="70" y="938" class="meta">Источник: ${escapeXml(source)}</text>
    <text x="70" y="983" class="meta">${escapeXml(date)}</text>
    <text x="1010" y="983" text-anchor="end" class="small">${escapeXml(channelUsername)}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 9 }).toBuffer();
}
