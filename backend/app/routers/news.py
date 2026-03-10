import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.schemas import NewsCategory, NewsResponse, Article
from app.services.news_service import (
    get_news_by_category,
    get_trending_news,
)
from app.services.scraper_service import scrape_article

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("", response_model=NewsResponse)
async def get_news(
    category: Optional[NewsCategory] = Query(None, description="News category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """Get news articles by category."""
    try:
        if category == NewsCategory.TRENDING or category is None:
            articles = await get_trending_news(page=page, page_size=page_size)
        else:
            articles = await get_news_by_category(category, page=page, page_size=page_size)
        
        # Always return a valid response, even if empty
        return NewsResponse(
            articles=articles or [],
            total=len(articles) if articles else 0,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        logger.error(f"Error in get_news endpoint: {e}", exc_info=True)
        # Return empty response instead of crashing
        return NewsResponse(
            articles=[],
            total=0,
            page=page,
            page_size=page_size,
        )


@router.get("/trending", response_model=NewsResponse)
async def get_trending(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get trending/hot news."""
    try:
        articles = await get_trending_news(page=page, page_size=page_size)
        return NewsResponse(
            articles=articles or [],
            total=len(articles) if articles else 0,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        logger.error(f"Error in get_trending endpoint: {e}", exc_info=True)
        # Return empty response instead of crashing
        return NewsResponse(
            articles=[],
            total=0,
            page=page,
            page_size=page_size,
        )


@router.get("/article/{article_id}", response_model=Article)
async def get_article(article_id: str):
    """Get full article content by ID."""
    try:
        # Search across all categories with larger page size
        all_categories = [
            NewsCategory.AI,
            NewsCategory.SPORTS,
            NewsCategory.GEOPOLITICS,
            NewsCategory.BUSINESS,
            NewsCategory.SCIENCE,
        ]
        
        # Search in parallel for better performance
        import asyncio
        tasks = []
        for category in all_categories:
            tasks.append(get_news_by_category(category, page=1, page_size=50))
        tasks.append(get_trending_news(page=1, page_size=50))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Flatten all articles
        all_articles = []
        for result in results:
            if isinstance(result, list):
                all_articles.extend(result)
        
        # Find article by ID
        article = next((a for a in all_articles if a.id == article_id), None)
        
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Fetch full content if not already available - always try to get full text
        if not article.content or len(article.content) < 500:
            try:
                logger.info(f"Fetching full content for article: {article.title[:50]}...")
                content = await scrape_article(str(article.url))
                if content and len(content) > 100:
                    article.content = content
                    logger.info(f"Successfully fetched {len(content)} characters of content")
                elif article.description and len(article.description) > 100:
                    # Use description as fallback
                    article.content = article.description
                    logger.info("Using description as content")
            except Exception as scrape_error:
                logger.warning(f"Error scraping article content: {scrape_error}")
                # Use description as fallback if scraping fails
                if article.description and len(article.description) > 100:
                    article.content = article.description
                elif not article.content:
                    article.content = article.description or "Full article content is being loaded. Please wait a moment or try refreshing."
        
        return article
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching article {article_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching article: {str(e)}")
