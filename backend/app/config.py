from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Groq API
    groq_api_key: str
    
    # GNews API (optional, has free tier)
    gnews_api_key: Optional[str] = None
    
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
