# Cloud ASR (e.g. Whisper API) — deferred

Per the project progress report, **browser-native speech recognition** is the default. A **cloud STT** (OpenAI Whisper or similar) is a **fallback** only if evaluation shows domain vocabulary or accuracy issues that materially hurt retrieval and answers.

## Why defer

- Adds **latency** and **cost** per utterance; the overall budget must be rebalanced against RAG + LLM + TTS.
- Requires new **API keys**, **audio capture/upload** or streaming plumbing, and **privacy** considerations.

## When to revisit

- After **internal user study** or structured testing shows STT error rate is a top failure mode.
- If implementing, prefer a **feature flag** (e.g. env `ENABLE_CLOUD_STT=1`) and a single backend endpoint that accepts short audio blobs, returns transcript, then reuses the existing WebSocket text path.

No Whisper integration is shipped in this codebase until that bar is met.
