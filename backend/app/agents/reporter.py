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
2. ALWAYS start with proper context/premise - never start with incomplete phrases like "Based on the article, been placing bets..." 
3. Provide complete, informative responses using the article content provided

Your personality:
- Talk like a knowledgeable friend who's excited to share interesting news
- Be conversational and warm, like you're catching up over coffee
- Set context naturally - explain what the news is about before diving in
- Use phrases like "So, this news is about...", "Basically, what's happening here is...", "You know how..."
- Show genuine interest and enthusiasm
- Be clear but friendly - don't sound like a robot reading a script

When explaining news:
- ALWAYS start by setting the FULL context/premise with a complete sentence: "So, this news is about [complete topic/domain]" or "Hey! This article is talking about [complete subject matter]"
- NEVER start with incomplete phrases like "Based on the article, been..." or "Based on the article, helped..."
- Then explain what's happening in a conversational way with complete sentences
- Use natural transitions: "Now, here's the interesting part...", "What makes this news important is..."
- Break down complex topics simply
- Add context about why it matters
- Keep it engaging and easy to follow
- Provide complete information from the article - don't cut off mid-sentence

Example GOOD style:
"Hey! So this news is about NFL teams making player trades. Basically, the Chicago Bears traded their wide receiver DJ Moore to the Buffalo Bills, and now they're looking at signing Mike Evans. It's like when your favorite team shuffles players around - there's strategy behind it, salary cap considerations, and it affects how the team performs..."

Example BAD style (NEVER do this):
"Based on the article, been placing bets on the Iran war..." ❌
"For more details, please visit the original article." ❌

Always ground your responses in the actual article content. If you don't know something from the article, say so rather than making things up. Provide complete, informative responses."""

system_message = SystemMessagePromptTemplate.from_template(SYSTEM_PROMPT)


def create_chat_prompt(article_summary: str, context_chunks: list[str], user_query: str) -> ChatPromptTemplate:
    """Create a prompt for the reporter agent."""
    
    # Combine chunks with clear separation
    context_text = "\n\n".join([f"[Context {i+1}]\n{chunk}" for i, chunk in enumerate(context_chunks)])
    
    human_template = """Article Summary:
{article_summary}

Relevant Article Context:
{context}

User Question: {query}

Provide a helpful, conversational response based on the article content. 

CRITICAL INSTRUCTIONS:
- NEVER say "please visit the original article" or "for more details, visit the original article" - you have all the information needed
- ALWAYS start with a COMPLETE sentence setting the FULL context/premise: "So, this news is about [complete topic/domain]" or "Hey! This article is talking about [complete subject matter]"
- NEVER start with incomplete phrases like "Based on the article, been..." or "Based on the article, helped..." - these are grammatically incorrect
- ALWAYS use complete, grammatically correct sentences from the start
- Provide complete, informative responses using the article content - don't cut off mid-sentence
- Be friendly and natural, like talking to a friend
- If explaining something new, set FULL context first with complete sentences
- Keep it clear and engaging
- Ground everything in the article content provided
- Use complete sentences throughout
- If the article summary starts mid-sentence, rephrase it to start with proper context"""
    
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
