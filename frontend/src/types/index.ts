export enum NewsCategory {
  HOT = "hot",
  AI = "ai",
  SPORTS = "sports",
  GEOPOLITICS = "geopolitics",
  BUSINESS = "business",
  SCIENCE = "science",
  TRENDING = "trending",
}

export interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  category: NewsCategory;
  description?: string;
  image_url?: string;
  content?: string;
}

export interface NewsResponse {
  articles: Article[];
  total: number;
  page: number;
  page_size: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: "text" | "thinking" | "error" | "pong";
  content?: string;
}
