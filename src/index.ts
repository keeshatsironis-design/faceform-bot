import { createPostCard } from "./card.js";
import { config } from "./config.js";
import { generatePost } from "./generator.js";
import { readState, saveState } from "./state.js";
import { publishPost } from "./telegram.js";
import { isLikelyDuplicate } from "./utils.js";

async function main(): Promise<void> {
  console.log(`[FaceForm Content Bot] запуск ${new Date().toISOString()}`);
  const state = await readState(config.stateFile);
  const post = await generatePost(state);

  if (post.skip) {
    console.log("Надёжная тема не найдена — публикация пропущена.");
    return;
  }

  if (isLikelyDuplicate(post.title, post.sourceUrl, state.posts)) {
    console.log("Модель предложила уже использованную тему — публикация пропущена.");
    return;
  }

  let card: Buffer | undefined;
  if (!config.disableCard) {
    try {
      card = await createPostCard(post, config.channelUsername);
    } catch (error) {
      console.warn("Не удалось создать карточку, отправляем текст:", error);
    }
  }

  const message = await publishPost(post, card);
  if (!config.dryRun) {
    state.posts.push({
      title: post.title,
      sourceUrl: post.sourceUrl,
      publishedAt: new Date().toISOString(),
      telegramMessageId: message.message_id,
    });
    await saveState(config.stateFile, state);
  }
  console.log(`Опубликовано: ${post.title}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Критическая ошибка:", error);
    process.exit(1);
  });
