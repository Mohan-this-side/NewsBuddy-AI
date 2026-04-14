# Re-scrape or enrich article body when shorter than this (snippet-only from RSS/API).
MIN_ARTICLE_BODY_CHARS = 400


def compute_content_tier(article_text: str) -> str:
    """
    Classify how much text we have for grounding.
    Returns ContentTier value strings: full | snippet | metadata_only
    """
    n = len((article_text or "").strip())
    if n >= MIN_ARTICLE_BODY_CHARS:
        return "full"
    if n >= 80:
        return "snippet"
    return "metadata_only"
