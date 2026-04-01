import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urlparse, urlunparse
from newspaper import Article as NewspaperArticle
import httpx
from bs4 import BeautifulSoup
from cachetools import TTLCache

from app.config import settings

logger = logging.getLogger(__name__)

# Cache successful scrape results by normalized URL (reuse news_cache TTL)
_scrape_cache: TTLCache[str, str] = TTLCache(maxsize=500, ttl=settings.news_cache_ttl)

MAX_STORE_CHARS = 120_000

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _normalize_url(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip("/") or "/", "", "", ""))


def _trim_article_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > MAX_STORE_CHARS:
        return text[: MAX_STORE_CHARS - 3] + "..."
    return text


async def scrape_article(url: str) -> Optional[str]:
    """
    Extract full article text from URL using multiple methods.
    Tries newspaper3k first, then falls back to BeautifulSoup.
    Returns None if scraping fails.
    """
    if not url or not url.startswith(("http://", "https://")):
        logger.warning(f"Invalid URL provided: {url}")
        return None

    cache_key = _normalize_url(url)
    if cache_key in _scrape_cache:
        logger.debug(f"Scrape cache hit: {cache_key[:80]}...")
        return _scrape_cache[cache_key]

    # Method 1: Try newspaper3k (better for most news sites)
    try:
        article = NewspaperArticle(url, language="en")
        article.download()
        article.parse()

        if article.text and len(article.text.strip()) > 100:
            cleaned_text = _trim_article_text(article.text.strip())
            logger.info(f"Successfully scraped article using newspaper3k: {len(cleaned_text)} chars")
            _scrape_cache[cache_key] = cleaned_text
            return cleaned_text
    except Exception as e:
        logger.debug(f"Newspaper3k failed for {url}: {e}")

    # Method 2: Fallback to BeautifulSoup for basic HTML extraction
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url, headers=_BROWSER_HEADERS)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
                script.decompose()

            content_selectors = [
                "article",
                '[role="main"]',
                ".article-content",
                ".article__body",
                ".post-content",
                ".entry-content",
                ".story-body",
                "main",
                ".content",
            ]

            text_content = None
            for selector in content_selectors:
                content = soup.select_one(selector)
                if content:
                    text_content = content.get_text(separator=" ", strip=True)
                    if len(text_content) > 200:
                        break

            if not text_content or len(text_content) < 200:
                text_content = soup.get_text(separator=" ", strip=True)

            if text_content and len(text_content) > 100:
                cleaned_text = _trim_article_text(text_content)
                logger.info(f"Successfully scraped article using BeautifulSoup: {len(cleaned_text)} chars")
                _scrape_cache[cache_key] = cleaned_text
                return cleaned_text

    except Exception as e:
        logger.debug(f"BeautifulSoup scraping failed for {url}: {e}")

    # Method 3: trafilatura (often better on modern news layouts)
    try:
        import trafilatura

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url, headers=_BROWSER_HEADERS)
            response.raise_for_status()
            html = response.text

        extracted = await asyncio.to_thread(
            lambda: trafilatura.extract(html, include_comments=False, include_tables=False)
        )
        if extracted and len(extracted.strip()) > 150:
            cleaned_text = _trim_article_text(extracted.strip())
            logger.info(f"Successfully scraped article using trafilatura: {len(cleaned_text)} chars")
            _scrape_cache[cache_key] = cleaned_text
            return cleaned_text
    except Exception as e:
        logger.debug(f"Trafilatura failed for {url}: {e}")

    logger.warning(f"All scraping methods failed for {url}")
    return None
