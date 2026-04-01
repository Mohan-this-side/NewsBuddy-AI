# Latency measurement (3s target)

This project treats **~3 seconds** end-to-end (user sends a question → first assistant reply text) as a design goal, not a hard SLA. Measurements are **environment-dependent** (Groq load, article length, browser STT).

## Backend

- **process_query**: Logged as `chat_latency article_id=… process_query_ms=…` in the WebSocket handler after each user turn (`app/routers/chat.py`). This covers RAG + LLM for that request (not TTS).

## Frontend

- After sending a `user_message` over the WebSocket, the client records `performance.now()`.
- Console lines (dev tools):
  - `[latency] first_thinking_ms=…` — time until the `thinking` message.
  - `[latency] first_assistant_text_ms=…` — time until the first `text` message (includes LLM + network; TTS starts after).

## How to benchmark

1. Use **Chrome or Edge** (best Web Speech API behavior per project notes).
2. Hard-refresh the article page, wait for the greeting to finish, then ask a short question and note `first_assistant_text_ms`.
3. Repeat across **cold** (first question after load) vs **warm** (second question) to see cache effects on RAG.
4. Compare with backend `process_query_ms` to separate network/frontend from server work.

## Not included in these logs

- **TTS synthesis** (separate HTTP call to `/api/tts`).
- **Speech-to-text** duration (browser-native); consider Whisper API only if evaluation shows STT as the bottleneck (see `docs/WHISPER_DEFERRED.md`).
