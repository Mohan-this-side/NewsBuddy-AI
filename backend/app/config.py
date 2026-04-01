from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Groq API — chat (Llama). Use llama-3.1-8b-instant for lower token usage if you hit 70b TPD limits.
    groq_api_key: str
    groq_chat_model: str = "llama-3.3-70b-versatile"
    
    # GNews API (optional, has free tier)
    gnews_api_key: Optional[str] = None

    # NewsAPI.org (optional free tier)
    newsapi_api_key: Optional[str] = None

    # Guardian Open Platform (optional free tier)
    guardian_api_key: Optional[str] = None

    # Tavily — optional lite web search for follow-ups (see web_search_service)
    tavily_api_key: Optional[str] = None
    web_search_enabled: bool = True

    # Backend URLs
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    
    # Cache Configuration
    news_cache_ttl: int = 900  # 15 minutes
    faiss_cache_size: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
