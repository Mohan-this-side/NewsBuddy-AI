import logging
from typing import List, Optional
from app.services.rag_service import retrieve_relevant_chunks
from app.services.wiki_service import lookup_wikipedia_term, extract_technical_terms

logger = logging.getLogger(__name__)


async def analyze_context(
    query: str,
    article_id: str,
    article_text: str,
    article_summary: str = ""
) -> dict:
    """
    Analyze user query and retrieve relevant context from article.
    Optionally enrich with Wikipedia definitions for technical terms.
    """
    # Retrieve relevant chunks from article
    relevant_chunks = retrieve_relevant_chunks(query, article_id, article_text, top_k=4)
    
    # Check if query contains technical terms that might need explanation
    technical_terms = await extract_technical_terms(query)
    
    # Look up Wikipedia definitions for technical terms
    wiki_definitions = {}
    for term in technical_terms[:2]:  # Limit to 2 lookups to save time
        definition = await lookup_wikipedia_term(term)
        if definition:
            wiki_definitions[term] = definition
    
    return {
        "relevant_chunks": relevant_chunks,
        "wiki_definitions": wiki_definitions,
        "article_summary": article_summary or article_text[:500],
    }
