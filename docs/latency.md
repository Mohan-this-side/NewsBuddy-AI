# Latency: what we log and how to read it

This app is built to feel responsive in normal use, but **end-to-end latency is not fixed**. It depends on Groq queue time, article length, embedding work on first open, browser STT, and your network. We treat latency as something to **observe**, not as a hard SLA.

---

## Backend: request logs

`main.py` does not add custom timing middleware by default. For REST routes, you can still read uvicorn / logging output for slow handlers if you add your own instrumentation during development. WebSocket chat latency is dominated by the model and streaming inside the WebSocket handler, not a single HTTP round trip.

---

## Frontend: time to first assistant text (and thinking)

After you send a message (typed or from the mic), the WebSocket hook measures **milliseconds from your send to the first `thinking` or `text` message** from the server and prints:

```49:49:frontend/src/hooks/useWebSocket.ts
            console.info(`[latency] first_assistant_text_ms=${elapsed}`);
```

You may also see **`[latency] first_thinking_ms`** from the same hook when the server sends a `thinking` message before full text. Open **DevTools → Console** and look for lines starting with **`[latency]`**. That is the practical “felt latency” for the assistant stream, excluding optional audio playback.

---

## How to compare backend vs browser

If you need a rough split:

1. Note **`[latency] first_assistant_text_ms`** in the console.  
2. On the server, look at logs around the same time for Groq or handler duration if you add temporary timing in development (we do not ship a separate “LLM-only ms” field in the UI).  
3. Heavy RAG or long articles can add work on the first message for a session; later messages often reuse the same retrieval context.

---

## What we are not promising

- A maximum response time under load.  
- Identical latency across Groq model versions or API regions.  
- STT latency from **Web Speech API**: it is implemented by the browser/OS vendor, not by our server.

Use the metrics above to describe performance honestly in demos or reports.
