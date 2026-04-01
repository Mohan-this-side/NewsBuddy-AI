import logging
import hashlib
import re
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlparse, urlunparse, parse_qs
import feedparser
import httpx
from rapidfuzz import fuzz
from cachetools import TTLCache
from bs4 import BeautifulSoup

from app.models.schemas import Article, NewsCategory
from app.services.scraper_service import scrape_article
from app.config import settings

logger = logging.getLogger(__name__)

# Cache for news articles (15 minute TTL)
news_cache = TTLCache(maxsize=1000, ttl=settings.news_cache_ttl)


def normalize_url(url: str) -> str:
    """Normalize URL for deduplication."""
    parsed = urlparse(url)
    # Remove query params and fragments
    normalized = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        "",
        "",
        ""
    ))
    return normalized.rstrip('/')


def calculate_similarity(title1: str, title2: str) -> float:
    """Calculate title similarity using fuzzy matching."""
    return fuzz.ratio(title1.lower(), title2.lower())


def clean_html_text(text: str) -> str:
    """Remove HTML tags and decode HTML entities."""
    if not text:
        return ""
    # Use BeautifulSoup to clean HTML
    soup = BeautifulSoup(text, 'html.parser')
    # Get text and clean up whitespace
    cleaned = soup.get_text(separator=' ', strip=True)
    # Remove extra whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()


def _rss_entry_best_description(entry) -> str:
    """Prefer summary; fall back to content:encoded / content body (many feeds omit summary)."""
    if getattr(entry, "summary", None):
        t = clean_html_text(entry.summary)
        if len(t) > 40:
            return t[:300] + ("..." if len(t) > 300 else "")
    if getattr(entry, "content", None):
        for item in entry.content:
            val = item.get("value", "") if isinstance(item, dict) else getattr(item, "value", "")
            if val:
                t = clean_html_text(val)
                if len(t) > 40:
                    return t[:300] + ("..." if len(t) > 300 else "")
    desc = getattr(entry, "description", "") or ""
    t = clean_html_text(desc)
    return (t[:297] + "...") if len(t) > 300 else t


def _rss_entry_image_url(entry) -> Optional[str]:
    """Best-effort image from RSS media extensions."""
    try:
        thumbs = getattr(entry, "media_thumbnail", None)
        if thumbs and len(thumbs) > 0:
            u = thumbs[0].get("url") if isinstance(thumbs[0], dict) else None
            if u:
                return u
    except Exception:
        pass
    media = getattr(entry, "media_content", None)
    if media:
        for m in media:
            if not isinstance(m, dict):
                continue
            u = m.get("url")
            if u and str(u).startswith("http"):
                return str(u)
    return None


def extract_google_news_url(link: str) -> str:
    """Extract actual URL from Google News redirect URL."""
    if 'url?q=' in link:
        parsed = urlparse(link)
        query_params = parse_qs(parsed.query)
        if 'q' in query_params:
            return query_params['q'][0]
    return link


def deduplicate_articles(articles: List[Article]) -> List[Article]:
    """Remove duplicate articles based on URL and title similarity."""
    seen_urls = set()
    seen_titles = []
    unique_articles = []
    
    for article in articles:
        normalized_url = normalize_url(str(article.url))
        
        # Check URL exact match
        if normalized_url in seen_urls:
            continue
        
        # Check title similarity (threshold: 85%)
        is_duplicate = False
        for seen_title in seen_titles:
            if calculate_similarity(article.title, seen_title) > 85:
                is_duplicate = True
                break
        
        if not is_duplicate:
            seen_urls.add(normalized_url)
            seen_titles.append(article.title)
            unique_articles.append(article)
    
    return unique_articles


async def fetch_google_news(category: NewsCategory) -> List[Article]:
    """Fetch news from Google News RSS feed."""
    articles = []
    
    # Map our categories to Google News topics
    topic_map = {
        NewsCategory.AI: "TECHNOLOGY",
        NewsCategory.SPORTS: "SPORTS",
        NewsCategory.GEOPOLITICS: "WORLD",
        NewsCategory.BUSINESS: "BUSINESS",
        NewsCategory.SCIENCE: "SCIENCE",
    }
    
    topic = topic_map.get(category)
    if not topic:
        return articles
    
    try:
        # Google News RSS URL
        rss_url = f"https://news.google.com/rss/headlines/section/topic/{topic}?hl=en-US&gl=US&ceid=US:en"
        
        feed = feedparser.parse(rss_url)
        
        for entry in feed.entries[:50]:  # Limit to 50 articles
            try:
                # Extract URL (Google News redirects, get actual link)
                link = extract_google_news_url(entry.link)
                
                # Clean title - remove HTML if present
                title = clean_html_text(entry.title) if entry.title else "No title"
                
                description = _rss_entry_best_description(entry)
                if len(description) > 300:
                    description = description[:297] + "..."
                
                # Parse published date (ensure timezone-naive)
                published_at = datetime.now().replace(tzinfo=None)
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        published_at = datetime(*entry.published_parsed[:6]).replace(tzinfo=None)
                    except:
                        pass
                
                # Get source name
                source_name = 'Google News'
                if hasattr(entry, 'source') and entry.source:
                    source_name = entry.source.get('title', 'Google News')
                elif hasattr(entry, 'tags') and entry.tags:
                    # Try to extract source from tags
                    for tag in entry.tags:
                        if hasattr(tag, 'term'):
                            source_name = tag.term
                            break
                
                article_id = hashlib.md5(link.encode()).hexdigest()
                
                article = Article(
                    id=article_id,
                    title=title,
                    url=link,
                    source=source_name,
                    published_at=published_at,
                    category=category,
                    description=description,
                )
                articles.append(article)
            except Exception as e:
                logger.warning(f"Error parsing Google News entry: {e}")
                continue
                
    except Exception as e:
        logger.error(f"Error fetching Google News: {e}")
    
    return articles


async def fetch_hacker_news() -> List[Article]:
    """Fetch top stories from Hacker News API."""
    articles = []
    
    try:
        async with httpx.AsyncClient() as client:
            # Get top story IDs
            response = await client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
            top_story_ids = response.json()[:30]  # Top 30
            
            # Fetch each story
            for story_id in top_story_ids:
                try:
                    story_response = await client.get(
                        f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
                    )
                    story = story_response.json()
                    
                    if story.get('type') != 'story' or not story.get('url'):
                        continue
                    
                    article_id = hashlib.md5(story['url'].encode()).hexdigest()
                    
                    # Parse timestamp (ensure timezone-naive)
                    published_at = datetime.fromtimestamp(story.get('time', 0)).replace(tzinfo=None)
                    
                    article = Article(
                        id=article_id,
                        title=story.get('title', ''),
                        url=story['url'],
                        source='Hacker News',
                        published_at=published_at,
                        category=NewsCategory.TRENDING,
                        description=f"Score: {story.get('score', 0)} points",
                    )
                    articles.append(article)
                except Exception as e:
                    logger.warning(f"Error fetching Hacker News story {story_id}: {e}")
                    continue
                    
    except Exception as e:
        logger.error(f"Error fetching Hacker News: {e}")
    
    return articles


async def fetch_gnews(category: NewsCategory) -> List[Article]:
    """Fetch news from GNews API (requires API key)."""
    articles = []
    
    if not settings.gnews_api_key:
        logger.info("GNews API key not configured, skipping")
        return articles
    
    # Map categories to GNews query terms
    query_map = {
        NewsCategory.AI: "artificial intelligence OR AI OR machine learning",
        NewsCategory.SPORTS: "sports",
        NewsCategory.GEOPOLITICS: "geopolitics OR international relations",
        NewsCategory.BUSINESS: "business",
        NewsCategory.SCIENCE: "science",
        NewsCategory.HOT: "breaking news",
    }
    
    query = query_map.get(category, "")
    if not query:
        return articles
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://gnews.io/api/v4/search",
                params={
                    "q": query,
                    "lang": "en",
                    "max": 20,
                    "apikey": settings.gnews_api_key,
                },
                timeout=10.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                for article_data in data.get('articles', []):
                    try:
                        article_id = hashlib.md5(article_data['url'].encode()).hexdigest()
                        
                        # Parse published date (ensure timezone-naive)
                        published_at = datetime.now().replace(tzinfo=None)
                        if article_data.get('publishedAt'):
                            try:
                                dt = datetime.fromisoformat(
                                    article_data['publishedAt'].replace('Z', '+00:00')
                                )
                                # Convert to timezone-naive
                                if dt.tzinfo:
                                    published_at = dt.replace(tzinfo=None)
                                else:
                                    published_at = dt
                            except:
                                pass
                        
                        article = Article(
                            id=article_id,
                            title=article_data.get('title', ''),
                            url=article_data['url'],
                            source=article_data.get('source', {}).get('name', 'GNews'),
                            published_at=published_at,
                            category=category,
                            description=article_data.get('description', ''),
                            image_url=article_data.get('image', None),
                        )
                        articles.append(article)
                    except Exception as e:
                        logger.warning(f"Error parsing GNews article: {e}")
                        continue
            else:
                logger.warning(f"GNews API returned status {response.status_code}")
                
    except Exception as e:
        logger.error(f"Error fetching GNews: {e}")
    
    return articles


async def fetch_guardian(category: NewsCategory) -> List[Article]:
    """Optional Guardian Open Platform (free tier with API key)."""
    articles: List[Article] = []
    if not settings.guardian_api_key:
        return articles

    section_map = {
        NewsCategory.AI: "technology",
        NewsCategory.SPORTS: "sport",
        NewsCategory.BUSINESS: "business",
        NewsCategory.SCIENCE: "science",
        NewsCategory.GEOPOLITICS: "world",
    }
    section = section_map.get(category)
    if not section:
        return articles

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://content.guardianapis.com/search",
                params={
                    "api-key": settings.guardian_api_key,
                    "section": section,
                    "page-size": "15",
                    "show-fields": "trailText,thumbnail",
                },
            )
            if r.status_code != 200:
                logger.warning("Guardian API returned status %s", r.status_code)
                return articles
            data = r.json().get("response", {})
            for item in data.get("results", []):
                try:
                    url = item.get("webUrl")
                    if not url:
                        continue
                    title = item.get("webTitle") or "No title"
                    fields = item.get("fields") or {}
                    trail = fields.get("trailText") or ""
                    thumb = fields.get("thumbnail")
                    published_at = datetime.now().replace(tzinfo=None)
                    if item.get("webPublicationDate"):
                        try:
                            dt = datetime.fromisoformat(
                                item["webPublicationDate"].replace("Z", "+00:00")
                            )
                            published_at = dt.replace(tzinfo=None) if dt.tzinfo else dt
                        except Exception:
                            pass
                    article_id = hashlib.md5(url.encode()).hexdigest()
                    desc = clean_html_text(trail) if trail else None
                    if desc and len(desc) > 300:
                        desc = desc[:297] + "..."
                    articles.append(
                        Article(
                            id=article_id,
                            title=clean_html_text(title),
                            url=url,
                            source="The Guardian",
                            published_at=published_at,
                            category=category,
                            description=desc,
                            image_url=thumb,
                        )
                    )
                except Exception as e:
                    logger.warning("Error parsing Guardian article: %s", e)
    except Exception as e:
        logger.error("Error fetching Guardian: %s", e)

    return articles


async def get_news_by_category(
    category: NewsCategory,
    page: int = 1,
    page_size: int = 20
) -> List[Article]:
    """Fetch and aggregate news from all sources for a category."""
    cache_key = f"{category.value}_{page}_{page_size}"
    
    # Check cache
    if cache_key in news_cache:
        return news_cache[cache_key]
    
    all_articles = []
    
    # Fetch from Google News RSS (primary source) - wrap in try/except to prevent failure
    try:
        google_articles = await fetch_google_news(category)
        if google_articles:
            all_articles.extend(google_articles)
            logger.info(f"Fetched {len(google_articles)} articles from Google News")
    except Exception as e:
        logger.error(f"Error fetching Google News: {e}")
    
    # Fetch from NewsAPI.org (free tier) - wrap in try/except
    try:
        newsapi_articles = await fetch_newsapi_org(category)
        if newsapi_articles:
            all_articles.extend(newsapi_articles)
            logger.info(f"Fetched {len(newsapi_articles)} articles from NewsAPI")
    except Exception as e:
        logger.error(f"Error fetching NewsAPI: {e}")
    
    # Fetch from RSS feeds - wrap in try/except
    try:
        rss_articles = await fetch_rss_feeds(category)
        if rss_articles:
            all_articles.extend(rss_articles)
            logger.info(f"Fetched {len(rss_articles)} articles from RSS feeds")
    except Exception as e:
        logger.error(f"Error fetching RSS feeds: {e}")
    
    # Fetch from GNews API if available (optional, requires API key) - wrap in try/except
    if category != NewsCategory.TRENDING:
        try:
            gnews_articles = await fetch_gnews(category)
            if gnews_articles:
                all_articles.extend(gnews_articles)
                logger.info(f"Fetched {len(gnews_articles)} articles from GNews")
        except Exception as e:
            logger.error(f"Error fetching GNews: {e}")
        try:
            guardian_articles = await fetch_guardian(category)
            if guardian_articles:
                all_articles.extend(guardian_articles)
                logger.info(f"Fetched {len(guardian_articles)} articles from Guardian")
        except Exception as e:
            logger.error(f"Error fetching Guardian: {e}")
    
    # If no articles found, return empty list instead of failing
    if not all_articles:
        logger.warning(f"No articles found for category {category.value}")
        return []
    
    # Deduplicate
    unique_articles = deduplicate_articles(all_articles)
    
    # Sort by published date (newest first) - ensure all are timezone-naive
    try:
        unique_articles.sort(key=lambda x: x.published_at.replace(tzinfo=None) if x.published_at.tzinfo else x.published_at, reverse=True)
    except Exception as e:
        logger.warning(f"Error sorting articles: {e}, using default order")
        # If sorting fails, just use the order we got
    
    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    paginated = unique_articles[start:end]
    
    # Cache result
    news_cache[cache_key] = paginated
    
    logger.info(f"Returning {len(paginated)} articles for category {category.value}")
    return paginated


async def fetch_newsapi_org(category: NewsCategory) -> List[Article]:
    """Fetch news from NewsAPI.org (free tier - 100 requests/day)."""
    articles = []
    
    # NewsAPI.org free tier doesn't require API key for headlines endpoint
    # But we'll use it if available for better results
    try:
        async with httpx.AsyncClient() as client:
            # Map categories to NewsAPI categories
            category_map = {
                NewsCategory.AI: "technology",
                NewsCategory.SPORTS: "sports",
                NewsCategory.BUSINESS: "business",
                NewsCategory.SCIENCE: "science",
                NewsCategory.GEOPOLITICS: "general",  # Use general for world news
            }
            
            api_category = category_map.get(category)
            if not api_category:
                return articles
            
            url = "https://newsapi.org/v2/top-headlines"
            params = {
                "category": api_category,
                "country": "us",
                "pageSize": 20,
            }
            if settings.newsapi_api_key:
                params["apiKey"] = settings.newsapi_api_key
            
            response = await client.get(url, params=params, timeout=10.0)
            
            if response.status_code == 200:
                data = response.json()
                for article_data in data.get('articles', []):
                    try:
                        if not article_data.get('url') or article_data.get('url') == '[Removed]':
                            continue
                        
                        article_id = hashlib.md5(article_data['url'].encode()).hexdigest()
                        
                        # Parse published date (ensure timezone-naive)
                        published_at = datetime.now().replace(tzinfo=None)
                        if article_data.get('publishedAt'):
                            try:
                                dt = datetime.fromisoformat(
                                    article_data['publishedAt'].replace('Z', '+00:00')
                                )
                                # Convert to timezone-naive
                                if dt.tzinfo:
                                    published_at = dt.replace(tzinfo=None)
                                else:
                                    published_at = dt
                            except:
                                pass
                        
                        # Clean description
                        description = clean_html_text(article_data.get('description', ''))
                        if len(description) > 300:
                            description = description[:297] + "..."
                        
                        article = Article(
                            id=article_id,
                            title=clean_html_text(article_data.get('title', '')),
                            url=article_data['url'],
                            source=article_data.get('source', {}).get('name', 'NewsAPI'),
                            published_at=published_at,
                            category=category,
                            description=description,
                            image_url=article_data.get('urlToImage'),
                        )
                        articles.append(article)
                    except Exception as e:
                        logger.warning(f"Error parsing NewsAPI article: {e}")
                        continue
            elif response.status_code == 401:
                # 401 is expected when no API key - silently skip
                logger.debug("NewsAPI requires API key (401), skipping")
            else:
                logger.debug(f"NewsAPI returned status {response.status_code}, skipping")
                
    except Exception as e:
        logger.error(f"Error fetching NewsAPI: {e}")
    
    return articles


async def fetch_rss_feeds(category: NewsCategory) -> List[Article]:
    """Fetch news from various RSS feeds."""
    articles = []
    
    # RSS feed URLs by category
    rss_feeds = {
        NewsCategory.AI: [
            "https://feeds.feedburner.com/oreilly/radar",
            "https://www.theverge.com/rss/index.xml",
            "https://techcrunch.com/feed/",
        ],
        NewsCategory.SPORTS: [
            "https://www.espn.com/espn/rss/news",
            "https://feeds.bbci.co.uk/sport/rss.xml",
        ],
        NewsCategory.BUSINESS: [
            "https://feeds.bloomberg.com/markets/news.rss",
            "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        ],
        NewsCategory.SCIENCE: [
            "https://www.scientificamerican.com/rss/all/",
            "https://feeds.nature.com/nature/rss/current",
        ],
        NewsCategory.GEOPOLITICS: [
            "https://feeds.bbci.co.uk/news/world/rss.xml",
            "https://www.aljazeera.com/xml/rss/all.xml",
        ],
    }
    
    feeds = rss_feeds.get(category, [])
    
    for feed_url in feeds[:3]:  # Up to 3 feeds per category (Verge + TechCrunch + …)
        try:
            feed = feedparser.parse(feed_url)
            
            for entry in feed.entries[:15]:  # Limit per feed
                try:
                    link = entry.link
                    title = clean_html_text(entry.title) if entry.title else "No title"
                    description = _rss_entry_best_description(entry)
                    if len(description) > 300:
                        description = description[:297] + "..."
                    
                    published_at = datetime.now().replace(tzinfo=None)
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        try:
                            published_at = datetime(*entry.published_parsed[:6]).replace(tzinfo=None)
                        except:
                            pass
                    
                    source_name = feed.feed.get('title', 'RSS Feed')
                    if hasattr(entry, 'source') and entry.source:
                        source_name = entry.source.get('title', source_name)
                    
                    article_id = hashlib.md5(link.encode()).hexdigest()
                    img = _rss_entry_image_url(entry)
                    
                    article = Article(
                        id=article_id,
                        title=title,
                        url=link,
                        source=source_name,
                        published_at=published_at,
                        category=category,
                        description=description,
                        image_url=img,
                    )
                    articles.append(article)
                except Exception as e:
                    logger.warning(f"Error parsing RSS entry from {feed_url}: {e}")
                    continue
                    
        except Exception as e:
            logger.warning(f"Error fetching RSS feed {feed_url}: {e}")
            continue
    
    return articles


async def get_trending_news(page: int = 1, page_size: int = 20) -> List[Article]:
    """Get trending/hot news across categories."""
    cache_key = f"trending_{page}_{page_size}"
    
    if cache_key in news_cache:
        return news_cache[cache_key]
    
    all_articles = []
    
    # Fetch from Hacker News
    hn_articles = await fetch_hacker_news()
    all_articles.extend(hn_articles)
    
    # Fetch hot news from GNews (if API key available)
    hot_articles = await fetch_gnews(NewsCategory.HOT)
    all_articles.extend(hot_articles)
    
    # Fetch from NewsAPI
    for cat in [NewsCategory.AI, NewsCategory.SPORTS, NewsCategory.BUSINESS]:
        newsapi_articles = await fetch_newsapi_org(cat)
        all_articles.extend(newsapi_articles[:5])  # Limit per category
    
    # If no articles found, return empty list
    if not all_articles:
        logger.warning("No trending articles found")
        return []
    
    # Deduplicate and sort
    unique_articles = deduplicate_articles(all_articles)
    try:
        unique_articles.sort(key=lambda x: x.published_at.replace(tzinfo=None) if x.published_at.tzinfo else x.published_at, reverse=True)
    except Exception as e:
        logger.warning(f"Error sorting trending articles: {e}")
    
    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    paginated = unique_articles[start:end]
    
    news_cache[cache_key] = paginated
    
    logger.info(f"Returning {len(paginated)} trending articles")
    return paginated


async def get_article_by_id(article_id: str, articles: List[Article]) -> Optional[Article]:
    """Find article by ID and fetch full content if needed."""
    article = next((a for a in articles if a.id == article_id), None)
    
    if not article:
        return None
    
    # If content not already fetched, scrape it
    if not article.content:
        content = await scrape_article(str(article.url))
        if content:
            article.content = content
    
    return article
