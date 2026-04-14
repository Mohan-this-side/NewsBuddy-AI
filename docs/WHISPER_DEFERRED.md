# Deferred: server-side speech recognition (Whisper, etc.)

This note explains why the project uses **Web Speech API in the browser** for speech-to-text (STT) and does not ship a Whisper (or similar) deployment in the default path.

---

## Current approach

- **STT:** Browser **Web Speech API** (`webkitSpeechRecognition` / `SpeechRecognition`), gated by mic permission and best aligned with **Chromium** (Chrome, Edge, Brave in many setups).  
- **Why:** No extra API key or audio upload pipeline for the course demo; fewer moving parts on the server; works for English in typical desktop setups.

---

## Why Whisper (or cloud STT) is deferred

| Topic | Summary |
|--------|---------|
| **Latency** | Sending audio to a server, transcribing, returning text adds at least one network hop; GPU Whisper on the same host is possible but is ops-heavy for a small team. |
| **Cost / keys** | Cloud STT needs billing or quotas; self-hosted Whisper needs RAM, GPU, or a slow CPU path. |
| **Scope** | Course time went to RAG quality, WebSocket chat, and TTS; STT was acceptable via the browser for the baseline deliverable. |

---

## When we would add Whisper or another engine

- Evaluation shows **browser STT** is the main bottleneck for demos (errors, silence, or slow recognition).  
- We need **non-English** or **off-line** STT with predictable behavior.  
- Privacy rules require **not** using browser vendor STT.

Design sketch: small FastAPI `POST /api/stt/transcribe` that accepts short audio chunks, calls Whisper (or a cloud API), returns text; the companion would stream or send final transcripts into the same WebSocket as typed input.

---

## Related code (today)

- **Frontend:** `frontend/src/hooks/useVoiceRecognition.ts` wraps Web Speech API; the companion sends recognized text over the WebSocket like manual typing.  
- **Backend:** accepts **text** on the chat WebSocket; it does not receive raw microphone audio in the default setup.

---

## Status

**Intentionally deferred** unless a milestone explicitly requires server-side STT. Browser STT remains the default for this project.
