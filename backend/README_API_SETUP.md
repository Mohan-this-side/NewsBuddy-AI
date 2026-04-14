# API keys and `.env` (backend)

The backend reads `backend/.env` via `pydantic-settings`. Below are the variables the app recognizes and what they enable.

> Keep keys private: do not commit `.env`, and do not paste keys into pull requests or screenshots.

---

## Required for core chat

| Variable | Role |
|----------|------|
| `GROQ_API_KEY` | LLM inference (summaries and answers). Get a key from the [Groq Console](https://console.groq.com/keys). |

No Groq key means the agent cannot run.

---

## News sources (optional)

If these are missing, the feed still works from RSS fallbacks and cached entries where available, but category coverage may be thinner.

| Variable | Notes |
|----------|------|
| `GNEWS_API_KEY` | [GNews](https://gnews.io/) — general headlines |
| `NEWSAPI_KEY` | [NewsAPI](https://newsapi.org/) — keyword queries |
| `GUARDIAN_API_KEY` | [Guardian Open Platform](https://open-platform.theguardian.com/) — UK / world coverage |

---

## Web search (optional)

| Variable | Notes |
|----------|------|
| `TAVILY_API_KEY` | [Tavily](https://tavily.com/) — snippets used for grounding when enabled in the agent |

---

## CORS and URLs

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRONTEND_URL` | `http://localhost:3000` | Allowed browser origin for CORS |
| `BACKEND_URL` | `http://localhost:8000` | Backend base URL (also used when the backend needs to refer to itself) |

---

## Groq model IDs (optional overrides)

The app ships with model IDs in `app/config.py`. You can override them in `.env` if you prefer different Groq models:

| Variable | Typical use |
|----------|----------------|
| `GROQ_MODEL` | Main reporter / chat model |
| `GROQ_REASONING_MODEL` | Optional “reasoning” path if configured in code |
| `GROQ_TTS_MODEL` | TTS model when using Groq’s `openai-audio-*` endpoint |

---

## Minimal working `.env` example

```env
# Required for the agent
GROQ_API_KEY=your_groq_api_key_here

# CORS / URLs (adjust if you deploy or change ports)
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

Add optional keys only when you are testing those integrations.
