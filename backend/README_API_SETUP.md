# API Key Setup Guide

## Groq API Key Setup

The AI News Reporter requires a valid Groq API key to function. Here's how to set it up:

### Step 1: Get Your Groq API Key

1. Visit [Groq Console](https://console.groq.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (it starts with `gsk_`)

### Step 2: Add API Key to Backend

1. Open `backend/.env` file
2. Add or update the following line:
   ```
   GROQ_API_KEY=gsk_your_actual_api_key_here
   ```
3. Save the file
4. Restart your backend server

### Step 3: Test the API Key

Run the test script:
```bash
cd backend
source venv/bin/activate
python test_groq.py
```

If successful, you should see:
```
✅ SUCCESS! Groq API is working correctly.
```

### Troubleshooting

- **401 Error**: Your API key is invalid or expired. Generate a new one.
- **Rate Limit Error**: You've exceeded the free tier limit (30 requests/minute). Wait a moment and try again.
- **Connection Error**: Check your internet connection and Groq service status.

### Free Tier Limits

- 30 requests per minute
- Sufficient for development and testing
- Upgrade for production use

---

## Optional news APIs (richer headlines and images)

Set any of these in `backend/.env` as needed. All are optional; the app still works with RSS + Google News only.

- **`GNEWS_API_KEY`** — GNews search (already supported).
- **`NEWSAPI_API_KEY`** — [NewsAPI.org](https://newsapi.org/) top headlines (recommended for US headlines + images).
- **`GUARDIAN_API_KEY`** — [Guardian Open Platform](https://open-platform.theguardian.com/) (free developer key).

Restart the backend after changing `.env`.

---

## Optional web search (Tavily)

For follow-up questions that need fresher or broader facts than the article alone (e.g. IPO timing, “when”, latest numbers), the backend can call **Tavily** (lite search).

1. Sign up at [Tavily](https://tavily.com/) and create an API key.
2. In `backend/.env` add:

```env
TAVILY_API_KEY=tvly-...
# Optional — set to false to disable even if the key is set
WEB_SEARCH_ENABLED=true
```

If `TAVILY_API_KEY` is unset, behavior is unchanged (article + RAG only). Searches run only for queries that match simple heuristics (when / IPO / latest / stock price / etc.) to limit cost and latency.
