import logging
from typing import List, Optional
from cachetools import LRUCache
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

# Load embedding model once
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
EMBEDDING_DIM = 384  # Dimension for all-MiniLM-L6-v2

# Cache for FAISS indexes (per article)
index_cache = LRUCache(maxsize=100)

# Text splitter
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
)


def create_faiss_index(texts: List[str]) -> tuple[faiss.Index, List[str]]:
    """
    Create a FAISS index from a list of text chunks.
    Returns the index and the list of texts.
    """
    # Generate embeddings
    embeddings = embedding_model.encode(texts, show_progress_bar=False)
    embeddings = np.array(embeddings).astype('float32')
    
    # Create FAISS index
    index = faiss.IndexFlatL2(EMBEDDING_DIM)
    index.add(embeddings)
    
    return index, texts


def get_or_create_index(article_id: str, article_text: str) -> tuple[faiss.Index, List[str]]:
    """
    Get or create a FAISS index for an article.
    Uses caching to avoid rebuilding indexes.
    """
    cache_key = f"index_{article_id}"
    
    if cache_key in index_cache:
        return index_cache[cache_key]
    
    # Split article into chunks
    chunks = text_splitter.split_text(article_text)
    
    if not chunks:
        # Fallback: use full text as single chunk
        chunks = [article_text]
    
    # Create index
    index, chunk_list = create_faiss_index(chunks)
    
    # Cache it
    index_cache[cache_key] = (index, chunk_list)
    
    return index, chunk_list


def _dedupe_overlapping_chunks(chunks: List[str]) -> List[str]:
    """Drop chunks that largely repeat earlier chunks (reduces duplicate lines in LLM output)."""
    out: List[str] = []
    for c in chunks:
        c = c.strip()
        if not c:
            continue
        skip = False
        for o in out:
            if c == o:
                skip = True
                break
            n = min(len(c), len(o), 120)
            if n >= 40 and c[:n] == o[:n]:
                skip = True
                break
            if len(c) >= 60 and len(o) >= 60 and (c[:60] in o or o[:60] in c):
                skip = True
                break
        if not skip:
            out.append(c)
    return out


def retrieve_relevant_chunks(
    query: str,
    article_id: str,
    article_text: str,
    top_k: int = 4,
    content_tier: Optional[str] = None,
) -> List[str]:
    """
    Retrieve top-k most relevant chunks from article for a query.
    For metadata_only, skip vector search and return the short text as context.
    """
    tier = content_tier or "full"
    raw = (article_text or "").strip()

    if tier == "metadata_only":
        if not raw:
            return []
        cap = 1500
        return [raw[:cap] + ("…" if len(raw) > cap else "")]

    if tier == "snippet":
        top_k = min(top_k, 3)

    try:
        if len(raw) < 50:
            return [raw] if raw else []

        # Get or create index
        index, chunks = get_or_create_index(article_id, article_text)
        
        # Embed query
        query_embedding = embedding_model.encode([query], show_progress_bar=False)
        query_embedding = np.array(query_embedding).astype('float32')
        
        # Search
        distances, indices = index.search(query_embedding, min(top_k, len(chunks)))
        
        # Retrieve chunks
        relevant_chunks = [chunks[i] for i in indices[0] if i < len(chunks)]
        return _dedupe_overlapping_chunks(relevant_chunks)
    except Exception as e:
        logger.error(f"Error retrieving chunks: {e}")
        # Fallback: return first chunk
        chunks = text_splitter.split_text(article_text)
        return chunks[:top_k] if chunks else [article_text]
