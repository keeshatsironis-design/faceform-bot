import { config } from "./config.js";
import { fetchFeed, type RssArticle } from "./rss.js";
import type { BotState, ContentCategory, GeneratedPost } from "./types.js";
import { isLikelyDuplicate, moscowDateParts, normalizeUrl } from "./utils.js";

const SAMPLE: GeneratedPost = {
  skip: false,
  category: "РАЗБОР ТРЕНДА",
  title: "Почему мягкая текстура снова вытесняет жёсткую укладку",
  lead: "В свежих образах всё чаще сохраняют естественное движение волос вместо идеально зафиксированной формы.",
  points: [
    "Подвижная текстура делает силуэт легче и современнее.",
    "Форму лучше подбирать под геометрию лица, а не копировать референс целиком.",
    "Для тонких волос обычно важнее лёгкий объём, чем большое количество стайлинга.",
  ],
  takeaway: "Начните с малого: уменьшите количество фиксирующего средства и сохраните движение прядей у лица.",
  sourceName: "FaceForm",
  sourceUrl: "https://t.me/faceform",
  hashtags: ["FaceForm", "стиль", "волосы"],
};

const RELEVANT = [
  "мода", "стиль", "образ", "одежд", "тренд", "волос", "причес", "стриж", "уклад",
  "кож", "уход", "космет", "макияж", "бров", "бород", "груминг", "beauty", "fashion",
  "skincare", "hair", "makeup", "парфюм", "аксессуар", "цвет", "палитр", "силуэт",
];

const EXCLUDED = [
  "похуд", "диет", "инъек", "ботокс", "филлер", "операц", "пластическ", "препарат",
  "лекарств", "лечение", "диагноз", "заболеван", "таблет", "семаглутид", "оземпик",
  "трагед", "убийств", "скандал", "развод", "гороскоп",
];

const CATEGORY_KEYWORDS: Record<ContentCategory, string[]> = {
  "НОВОСТЬ": ["запуст", "представ", "коллекц", "показ", "неделя моды", "бренд", "новинк"],
  "МОДА": ["мода", "стиль", "одежд", "образ", "силуэт", "палитр", "цвет", "аксессуар", "fashion"],
  "ВОЛОСЫ": ["волос", "причес", "стриж", "уклад", "челк", "hair", "бород", "груминг"],
  "УХОД": ["кож", "уход", "космет", "spf", "beauty", "skincare", "макияж", "бров"],
  "ЛУКСМАКСИНГ": ["внешност", "пропорц", "лицо", "осанк", "контраст", "архетип", "луксмакс"],
  "РАЗБОР ТРЕНДА": ["тренд", "популяр", "возвращ", "становится", "снова", "вирусн"],
};

const CATEGORY_ROTATION: ContentCategory[] = ["МОДА", "ВОЛОСЫ", "УХОД", "РАЗБОР ТРЕНДА", "ЛУКСМАКСИНГ"];

const EVERGREEN: Array<Omit<GeneratedPost, "skip" | "sourceUrl">> = [
  {
    category: "МОДА",
    title: "Почему посадка одежды часто важнее громкого бренда",
    lead: "Даже базовый комплект выглядит собраннее, когда линия плеч, длина рукава и объём вещи соответствуют фигуре.",
    points: [
      "Сначала проверяйте плечи и длину — их сложнее всего исправить стилизацией.",
      "Один свободный элемент лучше балансировать более собранным вторым элементом.",
      "Цвет возле лица влияет на впечатление сильнее, чем логотип на вещи.",
    ],
    takeaway: "Перед новой покупкой сфотографируйте образ анфас и сбоку: посадка станет заметнее, чем в зеркале крупным планом.",
    sourceName: "Редакция FaceForm",
    hashtags: ["FaceForm", "мода", "стиль"],
  },
  {
    category: "ВОЛОСЫ",
    title: "Как объяснить мастеру желаемую стрижку без путаницы",
    lead: "Один референс редко показывает всё. Намного полезнее принести несколько примеров и отдельно назвать то, что точно не подходит.",
    points: [
      "Покажите фронтальный, боковой и задний ракурс похожей стрижки.",
      "Уточните, сколько времени готовы тратить на укладку каждый день.",
      "Спросите, как форма будет выглядеть через четыре–шесть недель.",
    ],
    takeaway: "Сохраните три референса и подпишите на каждом конкретную деталь: длина, пробор, объём или текстура.",
    sourceName: "Редакция FaceForm",
    hashtags: ["FaceForm", "волосы", "стрижка"],
  },
  {
    category: "УХОД",
    title: "Почему базовый уход лучше сложной полки из десяти средств",
    lead: "Для повседневной рутины важнее регулярность и переносимость, чем количество активов в одном вечере.",
    points: [
      "Начинайте с мягкого очищения, увлажнения и дневной защиты от солнца.",
      "Новое средство вводите по одному, чтобы понимать реакцию кожи.",
      "Раздражение — повод упростить схему, а не добавлять ещё один актив.",
    ],
    takeaway: "Соберите минимальную стабильную базу и меняйте только один элемент за раз.",
    sourceName: "Редакция FaceForm",
    hashtags: ["FaceForm", "уход", "кожа"],
  },
];

function cleanTitle(title: string, sourceName: string): string {
  let value = title.replace(/\s+/g, " ").trim();
  const suffix = new RegExp(`\\s[-–—|]\\s${sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  value = value.replace(suffix, "").trim();
  return value.slice(0, 112);
}

function inferCategory(text: string): ContentCategory {
  const lower = text.toLowerCase();
  let best: ContentCategory = "РАЗБОР ТРЕНДА";
  let bestScore = 0;
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS) as Array<[ContentCategory, string[]]>) {
    const score = words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

function articleDate(article: RssArticle): Date | null {
  if (!article.publishedAt) return null;
  const date = new Date(article.publishedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function freshnessScore(article: RssArticle): number {
  const date = articleDate(article);
  if (!date) return 2;
  const ageDays = Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
  if (ageDays <= 2) return 12;
  if (ageDays <= 7) return 8;
  if (ageDays <= config.maxArticleAgeDays) return 4;
  return -20;
}

function scoreArticle(article: RssArticle, target: ContentCategory, state: BotState): number {
  const text = `${article.title} ${article.description ?? ""}`.toLowerCase();
  if (EXCLUDED.some((word) => text.includes(word))) return -100;
  if (isLikelyDuplicate(article.title, article.url, state.posts)) return -100;

  let score = freshnessScore(article);
  score += RELEVANT.reduce((sum, word) => sum + (text.includes(word) ? 2 : 0), 0);
  const category = inferCategory(text);
  if (category === target) score += 9;
  if (article.sourceName && article.sourceName !== "Источник") score += 2;
  if (article.title.length >= 35 && article.title.length <= 115) score += 2;
  return score;
}

function contextualPoints(category: ContentCategory): { points: string[]; takeaway: string; hashtags: string[] } {
  switch (category) {
    case "МОДА":
      return {
        points: [
          "Смотрите не только на сам тренд, но и на посадку, масштаб и цвет возле лица.",
          "Один выразительный элемент обычно работает лучше, чем несколько конкурирующих акцентов.",
          "Референс стоит адаптировать под свой гардероб и образ жизни, а не копировать целиком.",
        ],
        takeaway: "Возьмите из новости одну применимую деталь и протестируйте её с уже знакомой базой.",
        hashtags: ["FaceForm", "мода", "стиль"],
      };
    case "ВОЛОСЫ":
      return {
        points: [
          "На результат влияют не только длина и форма, но и естественная текстура волос.",
          "Объём у висков, макушки и подбородка по-разному меняет визуальные пропорции лица.",
          "Перед сменой формы полезно уточнить, сколько укладки потребуется каждый день.",
        ],
        takeaway: "Сохраните идею как направление и обсудите с мастером адаптацию под плотность волос и форму лица.",
        hashtags: ["FaceForm", "волосы", "прическа"],
      };
    case "УХОД":
      return {
        points: [
          "Новинку лучше оценивать по составу, назначению и переносимости, а не только по вирусности.",
          "Вводите одно новое средство за раз и не смешивайте сразу несколько активов.",
          "Базовая рутина остаётся важнее сложной многоступенчатой схемы.",
        ],
        takeaway: "Сначала проверьте, решает ли средство вашу конкретную задачу и не дублирует ли уже имеющийся продукт.",
        hashtags: ["FaceForm", "уход", "косметика"],
      };
    case "ЛУКСМАКСИНГ":
      return {
        points: [
          "Полезный луксмаксинг начинается с управляемых вещей: волосы, одежда, уход и осанка.",
          "Не существует одного универсального идеала — важнее согласованность деталей между собой.",
          "Сравнивайте изменения со своими предыдущими образами, а не с чужими лицами.",
        ],
        takeaway: "Выберите одно безопасное изменение, которое можно оценить по фотографии через две недели.",
        hashtags: ["FaceForm", "луксмаксинг", "образ"],
      };
    default:
      return {
        points: [
          "Не каждый вирусный приём одинаково хорошо работает на разных типах внешности.",
          "Лучше отделять идею тренда от конкретного лица, освещения и профессиональной съёмки.",
          "Самая удачная адаптация обычно сохраняет узнаваемость человека, а не маскирует её.",
        ],
        takeaway: "Используйте тренд как источник одной идеи, а не как обязательную инструкцию целиком.",
        hashtags: ["FaceForm", "тренды", "стиль"],
      };
  }
}

function buildFromArticle(article: RssArticle): GeneratedPost {
  const category = inferCategory(`${article.title} ${article.description ?? ""}`);
  const title = cleanTitle(article.title, article.sourceName);
  const guidance = contextualPoints(category);
  const date = articleDate(article);
  const dateText = date
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" }).format(date)
    : "недавно";

  return {
    skip: false,
    category,
    title,
    lead: `${dateText} в ленте ${article.sourceName} появилась тема, которая может повлиять на то, как мы воспринимаем стиль, уход или подачу образа. Разбираем практический смысл без слепого копирования тренда.`,
    points: guidance.points,
    takeaway: guidance.takeaway,
    sourceName: article.sourceName,
    sourceUrl: normalizeUrl(article.url),
    publishedAt: date?.toISOString(),
    hashtags: guidance.hashtags,
  };
}

function fallbackPost(state: BotState): GeneratedPost {
  const available = EVERGREEN.filter((post) => !state.posts.some((item) => item.title === post.title));
  const pool = available.length ? available : EVERGREEN;
  const index = Math.abs(new Date().getUTCDate() + new Date().getUTCMonth() * 31) % pool.length;
  const post = pool[index];
  return {
    ...post,
    skip: false,
    sourceUrl: config.faceformBotUrl,
  };
}

export async function generatePost(state: BotState): Promise<GeneratedPost> {
  if (config.sampleMode) return SAMPLE;

  const now = moscowDateParts();
  const dayNumber = Number(now.date.replaceAll("-", ""));
  const target = CATEGORY_ROTATION[dayNumber % CATEGORY_ROTATION.length];
  const settled = await Promise.allSettled(config.rssFeeds.map((url) => fetchFeed(url, config.requestTimeoutMs)));
  const articles = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  for (const result of settled) {
    if (result.status === "rejected") console.warn("Один RSS-источник недоступен:", result.reason);
  }

  const ranked = articles
    .map((article) => ({ article, score: scoreArticle(article, target, state) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked[0]) return buildFromArticle(ranked[0].article);
  if (config.allowEvergreenFallback) return fallbackPost(state);
  return {
    skip: true,
    category: "РАЗБОР ТРЕНДА",
    title: "",
    lead: "",
    points: [],
    takeaway: "",
    sourceName: "",
    sourceUrl: "",
    hashtags: [],
  };
}
