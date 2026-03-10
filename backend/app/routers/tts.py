import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.tts_service import synthesize_speech, synthesize_speech_streaming

router = APIRouter(prefix="/api/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"  # Groq voice: alloy, echo, fable, onyx, nova, shimmer
    provider: str = "groq"  # "groq" or "edge_tts"


@router.post("/synthesize")
async def synthesize(request: TTSRequest):
    """Synthesize speech from text. Returns MP3 audio."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        logger.info(f"TTS request received: text length={len(request.text)}, voice={request.voice}")
        
        audio_data = await synthesize_speech(request.text, request.voice, request.provider)
        
        if not audio_data or len(audio_data) == 0:
            raise HTTPException(status_code=500, detail="TTS synthesis returned empty audio")
        
        logger.info(f"TTS synthesis successful: {len(audio_data)} bytes")
        
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "attachment; filename=speech.mp3",
                "Content-Length": str(len(audio_data))
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")


@router.post("/synthesize-stream")
async def synthesize_stream(request: TTSRequest):
    """Synthesize speech in streaming chunks."""
    try:
        return StreamingResponse(
            synthesize_speech_streaming(request.text, request.voice, request.provider),
            media_type="audio/mpeg",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS streaming failed: {str(e)}")
