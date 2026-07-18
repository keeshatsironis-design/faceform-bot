export type ContentCategory =
  | "НОВОСТЬ"
  | "МОДА"
  | "ВОЛОСЫ"
  | "УХОД"
  | "ЛУКСМАКСИНГ"
  | "РАЗБОР ТРЕНДА";

export interface GeneratedPost {
  skip: boolean;
  category: ContentCategory;
  title: string;
  lead: string;
  points: string[];
  takeaway: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string;
  hashtags: string[];
}

export interface StoredPost {
  title: string;
  sourceUrl: string;
  publishedAt: string;
  telegramMessageId?: number;
}

export interface BotState {
  version: 1;
  posts: StoredPost[];
}
