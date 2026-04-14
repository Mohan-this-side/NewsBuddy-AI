import logging
import re
from typing import List, Optional

from langchain_groq import ChatGroq
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate

from app.config import settings
from app.services.web_search_service import should_use_tavily_for_general_question

logger = logging.getLogger(__name__)

# Multi-turn: cap tokens roughly by message count and length
_MAX_HISTORY_MESSAGES = 12  # up to 6 user/assistant pairs
_MAX_CHARS_PER_HISTORY_MSG = 800

# Slightly lower temperature on follow-ups reduces rambling and duplicate phrasing
llm = ChatGroq(
    model=settings.groq_chat_model,
    temperature=0.55,
    groq_api_key=settings.groq_api_key,
)


def _is_rate_limit_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return (
        "429" in msg
        or "rate limit" in msg
        or "rate_limit" in msg
        or "tokens per day" in msg
        or "tpd" in msg
    )


def _fallback_when_llm_unavailable(
    article_summary: str,
    user_query: str,
    exc: BaseException,
) -> str:
    """
    Never splice RAG chunk[0] (often starts mid-sentence, e.g. 'November.').
    Use the article lead/summary string only, with honest framing.
    """
    if _is_rate_limit_error(exc):
        lead = (article_summary or "").strip()
        if len(lead) > 120:
            lead = lead[:520] + ("…" if len(article_summary) > 520 else "")
        else:
            lead = "We have limited text for this story right now."
        # User-facing copy avoids provider jargon; details go to logs.
        return (
            "I'm a bit backed up right now, so here's a short take from the article text we have:\n\n"
            + lead
            + "\n\nTry your question again in a minute—I should be able to answer in full then."
        )

    lead = (article_summary or "").strip()
    if len(lead) > 120:
        lead = lead[:520] + ("…" if len(article_summary) > 520 else "")
        return (
            "I couldn't finish an AI-written reply just now (temporary error). "
            "Here's the opening of the story from our copy:\n\n" + lead
        )
    return (
        "I couldn't generate a reply just now—please try sending your question again in a moment."
    )

# System prompt for friendly news reporter buddy persona
SYSTEM_PROMPT = """You are a friendly, enthusiastic AI news reporter buddy who explains news articles like you're talking to a friend.

CRITICAL RULES:
1. NEVER say "please visit the original article" or "for more details, visit the original article" - you have the article content and should provide complete information
2. NEVER start with incomplete phrases like "Based on the article, been placing bets..."
3. Provide complete, informative responses grounded in the article

TWO RESPONSE MODES (the user message will tell you which applies):

A) OPENING GREETING / FIRST SUMMARY OF THE ARTICLE
   - Start with a warm hello, then give a HIGH-LEVEL overview: who did what, what changed, and why it matters—in plain language tied to the headline.
   - You may use phrases like "So, this news is about..." or "Hey! This article is talking about..."
   - Do NOT open with a mid-article fragment, a lone month or date, or a quote before you've explained the story in your own words.
   - Keep it 2–4 short sentences; quotes only after the overview if helpful.

B) FOLLOW-UP QUESTION FROM THE USER (who / what / when / where / why / how / which / yes-no / "name the…", summaries, key points, etc.)
   - Answer ONLY what they asked—do not repeat your opening greeting or re-narrate the whole story unless they asked for that.
   - FIRST LINE (or first bullet block) MUST BE THE DIRECT ANSWER—no preamble. Do not start with "So, this news is about...", "This article discusses...", or scene-setting.
   - For "who is...": name the person and role in the first sentence (e.g. "Senator Ed Markey is a U.S. senator from Massachusetts who led this inquiry.").
   - For "what is Tesla" / "what is X" (company or product): give a short, accurate general definition in the first sentence (e.g. "Tesla is an American electric-vehicle and clean energy company."), then connect to how X appears in THIS article in the next sentences.
   - For "why did this happen": answer the "why" directly first, then support with article details.
   - NEVER splice article quotes into "So, this news is about [fragment]..."—that produces broken grammar like "this news is about said that...". Use complete sentences instead.
   - THEN: Add more context (quotes, background) from the article in a friendly tone.
   - NEVER repeat the same sentence, clause, or quoted line twice in a row. Never duplicate a phrase back-to-back.
   - Example: User asks who the parents are → Start with "The baby's parents are Sonam Kapoor and Anand Ahuja." Then expand.

Your personality in all modes:
- Conversational and warm, like catching up with a friend
- Clear, complete sentences; never robotic
- Separate two kinds of truth: (1) What happened in THIS story—only use the article and any web context blocks below; never invent quotes, names, or numbers for the story. (2) General "what is / where is / who is" questions about a place, term, or entity—answer that directly first with a normal definition (from the Direct Web Answer block when present, or widely known facts). Do not substitute a news recap when they asked for a definition.
- If they asked for a definition and you only have the article, still give a brief correct definition from general knowledge when it is common geographic or public fact—then connect to the article.

Example BAD style (NEVER):
"Based on the article, been placing bets on the Iran war..." ❌
"For more details, please visit the original article." ❌

Ground reporting on the article; definitions and geography questions are answered directly, then tied to the story if useful."""

WEB_CONTEXT_RULES = """

OPTIONAL WEB SNIPPETS may appear below the article context. Rules:
- For what happened in THIS story, prefer the article (and web snippets) over guesswork.
- If a "Direct web answer" block also appears, follow those rules for definitions—do not let "prefer the article" block you from defining a place or term in the first sentence.
- Use web snippets to supplement when the article lacks a specific fact (e.g. IPO date, latest timeline) or says "upcoming" without a date.
- If the article does not give a date and web snippets do not either, say clearly that no specific date appears in the article or in these search results—do not guess.
- If web and article conflict on a story-specific claim, lean on the article for this piece.
- Still: first sentence = direct answer to the user's question."""

WEB_DIRECT_ANSWER_RULES = """

DIRECT WEB ANSWER (when provided above): Short answer synthesized from live web search.
- For general / definitional questions (what is X, who is Y, where is Z, how does … work): Treat it as your PRIMARY factual baseline. Put the substance of that answer in your FIRST sentence in your own warm reporter voice—do not paste it robotically.
- For questions that are mainly about THIS story (what happened here, who said what in the piece): Lead with the article; use the direct web answer only as background if helpful.
- If the web answer and the article disagree on a story-specific fact, trust the article for what happened in this piece, and mention the discrepancy briefly if needed.
- Never name search tools or APIs; speak naturally."""


system_message = SystemMessagePromptTemplate.from_template(SYSTEM_PROMPT)


def _system_prompt_with_tier(content_tier: str) -> str:
    t = (content_tier or "full").lower()
    if t == "metadata_only":
        return SYSTEM_PROMPT + (
            "\n\nCONTENT AVAILABILITY: Full article text is NOT available. You only have headline, category, "
            "and a short excerpt in the context. Do NOT invent names, dates, numbers, or quotes from the article. "
            "For a broad 'what is X' question about a famous company or person, you may give ONE short, widely known "
            "general fact if appropriate, then say what the excerpt does or does not say."
        )
    if t == "snippet":
        return SYSTEM_PROMPT + (
            "\n\nCONTENT AVAILABILITY: You have partial article text (snippet). Anchor claims in the excerpt; "
            "for well-known entities you may add one sentence of common public knowledge before tying to the article."
        )
    return SYSTEM_PROMPT


def _system_with_web_and_tier(
    content_tier: str, include_web: bool, include_web_answer: bool = False
) -> str:
    base = _system_prompt_with_tier(content_tier)
    # Snippet rules first; direct-answer rules last so they win on "what is X" vs article recap.
    if include_web:
        base = base + WEB_CONTEXT_RULES
    if include_web_answer:
        base = base + WEB_DIRECT_ANSWER_RULES
    return base


def _is_opening_summary_instruction(query: str) -> bool:
    """Backend greeting path sends a long instruction; user follow-ups do not match."""
    if not query:
        return False
    q = query.lower()
    return "greet the user warmly" in q or (
        "buddy-like way" in q and "article title:" in q
    )


def _format_web_snippets(web_snippets: Optional[list]) -> str:
    if not web_snippets:
        return ""
    lines = []
    for i, hit in enumerate(web_snippets):
        if not isinstance(hit, dict):
            continue
        title = hit.get("title") or "Result"
        url = hit.get("url") or ""
        snip = (hit.get("snippet") or "").strip()
        lines.append(f"[Web {i + 1}] {title}\nURL: {url}\n{snip}")
    if not lines:
        return ""
    return "\n\n".join(lines)


def _format_web_answer_block(web_answer: Optional[str]) -> str:
    if not web_answer or not str(web_answer).strip():
        return ""
    text = str(web_answer).strip()[:2500]
    return f"""Direct web answer (from live search — follow system rules):
{text}

"""


def _build_turn_human_content(
    article_summary: str,
    context_chunks: list[str],
    user_query: str,
    web_snippets: Optional[list] = None,
    web_answer: Optional[str] = None,
) -> str:
    """Single-turn user content (article + RAG + optional web + instructions) for the current message."""
    context_text = "\n\n".join([f"[Context {i+1}]\n{chunk}" for i, chunk in enumerate(context_chunks)])
    answer_block = _format_web_answer_block(web_answer)
    web_block = _format_web_snippets(web_snippets)
    web_section = ""
    if answer_block:
        web_section += answer_block
    if web_block:
        web_section += f"""Supporting web search results (snippets; may be incomplete):
{web_block}

"""

    ws = web_section
    if _is_opening_summary_instruction(user_query):
        return f"""Article Summary:
{article_summary}

Relevant Article Context:
{context_text}

{ws}Instructions (opening turn): {user_query}

Follow MODE A from the system prompt: warm greeting, then headline-level overview (who/what/stakes), then detail. Never say to visit the original article.
Use complete sentences. Ground everything in the article."""

    return f"""Article Summary:
{article_summary}

Relevant Article Context:
{context_text}

{ws}User question: {user_query}

Follow MODE B from the system prompt.

CRITICAL for this turn:
- Open with the direct answer in the FIRST sentence (no "So, this news is about...", no "This article is about..." unless they only asked what the whole piece is generally about).
- For "key points", "summarize", "main takeaways", "what are the key points": respond with a tight list (3–5 bullets or short numbered lines)—each point in your own words; do NOT reuse the same opening quote or paragraph you used in a prior turn.
- Do not merge a scene-setting opener with a mid-sentence quote from the article (avoid "So, this news is about said that...").
- For entity questions (who/what is X): answer the entity first; then relate to the story.
- NEVER repeat the same sentence or overlapping phrase twice. Do not echo duplicate lines from the context blocks.
- THEN: Add friendly detail from the article—quotes, background, why it matters.
- NEVER say "please visit the original article"
- NEVER use broken phrases like "Based on the article, been..."
- NEVER start with "Here's what the article says:" as a stock phrase—just answer.
- If they asked a definition (what/where is X) and the article only mentions X in passing, answer the definition anyway—do not reply with only the article recap.
- If they asked about the story and the article does not contain that fact, say so after giving what you can from context.
- Use complete sentences throughout"""


def create_chat_prompt(article_summary: str, context_chunks: list[str], user_query: str) -> ChatPromptTemplate:
    """Legacy template factory; prefer _build_turn_human_content + message list for multi-turn."""
    context_text = "\n\n".join([f"[Context {i+1}]\n{chunk}" for i, chunk in enumerate(context_chunks)])

    if _is_opening_summary_instruction(user_query):
        human_template = """Article Summary:
{article_summary}

Relevant Article Context:
{context}

Instructions (opening turn): {query}

Follow MODE A from the system prompt: warm greeting, then headline-level overview (who/what/stakes). Never say to visit the original article.
Use complete sentences. Ground everything in the article."""
    else:
        human_template = """Article Summary:
{article_summary}

Relevant Article Context:
{context}

User question: {query}

Follow MODE B from the system prompt.

CRITICAL for this turn:
- Open with the direct answer in the FIRST sentence (no "So, this news is about...", no "This article is about..." unless they only asked what the whole piece is generally about).
- For key points / summarize / takeaways: use a short bullet or numbered list; do not repeat a prior greeting verbatim.
- Do not merge a scene-setting opener with a mid-sentence quote from the article.
- For entity questions (who/what is X): answer the entity first; then relate to the story.
- NEVER repeat the same sentence or overlapping phrase twice.
- THEN: Add friendly detail from the article—quotes, background, why it matters.
- NEVER say "please visit the original article"
- NEVER use broken phrases like "Based on the article, been..."
- NEVER start with "Here's what the article says:" as a stock phrase.
- If they asked a definition (what/where is X) and the article only mentions X in passing, answer the definition anyway—do not reply with only the article recap.
- If they asked about the story and the article does not contain that fact, say so after giving what you can from context.
- Use complete sentences throughout"""

    human_message = HumanMessagePromptTemplate.from_template(human_template)

    return ChatPromptTemplate.from_messages([
        system_message,
        human_message,
    ])


def _sanitize_reporter_output(text: str) -> str:
    """Remove back-to-back duplicate phrases/sentences the model sometimes emits."""
    if not text:
        return text
    t = text.strip()
    for _ in range(12):
        t2 = re.sub(r"(.{50,}?)\s+\1(\s|$)", r"\1\2", t, flags=re.DOTALL)
        if t2 == t:
            break
        t = t2
    sentences = re.split(r"(?<=[.!?])\s+", t)
    out: List[str] = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if out:
            p = out[-1]
            if s.lower() == p.lower():
                continue
            n = min(80, len(s), len(p))
            if n >= 35 and s[:n].lower() == p[:n].lower():
                continue
        out.append(s)
    return " ".join(out).strip()


def _truncate_msg(content: str) -> str:
    c = content.strip()
    if len(c) <= _MAX_CHARS_PER_HISTORY_MSG:
        return c
    return c[: _MAX_CHARS_PER_HISTORY_MSG - 3] + "..."


def _message_content_to_str(content: object) -> str:
    """LangChain messages may use str or multimodal list content."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" and block.get("text"):
                    parts.append(str(block["text"]))
                elif isinstance(block.get("text"), str):
                    parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return " ".join(parts)
    return str(content)


def _turn_to_role_content(m: object) -> Optional[tuple[str, str]]:
    """
    Normalize one history item. Chat passes dicts; LangGraph add_messages may pass
    HumanMessage / AIMessage objects — both must be supported.
    """
    if isinstance(m, dict):
        role = m.get("role")
        if role not in ("user", "assistant"):
            return None
        return role, _message_content_to_str(m.get("content"))
    if isinstance(m, HumanMessage):
        return "user", _message_content_to_str(m.content)
    if isinstance(m, AIMessage):
        return "assistant", _message_content_to_str(m.content)
    return None


def _history_to_prior_messages(conversation_history: Optional[list]) -> List[BaseMessage]:
    """Convert prior turns (excluding current user message) to LangChain messages."""
    if not conversation_history:
        return []

    turns: List[tuple[str, str]] = []
    for m in conversation_history:
        pair = _turn_to_role_content(m)
        if pair:
            turns.append(pair)

    if len(turns) < 2:
        return []

    # Last message is the current user turn — prior is everything before it
    if turns[-1][0] != "user":
        prior = turns
    else:
        prior = turns[:-1]

    prior = prior[-_MAX_HISTORY_MESSAGES:]
    out: List[BaseMessage] = []
    for role, raw in prior:
        if not raw.strip():
            continue
        low = raw.lower()
        if role == "user" and "greet the user warmly" in low and "article title:" in low and len(raw) > 400:
            continue
        text = _truncate_msg(raw)
        if role == "user":
            out.append(HumanMessage(content=text))
        elif role == "assistant":
            out.append(AIMessage(content=text))
    return out


def _build_message_list(
    article_summary: str,
    context_chunks: list[str],
    user_query: str,
    conversation_history: Optional[list],
    content_tier: str = "full",
    web_snippets: Optional[list] = None,
    web_answer: Optional[str] = None,
) -> List[BaseMessage]:
    """System + prior turns + current turn with full article context."""
    summary_text = article_summary[:1000] if len(article_summary) > 1000 else article_summary
    wa = (web_answer or "").strip()
    has_web_answer = bool(wa)
    has_web = bool(web_snippets) or has_web_answer
    turn_content = _build_turn_human_content(
        summary_text,
        context_chunks,
        user_query,
        web_snippets=web_snippets,
        web_answer=wa or None,
    )

    messages: List[BaseMessage] = [
        SystemMessage(
            content=_system_with_web_and_tier(content_tier, has_web, include_web_answer=has_web_answer)
        ),
    ]
    messages.extend(_history_to_prior_messages(conversation_history))
    messages.append(HumanMessage(content=turn_content))
    return messages


async def generate_response(
    article_summary: str,
    context_chunks: list[str],
    user_query: str,
    conversation_history: list[dict] = None,
    content_tier: str = "full",
    web_snippets: Optional[list] = None,
    web_answer: Optional[str] = None,
) -> str:
    """
    Generate a response using the reporter agent.
    Prior turns are included when conversation_history is non-empty.
    """
    try:
        summary_text = article_summary[:1000] if len(article_summary) > 1000 else article_summary
        history = conversation_history or []
        tier = content_tier or "full"

        messages = _build_message_list(
            article_summary=summary_text,
            context_chunks=context_chunks,
            user_query=user_query,
            conversation_history=history,
            content_tier=tier,
            web_snippets=web_snippets or [],
            web_answer=web_answer,
        )
        response = await llm.ainvoke(messages)
        
        if response and hasattr(response, 'content'):
            return _sanitize_reporter_output(response.content)
        return "I apologize, but I couldn't generate a response. Please check your API configuration."
        
    except Exception as e:
        error_msg = str(e).lower()
        logger.error("Error generating response: %s", e, exc_info=True)

        if "401" in error_msg or "invalid api key" in error_msg or "incorrect api key" in error_msg:
            logger.error("Groq API authentication error: %s", e)
            return ("I'm sorry, but there's an issue with the API configuration. "
                   "Please check your Groq API key. In the meantime, here's what I can tell you about the article: "
                   f"{article_summary[:300]}...")

        if _is_rate_limit_error(e):
            return _fallback_when_llm_unavailable(article_summary, user_query, e)

        wa = (web_answer or "").strip()
        if wa:
            return _sanitize_reporter_output(
                f"{wa} — I had a hiccup polishing that, but that should cover your question. "
                f"Want me to tie it back to this story?"
            )
        if should_use_tavily_for_general_question(user_query):
            return (
                "I hit a glitch finishing that reply—try again in a second. "
                "If it keeps happening, check the server logs for the chat model."
            )

        return _fallback_when_llm_unavailable(article_summary, user_query, e)
