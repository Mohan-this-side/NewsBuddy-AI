# TTS (Text-to-Speech) Options

## Current Implementation

The system now supports **Groq TTS** as the primary provider, with Edge TTS as a fallback.

## Groq TTS (Primary - Recommended)

**Endpoint**: `https://api.groq.com/openai/v1/audio/speech`

**Advantages**:
- More natural, conversational voice quality
- Fast response times
- Uses your existing Groq API key
- OpenAI-compatible API

**Available Voices**:
- `alloy` - Balanced, natural voice
- `echo` - Clear, professional voice  
- `fable` - Warm, friendly voice
- `onyx` - Deep, authoritative voice
- `nova` - Bright, energetic voice (default - good for news)
- `shimmer` - Soft, gentle voice

**Usage**: The system automatically uses Groq TTS. If it fails, it falls back to Edge TTS.

## Edge TTS (Fallback)

**Provider**: Microsoft Edge TTS (free)

**Advantages**:
- Free to use
- Multiple language support
- Good quality

**Disadvantages**:
- Can have 403 errors due to rate limiting
- Less natural than Groq TTS

## Configuration

To change the default voice, update `DEFAULT_VOICE` in `backend/app/services/tts_service.py`:

```python
DEFAULT_VOICE = "nova"  # Change to: alloy, echo, fable, onyx, nova, or shimmer
```

To switch providers, change `TTS_PROVIDER`:

```python
TTS_PROVIDER = "groq"  # Options: "groq" or "edge_tts"
```

## Testing

Test TTS with:
```bash
cd backend
python test_tts.py
```
