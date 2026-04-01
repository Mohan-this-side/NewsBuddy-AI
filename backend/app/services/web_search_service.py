"""
Optional lite web search (Tavily) to supplement answers when the article lacks
dates, "latest" facts, or other out-of-context details.
"""
import hashlib
import logging
from typing import List, TypedDict

import httpx
from cachetools import TTLCache

from app.config import settings

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"


class WebHit(TypedDict, total=False):
    title: str
    url: str
    snippet: str


class WebSearchResult(TypedDict, total=False):
    """Tavily search: optional LLM answer plus result snippets."""

    hits: List[WebHit]
    answer: str


_cache: TTLCache[str, WebSearchResult] = TTLCache(maxsize=256, ttl=300)


def should_augment_with_web_search(user_query: str) -> bool:
    """
    Heuristic: questions that often need fresher / broader facts than one article.
    Keeps searches rare to save quota and latency.
    """
    q = (user_query or "").strip().lower()
    if len(q) < 10:
        return False

    # In-article summarization / opinion — web rarely helps
    if any(
        x in q
        for x in (
            "why is this important",
            "key points",
            "summarize",
            "explain simply",
            "tell me more about it",
            "what is this article about",
            "what's this article about",
        )
    ):
        return False

    triggers = (
        "when is",
        "when was",
        "when will",
        "when does",
        "when do ",
        "what date",
        "scheduled",
        "official date",
        "ipo ",
        " ipo",
        "going public",
        "listing ",
        "latest ",
        " right now",
        "currently ",
        "as of ",
        "today ",
        "this week",
        "stock price",
        "share price",
        "market cap",
        "valuation ",
        "who is the ceo",
        "chief executive",
        "breaking news",
        "latest news",
        "confirmed ",
        "announced ",
        " how much did",
        " how many ",
        "earnings ",
        "funding round",
        "acquisition ",
        "lawsuit ",
        "investigation ",
        "outside this article",
        "not in the article",
        "search for",
    )
    return any(t in q for t in triggers)


def should_use_tavily_for_general_question(user_query: str) -> bool:
    """
    Heuristic: definitional / general-knowledge questions where Tavily's synthesized
    answer is often more reliable than RAG on a single article alone.
    """
    q = (user_query or "").strip().lower()
    if len(q) < 10:
        return False

    article_scoped = (
        "this article",
        "the article",
        "this piece",
        "this story",
        "summarize",
        "key points",
        "main point",
        "main idea",
        "what's this article",
        "what is this article",
        "explain this article",
        "according to the article",
        "does the article",
        "in the article",
    )
    if any(x in q for x in article_scoped):
        return False

    prefixes = (
        "what is ",
        "what are ",
        "who is ",
        "where is ",
        "define ",
        "how does ",
        "what does ",
        "why does ",
        "when was ",
        "when did ",
        "tell me about ",
        "what do you know about ",
    )
    if any(q.startswith(p) for p in prefixes):
        return True

    mid_phrases = (
        " what is ",
        " who is ",
        " what are ",
        " what does ",
        " how does ",
        " where is ",
    )
    return any(t in q for t in mid_phrases)


def should_call_tavily(user_query: str) -> bool:
    """Run Tavily when either time-sensitive triggers or general-knowledge heuristics match."""
    return should_augment_with_web_search(user_query) or should_use_tavily_for_general_question(
        user_query
    )


def build_search_query(user_query: str, article_title: str = "") -> str:
    q = user_query.strip()
    if article_title:
        t = article_title.strip()[:100]
        combined = f"{q} {t}"
    else:
        combined = q
    return combined[:450]


async def search_web_lite(search_query: str) -> WebSearchResult:
    """
    Call Tavily search with an LLM-synthesized answer plus result snippets.
    """
    empty: WebSearchResult = {"hits": [], "answer": ""}
    if not settings.tavily_api_key or not settings.web_search_enabled:
        return empty

    sq = search_query.strip()[:450]
    if len(sq) < 8:
        return empty

    cache_key = hashlib.sha256(sq.encode("utf-8")).hexdigest()
    if cache_key in _cache:
        return dict(_cache[cache_key])

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                TAVILY_SEARCH_URL,
                json={
                    "api_key": settings.tavily_api_key,
                    "query": sq,
                    "search_depth": "basic",
                    "max_results": 4,
                    "include_answer": "basic",
                    "include_raw_content": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        out: List[WebHit] = []
        for item in (data.get("results") or [])[:4]:
            snip = (item.get("content") or item.get("snippet") or "")[:550]
            out.append(
                {
                    "title": str(item.get("title") or "")[:200],
                    "url": str(item.get("url") or "")[:500],
                    "snippet": snip,
                }
            )

        answer_raw = data.get("answer")
        answer = (str(answer_raw).strip() if answer_raw is not None else "")[:2500]

        result: WebSearchResult = {"hits": out, "answer": answer}
        _cache[cache_key] = result
        logger.info(
            "Tavily: %d snippets, answer_len=%d for query len %d",
            len(out),
            len(answer),
            len(sq),
        )
        return result
    except httpx.HTTPStatusError as e:
        logger.warning("Tavily HTTP error: %s %s", e.response.status_code, e.response.text[:200])
        return empty
    except Exception as e:
        logger.warning("Web search failed: %s", e)
        return empty
