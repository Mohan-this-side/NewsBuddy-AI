# Groq TTS Setup Instructions

## Important: Terms Acceptance Required

To use Groq's TTS service, you need to accept the terms for the Orpheus TTS model.

### Steps:

1. Visit: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english
2. Sign in with your Groq account
3. Accept the terms and conditions for the model
4. The system will automatically use Groq TTS after terms are accepted

### If Terms Not Accepted

The system will automatically fall back to Edge TTS (Microsoft's free TTS service) if:
- Terms are not accepted
- Groq TTS API fails for any reason

### Voice Options

Once Groq TTS is enabled, you can use these voices:
- `nova` (default) - Excited, energetic voice - great for news
- `alloy` - Balanced, natural voice
- `echo` - Serious, professional voice
- `fable` - Friendly, warm voice
- `onyx` - Deep, authoritative voice
- `shimmer` - Soft, gentle voice

### Testing

After accepting terms, test with:
```bash
cd backend
python test_tts.py
```

The system will automatically use Groq TTS if available, otherwise fall back to Edge TTS.
