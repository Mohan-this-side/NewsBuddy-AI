import logging
import httpx
from typing import Optional, List

logger = logging.getLogger(__name__)


async def lookup_wikipedia_term(term: str) -> Optional[str]:
    """
    Look up a technical term on Wikipedia and return a brief summary.
    Returns None if not found or on error.
    """
    try:
        async with httpx.AsyncClient() as client:
            # Use Wikipedia REST API
            search_url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + term.replace(" ", "_")
            
            response = await client.get(search_url, timeout=5.0)
            
            if response.status_code == 200:
                data = response.json()
                extract = data.get('extract', '')
                if extract:
                    # Limit to first 300 characters
                    return extract[:300] + "..." if len(extract) > 300 else extract
            
            return None
    except Exception as e:
        logger.warning(f"Wikipedia lookup failed for '{term}': {e}")
        return None


async def extract_technical_terms(text: str) -> List[str]:
    """
    Simple heuristic to extract potential technical terms from text.
    In production, use NER or a more sophisticated approach.
    """
    # This is a simplified version - look for capitalized terms
    # that might be technical concepts
    import re
    
    # Find capitalized words/phrases (potential technical terms)
    patterns = [
        r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b',  # Capitalized phrases
        r'\b[A-Z]{2,}\b',  # Acronyms
    ]
    
    terms = set()
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            # Filter out common words
            if len(match) > 2 and match not in ['The', 'This', 'That', 'They', 'There']:
                terms.add(match)
    
    return list(terms)[:5]  # Limit to 5 terms
