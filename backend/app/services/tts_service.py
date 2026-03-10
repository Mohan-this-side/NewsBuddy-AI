import logging
import asyncio
import httpx
from typing import AsyncGenerator
import io
from app.config import settings

logger = logging.getLogger(__name__)

# TTS Provider Options
TTS_PROVIDER = "groq"  # Options: "groq", "edge_tts", "elevenlabs"
GROQ_TTS_MODEL = "piper"  # Groq TTS model: "piper" (fast, natural) or "tts-1" (OpenAI compatible)

# Groq TTS voices (mapped to Orpheus vocal directions)
# Note: Groq TTS requires terms acceptance at: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english
GROQ_VOICES = {
    "alloy": "default - Balanced, natural voice",
    "echo": "serious - Clear, professional voice",
    "fable": "friendly - Warm, friendly voice",
    "onyx": "serious - Deep, authoritative voice",
    "nova": "excited - Bright, energetic voice (recommended for news)",
    "shimmer": "whisper - Soft, gentle voice"
}

DEFAULT_VOICE = "nova"  # Bright, energetic - good for news reporting


async def synthesize_speech_groq(text: str, voice: str = DEFAULT_VOICE) -> bytes:
    """
    Synthesize speech using Groq TTS API (OpenAI-compatible endpoint).
    Returns audio bytes in MP3 format.
    """
    try:
        if not text or not text.strip():
            logger.warning("Empty text provided for TTS synthesis")
            return b""
        
        # Clean text
        clean_text = text.strip()
        if len(clean_text) > 4000:  # Groq limit
            clean_text = clean_text[:4000] + "..."
        
        # Use Groq's OpenAI-compatible TTS endpoint
        url = "https://api.groq.com/openai/v1/audio/speech"
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json"
        }
        
        # Groq uses canopylabs/orpheus-v1-english model
        # Voices: default, cheerful, whisper, serious, friendly, excited
        # Map our voice names to Groq's format
        groq_voice_map = {
            "alloy": "default",
            "echo": "serious", 
            "fable": "friendly",
            "onyx": "serious",
            "nova": "excited",  # Bright, energetic
            "shimmer": "whisper"
        }
        
        groq_voice = groq_voice_map.get(voice.lower(), "excited")
        
        payload = {
            "model": "canopylabs/orpheus-v1-english",  # Groq's TTS model
            "input": clean_text,
            "voice": groq_voice,
            "response_format": "mp3",
            "speed": 1.0  # Normal speed
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                audio_data = response.content
                logger.info(f"Groq TTS synthesis successful: {len(audio_data)} bytes")
                return audio_data
            elif response.status_code == 400 and "terms" in response.text.lower():
                # Terms not accepted - fallback to Edge TTS
                error_msg = "Groq TTS model requires terms acceptance. Visit https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english to accept terms. Falling back to Edge TTS."
                logger.warning(error_msg)
                raise ValueError("GROQ_TERMS_REQUIRED")  # Special error code for fallback
            else:
                error_msg = f"Groq TTS API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise ValueError(error_msg)
                
    except Exception as e:
        logger.error(f"Groq TTS synthesis error: {e}", exc_info=True)
        raise


async def synthesize_speech_edge(text: str, voice: str = "en-US-AriaNeural") -> bytes:
    """
    Synthesize speech using Edge TTS (fallback).
    Returns audio bytes in MP3 format.
    """
    import edge_tts
    
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            if not text or not text.strip():
                logger.warning("Empty text provided for TTS synthesis")
                return b""
            
            clean_text = text.strip()
            if len(clean_text) > 5000:
                clean_text = clean_text[:5000] + "..."
            
            try:
                communicate = edge_tts.Communicate(clean_text, voice)
            except Exception as voice_error:
                logger.warning(f"Voice {voice} failed, trying default: {voice_error}")
                communicate = edge_tts.Communicate(clean_text, "en-US-AriaNeural")
            
            audio_data = b""
            chunk_count = 0
            error_chunks = []
            
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio" and chunk.get("data"):
                    audio_data += chunk["data"]
                    chunk_count += 1
                elif chunk.get("type") == "error":
                    error_msg = chunk.get("data", "Unknown error")
                    error_chunks.append(error_msg)
                    logger.warning(f"TTS chunk error: {error_msg}")
            
            if len(audio_data) == 0:
                if error_chunks:
                    error_msg = "; ".join(str(e) for e in error_chunks[:3])
                    if "403" in error_msg or "Invalid response status" in error_msg:
                        if attempt < max_retries - 1:
                            logger.warning(f"TTS 403 error (attempt {attempt + 1}/{max_retries}), retrying...")
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2
                            continue
                        raise ValueError("TTS service unavailable. Please try again later.")
                    raise ValueError(f"TTS synthesis failed: {error_msg}")
                raise ValueError("TTS synthesis returned empty audio data")
            
            logger.info(f"Edge TTS synthesis successful: {len(audio_data)} bytes, {chunk_count} chunks")
            return audio_data
            
        except ValueError:
            raise
        except Exception as e:
            error_str = str(e).lower()
            if ("403" in error_str or "invalid response status" in error_str or "connection" in error_str) and attempt < max_retries - 1:
                logger.warning(f"TTS error (attempt {attempt + 1}/{max_retries}): {e}, retrying...")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
                continue
            else:
                logger.error(f"Edge TTS synthesis error: {e}", exc_info=True)
                raise
    
    raise ValueError("TTS synthesis failed after all retries")


async def synthesize_speech(text: str, voice: str = DEFAULT_VOICE, provider: str = TTS_PROVIDER) -> bytes:
    """
    Synthesize speech from text using the configured TTS provider.
    Returns audio bytes in MP3 format.
    
    Args:
        text: Text to synthesize
        voice: Voice name (provider-specific)
        provider: TTS provider ("groq" or "edge_tts")
    """
    try:
        if provider.lower() == "groq":
            try:
                return await synthesize_speech_groq(text, voice)
            except ValueError as groq_error:
                error_str = str(groq_error)
                if "GROQ_TERMS_REQUIRED" in error_str:
                    logger.info("Groq TTS terms not accepted, using Edge TTS as fallback")
                else:
                    logger.warning(f"Groq TTS failed, falling back to Edge TTS: {groq_error}")
                return await synthesize_speech_edge(text, "en-US-AriaNeural")
            except Exception as groq_error:
                logger.warning(f"Groq TTS failed, falling back to Edge TTS: {groq_error}")
                return await synthesize_speech_edge(text, "en-US-AriaNeural")
        else:
            return await synthesize_speech_edge(text, voice)
    except Exception as e:
        logger.error(f"TTS synthesis failed with all providers: {e}", exc_info=True)
        raise


async def synthesize_speech_streaming(
    text: str,
    voice: str = DEFAULT_VOICE,
    provider: str = TTS_PROVIDER
) -> AsyncGenerator[bytes, None]:
    """
    Synthesize speech in chunks (sentence by sentence) for streaming.
    """
    import re
    
    # Split text into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    for sentence in sentences:
        if not sentence.strip():
            continue
        
        try:
            if provider.lower() == "groq":
                # For Groq, synthesize each sentence
                audio_chunk = await synthesize_speech_groq(sentence.strip(), voice)
                yield audio_chunk
            else:
                # Edge TTS streaming
                import edge_tts
                communicate = edge_tts.Communicate(sentence.strip(), voice)
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        yield chunk["data"]
        except Exception as e:
            logger.warning(f"Error synthesizing sentence: {e}")
            continue
