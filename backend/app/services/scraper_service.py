import logging
import re
from typing import Optional
from newspaper import Article as NewspaperArticle
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


async def scrape_article(url: str) -> Optional[str]:
    """
    Extract full article text from URL using multiple methods.
    Tries newspaper3k first, then falls back to BeautifulSoup.
    Returns None if scraping fails.
    """
    if not url or not url.startswith(('http://', 'https://')):
        logger.warning(f"Invalid URL provided: {url}")
        return None
    
    # Method 1: Try newspaper3k (better for most news sites)
    try:
        article = NewspaperArticle(url, language='en')
        article.download()
        article.parse()
        
        if article.text and len(article.text.strip()) > 100:
            cleaned_text = article.text.strip()
            # Remove excessive whitespace
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
            logger.info(f"Successfully scraped article using newspaper3k: {len(cleaned_text)} chars")
            return cleaned_text
    except Exception as e:
        logger.debug(f"Newspaper3k failed for {url}: {e}")
    
    # Method 2: Fallback to BeautifulSoup for basic HTML extraction
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
                script.decompose()
            
            # Try to find main content areas
            content_selectors = [
                'article',
                '[role="main"]',
                '.article-content',
                '.post-content',
                '.entry-content',
                'main',
                '.content',
            ]
            
            text_content = None
            for selector in content_selectors:
                content = soup.select_one(selector)
                if content:
                    text_content = content.get_text(separator=' ', strip=True)
                    if len(text_content) > 200:
                        break
            
            # If no specific content area found, get body text
            if not text_content or len(text_content) < 200:
                text_content = soup.get_text(separator=' ', strip=True)
            
            if text_content and len(text_content) > 100:
                # Clean up text
                cleaned_text = re.sub(r'\s+', ' ', text_content)
                cleaned_text = cleaned_text.strip()
                logger.info(f"Successfully scraped article using BeautifulSoup: {len(cleaned_text)} chars")
                return cleaned_text
                
    except Exception as e:
        logger.debug(f"BeautifulSoup scraping failed for {url}: {e}")
    
    logger.warning(f"All scraping methods failed for {url}")
    return None
