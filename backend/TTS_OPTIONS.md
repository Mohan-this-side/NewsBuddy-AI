# TTS options (Groq and Edge)

This file summarizes how speech works in the project and how to adjust voices in code. The running behavior lives in **`backend/app/services/tts_service.py`** (and defaults in **`backend/app/config.py`**).

---

## Pipeline

1. **Try Groq** — Uses Groq’s audio/speech API when the account has access and the call succeeds.  
2. **Fallback: Edge TTS** — Uses the `edge-tts` Python package with a chosen voice if Groq fails or is not configured for speech.

So the app still speaks even when Groq TTS is not enabled for your org.

---

## Groq TTS (primary)

- **Endpoint pattern:** OpenAI-compatible audio speech URL on Groq’s host (see Groq docs for the exact path; our service wraps the same pattern).  
- **Model (example):** `playai-tts` — check Groq’s model list for current speech model IDs.  
- **Voice (example):** `Angelo-PlayAI` — must match a voice Groq documents for that model.

Override in `.env` if needed:

```env
GROQ_TTS_MODEL=playai-tts
GROQ_TTS_VOICE=Angelo-PlayAI
```

Access problems (`403` from Groq) are covered in [GROQ_TTS_SETUP.md](GROQ_TTS_SETUP.md).

---

## Edge TTS (fallback)

- **Library:** `edge-tts` on the backend.  
- **Default voice:** configured in `tts_service.py` (e.g. an en-US neural voice).  
- To use another Edge voice: pick a voice name from Microsoft’s neural list and set the constant or configuration the service uses for the Edge path.

---

## Where to change defaults

| What | Where |
|------|--------|
| Groq model / voice env keys | `app/config.py` + `.env` |
| Groq vs Edge logic, fallbacks | `app/services/tts_service.py` |
| HTTP API for synthesized audio | `app/routers/tts.py` — `POST /api/tts/synthesize` |

---

## Frontend

The companion panel calls **`POST /api/tts/synthesize`** with JSON `{"text":"..."}` and plays the returned audio unless the user has muted playback.
