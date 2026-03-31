import logging
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Groq LLM
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.7,
    groq_api_key=settings.groq_api_key,
)

# System prompt for friendly news reporter buddy persona
SYSTEM_PROMPT = """You are a friendly, enthusiastic AI news reporter buddy who explains news articles like you're talking to a friend.

CRITICAL RULES:
1. NEVER say "please visit the original article" or "for more details, visit the original article" - you have the article content and should provide complete information
2. NEVER start with incomplete phrases like "Based on the article, been placing bets..."
3. Provide complete, informative responses grounded in the article

TWO RESPONSE MODES (the user message will tell you which applies):

A) OPENING GREETING / FIRST SUMMARY OF THE ARTICLE
   - Start with a warm hello and set the premise: what this story is about in clear, complete sentences
   - You may use phrases like "So, this news is about..." or "Hey! This article is talking about..."
   - Then give a short, friendly overview

B) FOLLOW-UP QUESTION FROM THE USER (who / what / when / where / why / how / which / yes-no / "name the…", etc.)
   - FIRST: Answer the question directly in one or two short sentences with the specific facts (names, dates, roles) from the article
   - Do NOT open with vague scene-setting like "So, this news is about the latest addition to the family..." when they asked a pointed question—lead with the answer
   - THEN: Add more context in the same friendly tone (reactions, quotes, background, why it matters)
   - Example: User asks who the parents are → Start with "The baby's parents are Sonam Kapoor and Anand Ahuja." Then expand with grandfather Anil Kapoor, Instagram, etc.

Your personality in all modes:
- Conversational and warm, like catching up with a friend
- Clear, complete sentences; never robotic
- Never make up facts not supported by the article; if the article doesn't say, say so after giving what you can

Example BAD style (NEVER):
"Based on the article, been placing bets on the Iran war..." ❌
"For more details, please visit the original article." ❌

Always ground your responses in the actual article content."""

system_message = SystemMessagePromptTemplate.from_template(SYSTEM_PROMPT)


def _is_opening_summary_instruction(query: str) -> bool:
    """Backend greeting path sends a long instruction; user follow-ups do not match."""
    if not query:
        return False
    q = query.lower()
    return "greet the user warmly" in q or (
        "buddy-like way" in q and "article title:" in q
    )


def create_chat_prompt(article_summary: str, context_chunks: list[str], user_query: str) -> ChatPromptTemplate:
    """Create a prompt for the reporter agent."""
    
    # Combine chunks with clear separation
    context_text = "\n\n".join([f"[Context {i+1}]\n{chunk}" for i, chunk in enumerate(context_chunks)])

    if _is_opening_summary_instruction(user_query):
        human_template = """Article Summary:
{article_summary}

Relevant Article Context:
{context}

Instructions (opening turn): {query}

Follow MODE A from the system prompt: warm greeting, then premise and short overview. Never say to visit the original article.
Use complete sentences. Ground everything in the article."""
    else:
        human_template = """Article Summary:
{article_summary}

Relevant Article Context:
{context}

User question: {query}

Follow MODE B from the system prompt.

CRITICAL for this turn:
- FIRST sentences: Give the direct answer to their question (names, dates, yes/no, the specific fact they asked for). No roundabout "this news is about..." opening unless the question is truly vague.
- THEN: Add friendly follow-up detail from the article—reactions, quotes, family context, why people care.
- NEVER say "please visit the original article"
- NEVER use broken phrases like "Based on the article, been..."
- If the article does not contain the answer, say so clearly after attempting what you can from the text
- Use complete sentences throughout"""

    human_message = HumanMessagePromptTemplate.from_template(human_template)
    
    return ChatPromptTemplate.from_messages([
        system_message,
        human_message,
    ])


async def generate_response(
    article_summary: str,
    context_chunks: list[str],
    user_query: str,
    conversation_history: list[dict] = None
) -> str:
    """
    Generate a response using the reporter agent.
    """
    try:
        prompt = create_chat_prompt(article_summary, context_chunks, user_query)
        
        # Format prompt with values - ensure we have enough context
        context_text = "\n\n".join(context_chunks) if context_chunks else article_summary[:500]
        
        # Use more context for better responses
        summary_text = article_summary[:1000] if len(article_summary) > 1000 else article_summary
        
        formatted_prompt = prompt.format_messages(
            article_summary=summary_text,
            context=context_text,
            query=user_query,
        )
        
        # Generate response
        response = await llm.ainvoke(formatted_prompt)
        
        if response and hasattr(response, 'content'):
            return response.content
        return "I apologize, but I couldn't generate a response. Please check your API configuration."
        
    except Exception as e:
        error_msg = str(e).lower()
        if "401" in error_msg or "invalid" in error_msg or "api" in error_msg or "key" in error_msg:
            logger.error(f"Groq API authentication error: {e}")
            return ("I'm sorry, but there's an issue with the API configuration. "
                   "Please check your Groq API key. In the meantime, here's what I can tell you about the article: "
                   f"{article_summary[:300]}...")
        else:
            logger.error(f"Error generating response: {e}")
            # Provide a fallback response based on context - NEVER mention visiting original article
            if context_chunks:
                # Extract a complete sentence from context
                context_text = context_chunks[0]
                # Find first complete sentence
                sentences = context_text.split('. ')
                if sentences and len(sentences[0]) > 20:
                    return f"So, this news is about {sentences[0]}. {context_text[:300]}..."
                return f"So, this news covers {context_text[:300]}..."
            return f"I apologize, but I encountered an error. Here's what I can tell you: {article_summary[:300]}..."
