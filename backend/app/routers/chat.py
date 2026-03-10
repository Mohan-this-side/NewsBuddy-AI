import logging
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict
from app.services.news_service import get_article_by_id
from app.agents.orchestrator import process_query
from app.agents.reporter import generate_response
from app.services.rag_service import retrieve_relevant_chunks

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

# Store active WebSocket connections and conversation history
active_connections: Dict[str, WebSocket] = {}
conversation_history: Dict[str, list] = {}
greeting_sent: Dict[str, bool] = {}  # Track if greeting has been sent


async def send_greeting(websocket: WebSocket, article_id: str):
    """Send initial greeting and article summary."""
    try:
        # Get article using the same method as the article endpoint
        from app.services.news_service import get_news_by_category, get_trending_news
        from app.models.schemas import NewsCategory
        import asyncio
        
        # Search across all categories in parallel
        all_categories = [
            NewsCategory.AI,
            NewsCategory.SPORTS,
            NewsCategory.GEOPOLITICS,
            NewsCategory.BUSINESS,
            NewsCategory.SCIENCE,
        ]
        
        tasks = []
        for category in all_categories:
            tasks.append(get_news_by_category(category, page=1, page_size=50))
        tasks.append(get_trending_news(page=1, page_size=50))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Flatten all articles
        all_articles = []
        for result in results:
            if isinstance(result, list):
                all_articles.extend(result)
        
        # Find article by ID
        article = next((a for a in all_articles if a.id == article_id), None)
        
        if not article:
            await websocket.send_json({
                "type": "error",
                "content": "Article not found. Please try refreshing the page."
            })
            return
        
        # Get article content - always try to fetch full text
        if not article.content or len(article.content) < 200:
            from app.services.scraper_service import scrape_article
            logger.info(f"Fetching content for article: {article.title[:50]}...")
            article.content = await scrape_article(str(article.url)) or article.description or ""
        
        # Generate greeting and summary with conversational context
        article_text = article.content or article.description or ""
        article_summary = article_text[:1000] if len(article_text) > 1000 else article_text
        
        # Create a more conversational greeting prompt with better instructions
        greeting_query = (
            f"Greet the user warmly like a friend (say 'Hey!' or 'Hi there!' or similar), then explain this news article in a conversational, buddy-like way. "
            f"\n\nCRITICAL RULES:\n"
            f"1. Start with a COMPLETE sentence setting the FULL context/premise - tell them what domain/topic this news is about with a complete sentence.\n"
            f"   GOOD examples: 'So, this news is about prediction markets and how people are betting on geopolitical events' or 'Hey! This article is talking about tennis player Sonay Kartal's comeback victory' or 'This news is about financial markets recovering after political developments'\n"
            f"   BAD examples: 'Based on the article, been placing bets...' or 'Based on the article, helped kick-start...' - these are incomplete and grammatically wrong\n"
            f"2. NEVER say 'please visit the original article' or 'for more details, visit the original article' - you have the article content, provide complete information\n"
            f"3. Use complete, grammatically correct sentences throughout\n"
            f"4. Provide a friendly, engaging 2-3 sentence summary that sounds natural and conversational\n"
            f"5. If the article content starts mid-sentence, rephrase it to start with proper context\n\n"
            f"Article title: {article.title}\n"
            f"Article category: {article.category}\n"
            f"Article content: {article_summary[:1000]}"
        )
        
        # Get relevant chunks for summary - get more context
        relevant_chunks = retrieve_relevant_chunks(
            "What is this article about? What is the main topic, key information, and overall context?",
            article_id,
            article_text,
            top_k=6  # More chunks for better context
        )
        
        # Use more context for better greeting
        greeting_summary = article_summary[:1200] if len(article_summary) > 1200 else article_summary
        
        greeting = await generate_response(
            article_summary=greeting_summary,
            context_chunks=relevant_chunks,
            user_query=greeting_query,
        )
        
        # Ensure greeting is not empty and starts properly
        if not greeting or not greeting.strip():
            # Create a proper greeting with complete sentences
            greeting = f"Hey! So this news is about {article.category.lower()}. {article.title}. {article_summary[:300]}..."
        else:
            # Clean up greeting - remove any "visit original article" phrases
            greeting = greeting.replace("please visit the original article", "")
            greeting = greeting.replace("For more details, please visit the original article", "")
            greeting = greeting.replace("visit the original article", "")
            greeting = greeting.strip()
            
            # Ensure it starts with proper context if it doesn't already
            if greeting.lower().startswith("based on the article"):
                # Fix incomplete starts
                first_sentence_end = greeting.find('.')
                if first_sentence_end > 0:
                    remaining = greeting[first_sentence_end + 1:].strip()
                    # Try to extract topic from title or category
                    topic = article.category.lower() if article.category else "news"
                    greeting = f"Hey! So this news is about {topic}. {remaining}"
                else:
                    topic = article.category.lower() if article.category else "news"
                    greeting = f"Hey! So this news is about {topic}. {greeting}"
        
        # Only send greeting if not already sent
        if not greeting_sent.get(article_id, False):
            # Send greeting
            await websocket.send_json({
                "type": "text",
                "content": greeting,
            })
            
            # Store article info for this session
            conversation_history[article_id] = [{
                "role": "assistant",
                "content": greeting,
            }]
            
            greeting_sent[article_id] = True
            logger.info(f"Greeting sent successfully for article {article_id}")
            
            # Schedule follow-up question after 8 seconds if no user interaction
            import asyncio
            async def send_followup():
                await asyncio.sleep(8)
                # Check if WebSocket is still connected and user hasn't sent a message
                if article_id in active_connections and article_id in conversation_history:
                    last_messages = conversation_history[article_id]
                    # If last message is from assistant (greeting) and no user message yet
                    user_messages = [m for m in last_messages if m.get("role") == "user"]
                    if len(user_messages) == 0:
                        try:
                            followup = "Would you like me to dive deeper into any specific aspect of this news, or do you have any questions about it?"
                            await websocket.send_json({
                                "type": "text",
                                "content": followup,
                            })
                            conversation_history[article_id].append({
                                "role": "assistant",
                                "content": followup,
                            })
                            logger.info(f"Follow-up question sent for article {article_id}")
                        except Exception as e:
                            try:
                                logger.warning(f"Could not send follow-up question: {e}")
                            except NameError:
                                import logging
                                logging.warning(f"Could not send follow-up question: {e}")
            
            # Schedule follow-up (don't await, let it run in background)
            asyncio.create_task(send_followup())
        
    except Exception as e:
        # Use logger if available, otherwise use print as fallback
        try:
            logger.error(f"Error sending greeting: {e}", exc_info=True)
        except NameError:
            import logging
            logging.error(f"Error sending greeting: {e}", exc_info=True)
        
        error_msg = str(e)
        # Clean up error messages for user display
        if "api" in error_msg.lower() or "key" in error_msg.lower() or "401" in error_msg or "403" in error_msg:
            error_msg = "API authentication error. Please check your Groq API key."
        elif "logger" in error_msg.lower() or "not defined" in error_msg.lower():
            error_msg = "Internal error occurred. Please try again."
        
        try:
            await websocket.send_json({
                "type": "error",
                "content": f"Error generating greeting: {error_msg}"
            })
        except Exception as send_error:
            # If we can't send error message, log it
            try:
                logger.error(f"Failed to send error message: {send_error}")
            except NameError:
                import logging
                logging.error(f"Failed to send error message: {send_error}")


@router.websocket("/ws/chat/{article_id}")
async def websocket_chat(websocket: WebSocket, article_id: str):
    """WebSocket endpoint for chat with AI companion."""
    await websocket.accept()
    active_connections[article_id] = websocket
    
    try:
        # Send initial greeting (only if not already sent)
        if not greeting_sent.get(article_id, False):
            await send_greeting(websocket, article_id)
        
        # Get article content for context (reuse from greeting if available)
        from app.services.news_service import get_news_by_category, get_trending_news
        from app.models.schemas import NewsCategory
        import asyncio
        
        article = None
        article_text = ""
        article_summary = ""
        
        # Search across all categories in parallel
        all_categories = [
            NewsCategory.AI,
            NewsCategory.SPORTS,
            NewsCategory.GEOPOLITICS,
            NewsCategory.BUSINESS,
            NewsCategory.SCIENCE,
        ]
        
        tasks = []
        for category in all_categories:
            tasks.append(get_news_by_category(category, page=1, page_size=50))
        tasks.append(get_trending_news(page=1, page_size=50))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Flatten all articles
        all_articles = []
        for result in results:
            if isinstance(result, list):
                all_articles.extend(result)
        
        # Find article by ID
        article = next((a for a in all_articles if a.id == article_id), None)
        
        if article:
            if not article.content or len(article.content) < 200:
                from app.services.scraper_service import scrape_article
                article.content = await scrape_article(str(article.url)) or article.description or ""
            article_text = article.content or article.description or ""
            article_summary = article.title + ". " + (article.description or article_text[:300])
        
        # Handle messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "user_message":
                user_query = message.get("content", "")
                
                if not user_query.strip():
                    continue
                
                # Add to conversation history
                if article_id not in conversation_history:
                    conversation_history[article_id] = []
                
                # Check if this is the first user message (after greeting)
                is_first_user_message = len([m for m in conversation_history[article_id] if m.get("role") == "user"]) == 0
                
                conversation_history[article_id].append({
                    "role": "user",
                    "content": user_query,
                })
                
                # Send thinking indicator
                await websocket.send_json({
                    "type": "thinking",
                    "content": "Let me think about that...",
                })
                
                # Process query through agent pipeline
                try:
                    # Ensure we have article content
                    if not article_text and article:
                        if not article.content:
                            from app.services.scraper_service import scrape_article
                            article.content = await scrape_article(str(article.url)) or article.description or ""
                        article_text = article.content or article.description or ""
                        article_summary = article.title + ". " + (article.description or article_text[:200])
                    
                    if not article_text:
                        await websocket.send_json({
                            "type": "error",
                            "content": "Sorry, I couldn't load the article content. Please try refreshing the page."
                        })
                        continue
                    
                    response = await process_query(
                        article_id=article_id,
                        article_text=article_text,
                        article_summary=article_summary,
                        user_query=user_query,
                        conversation_history=conversation_history.get(article_id, []),
                    )
                    
                    if not response or not response.strip():
                        response = "I'm sorry, I couldn't generate a response. Could you please rephrase your question?"
                    
                    # Add response to history
                    conversation_history[article_id].append({
                        "role": "assistant",
                        "content": response,
                    })
                    
                    # Send response
                    await websocket.send_json({
                        "type": "text",
                        "content": response,
                    })
                    
                except Exception as e:
                    logger.error(f"Error processing query: {e}", exc_info=True)
                    error_msg = str(e)
                    # Check if it's an API key issue
                    if "api" in error_msg.lower() or "key" in error_msg.lower() or "401" in error_msg or "403" in error_msg:
                        error_msg = "API authentication error. Please check your Groq API key configuration."
                    await websocket.send_json({
                        "type": "error",
                        "content": f"Sorry, I encountered an error: {error_msg}"
                    })
            
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for article {article_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if article_id in active_connections:
            del active_connections[article_id]
        # Don't clear greeting_sent or conversation_history on disconnect
        # to preserve state if user reconnects
