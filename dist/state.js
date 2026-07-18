import fs from "node:fs/promises";
import path from "node:path";
const EMPTY_STATE = { version: 1, posts: [] };
export async function readState(filePath) {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.posts))
            return EMPTY_STATE;
        return { version: 1, posts: parsed.posts.slice(-120) };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return EMPTY_STATE;
        console.warn("Не удалось прочитать состояние, начинаем с пустого:", error);
        return EMPTY_STATE;
    }
}
export async function saveState(filePath, state) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify({ ...state, posts: state.posts.slice(-120) }, null, 2), "utf8");
    await fs.rename(tempPath, filePath);
}
//# sourceMappingURL=state.js.map