# Groq TTS: setup and acceptance

Speech is synthesized in two ways:

1. **Primary:** Groq’s speech model (when your account can access it; see acceptance below).  
2. **Fallback:** Microsoft Edge TTS (browser-style `edge-tts` library) when Groq is unavailable or fails.

Implementation: `backend/app/services/tts_service.py` and `POST /api/tts/synthesize`. Behavior is unchanged unless we extend the service.

---

## 1. Groq organization acceptance

Some Groq orgs need **explicit access** to speech models (`playai-tts`, `openai-audio-*`, etc.). If Groq returns `403` when calling the speech endpoint:

1. Check [console.groq.com](https://console.groq.com/) → **Speech** (or **Models**) and your account’s allowed models.
2. Open a support ticket with Groq if speech models are not listed for your org.

Until access is granted, the backend falls back to Edge TTS automatically.

---

## 2. Environment variables

In `backend/.env` (see [README_API_SETUP.md](README_API_SETUP.md)):

```env
GROQ_API_KEY=your_key_here

# Optional overrides (defaults are in app/config.py)
GROQ_TTS_MODEL=playai-tts
# GROQ_TTS_VOICE=Your-Voice-Name-Here
```

`GROQ_TTS_VOICE` is optional; defaults are chosen in `config.py` / `tts_service.py`.

Restart the FastAPI process after changing `.env`.

---

## 3. Curl smoke test

Replace placeholders with your key and a voice your account supports:

```bash
curl "https://api.groq.com/openai/v1/audio/speech" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "playai-tts",
    "voice": "Angelo-PlayAI",
    "input": "Hello from Groq TTS."
  }' \
  --output /tmp/groq_tts_test.mp3
```

- **`200`** and a generated `mp3` → Groq TTS is working outside the app.  
- **`403`** → account/org likely does not have speech enabled; use Edge fallback until Groq enables it.

---

## 4. App route test

With the backend running:

```bash
curl -s -X POST "http://localhost:8000/api/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"Testing TTS synthesis."}' \
  --output /tmp/app_tts_test.mp3
```

You should get binary audio (and metadata headers from the server). The UI plays replies from this path when TTS is not muted.

---

## 5. Voice selection

Supported Groq voices and Edge voices are summarized in [TTS_OPTIONS.md](TTS_OPTIONS.md). Changing defaults involves `tts_service.py` (and optional `config.py`), not only documentation.
