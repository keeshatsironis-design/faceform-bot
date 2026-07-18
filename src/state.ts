import fs from "node:fs/promises";
import path from "node:path";
import type { BotState, StoredPost } from "./types.js";

const EMPTY_STATE: BotState = { version: 1, posts: [] };

export async function readState(filePath: string): Promise<BotState> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BotState>;
    if (!Array.isArray(parsed.posts)) return EMPTY_STATE;
    return { version: 1, posts: parsed.posts.slice(-120) as StoredPost[] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_STATE;
    console.warn("Не удалось прочитать состояние, начинаем с пустого:", error);
    return EMPTY_STATE;
  }
}

export async function saveState(filePath: string, state: BotState): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify({ ...state, posts: state.posts.slice(-120) }, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}
