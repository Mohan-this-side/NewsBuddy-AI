import logging
from app.config import settings
from app.services.rag_service import retrieve_relevant_chunks
from app.services.wiki_service import lookup_wikipedia_term, extract_technical_terms
from app.services.web_search_service import (
    build_search_query,
    search_web_lite,
    should_call_tavily,
)

logger = logging.getLogger(__name__)


async def analyze_context(
    query: str,
    article_id: str,
    article_text: str,
    article_summary: str = "",
    content_tier: str = "full",
) -> dict:
    """
    Analyze user query and retrieve relevant context from article.
    Optionally enrich with Wikipedia definitions for technical terms.
    """
    # Retrieve relevant chunks from article
    relevant_chunks = retrieve_relevant_chunks(
        query, article_id, article_text, top_k=4, content_tier=content_tier
    )
    
    wiki_definitions = {}
    if content_tier != "metadata_only":
        technical_terms = await extract_technical_terms(query)
        for term in technical_terms[:2]:  # Limit to 2 lookups to save time
            definition = await lookup_wikipedia_term(term)
            if definition:
                wiki_definitions[term] = definition

    web_snippets: list = []
    web_answer = ""
    if settings.tavily_api_key and settings.web_search_enabled and should_call_tavily(query):
        title_hint = ""
        if article_summary:
            title_hint = article_summary.split(".")[0][:120]
        sq = build_search_query(query, title_hint)
        web_result = await search_web_lite(sq)
        web_snippets = web_result.get("hits") or []
        web_answer = (web_result.get("answer") or "").strip()

    return {
        "relevant_chunks": relevant_chunks,
        "wiki_definitions": wiki_definitions,
        "article_summary": article_summary or article_text[:500],
        "web_snippets": web_snippets,
        "web_answer": web_answer,
    }
