from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime
from enum import Enum


class NewsCategory(str, Enum):
    HOT = "hot"
    AI = "ai"
    SPORTS = "sports"
    GEOPOLITICS = "geopolitics"
    BUSINESS = "business"
    SCIENCE = "science"
    TRENDING = "trending"


class ContentTier(str, Enum):
    """How much article body is available for RAG and the reporter."""
    FULL = "full"
    SNIPPET = "snippet"
    METADATA_ONLY = "metadata_only"


class Article(BaseModel):
    id: str
    title: str
    url: HttpUrl
    source: str
    published_at: datetime
    category: NewsCategory
    description: Optional[str] = None
    image_url: Optional[HttpUrl] = None
    content: Optional[str] = None  # Full article text
    content_tier: Optional[ContentTier] = None


class NewsResponse(BaseModel):
    articles: List[Article]
    total: int
    page: int
    page_size: int


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime


class ChatResponse(BaseModel):
    type: str  # "text" or "audio"
    content: Optional[str] = None
    audio_url: Optional[str] = None
