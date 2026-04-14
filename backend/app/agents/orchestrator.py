import logging
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, AIMessage

from app.agents.context_analyzer import analyze_context
from app.agents.reporter import generate_response
from app.constants import compute_content_tier

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    """State for the multi-agent pipeline."""
    article_id: str
    article_text: str
    article_summary: str
    user_query: str
    content_tier: str
    context: dict
    response: str
    conversation_history: Annotated[list, add_messages]


def analyze_query_node(state: AgentState) -> AgentState:
    """Node: Analyze user query and retrieve context."""
    logger.info(f"Analyzing query: {state['user_query']}")
    
    # This will be async in the actual call
    return state


async def retrieve_context_node(state: AgentState) -> AgentState:
    """Node: Retrieve relevant context from article."""
    context = await analyze_context(
        query=state["user_query"],
        article_id=state["article_id"],
        article_text=state["article_text"],
        article_summary=state.get("article_summary", ""),
        content_tier=state.get("content_tier", "full"),
    )
    
    state["context"] = context
    return state


async def generate_response_node(state: AgentState) -> AgentState:
    """Node: Generate response using reporter agent."""
    context = state["context"]
    
    response = await generate_response(
        article_summary=context["article_summary"],
        context_chunks=context["relevant_chunks"],
        user_query=state["user_query"],
        conversation_history=state.get("conversation_history", []),
        content_tier=state.get("content_tier", "full"),
        web_snippets=context.get("web_snippets") or [],
        web_answer=(context.get("web_answer") or "").strip() or None,
    )
    
    state["response"] = response
    return state


def create_agent_graph():
    """Create the LangGraph state machine."""
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("retrieve_context", retrieve_context_node)
    workflow.add_node("generate_response", generate_response_node)
    
    # Define edges
    workflow.set_entry_point("retrieve_context")
    workflow.add_edge("retrieve_context", "generate_response")
    workflow.add_edge("generate_response", END)
    
    return workflow.compile()


# Global graph instance
agent_graph = create_agent_graph()


async def process_query(
    article_id: str,
    article_text: str,
    article_summary: str,
    user_query: str,
    conversation_history: list[dict] = None,
    content_tier: str = "full",
) -> str:
    """
    Process a user query through the multi-agent pipeline.
    """
    try:
        stripped = (article_text or "").strip()
        if not stripped:
            logger.warning("Empty article text for query: %s", user_query)
            return "I'm sorry, but I don't have enough article content to answer your question. Please try refreshing the page."
        if len(stripped) < 50 and compute_content_tier(article_text) != "metadata_only":
            logger.warning("Insufficient article text for query: %s", user_query)
            return "I'm sorry, but I don't have enough article content to answer your question. Please try refreshing the page."
        
        initial_state = {
            "article_id": article_id,
            "article_text": article_text,
            "article_summary": article_summary or article_text[:200],
            "user_query": user_query,
            "content_tier": content_tier or "full",
            "conversation_history": conversation_history or [],
        }
        
        # Run the graph
        result = await agent_graph.ainvoke(initial_state)
        
        response = result.get("response", "")
        if not response or not response.strip():
            logger.warning("Empty response from agent pipeline")
            return "I apologize, but I couldn't generate a response. Please try rephrasing your question."
        
        return response
        
    except Exception as e:
        logger.error(f"Error in process_query: {e}", exc_info=True)
        # Return a helpful fallback response
        error_msg = str(e).lower()
        if "api" in error_msg or "key" in error_msg or "401" in error_msg or "403" in error_msg:
            return ("I'm sorry, but there's an issue with the API configuration. "
                   "Please check your Groq API key. Here's what I can tell you about the article: "
                   f"{article_summary[:300]}...")
        return f"I encountered an error processing your question. Please try again or rephrase it."
