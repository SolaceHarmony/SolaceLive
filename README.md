# SolaceLive - Packetized Speech-to-Speech (Next.js + MLX)

This project is migrating to a Next.js app with a packetized 80 ms speech-to-speech loop using an MLX-backed realtime server. For the current architecture and contracts, see ARCHITECTURE.md and PLAN.md.

Quickstart (current stack)
- Install deps: `npm -C next-server install`
- Start packet WS server: `npm -C next-server run packet:server` (health: http://localhost:8788/health)
- Start Next.js UI: `npm -C next-server run dev` (open: http://localhost:3000/packet-voice and /whisperx)
- Smoke test: `npm -C next-server run smoke`

Key environment variables
- NEXT_PUBLIC_PACKET_WS (default ws://localhost:8788)
- PACKET_SERVER_URL (override base URL for Next API tests if packet server runs on a non-default host/port)
- HF_TOKEN (server-side for /api/hf proxy); NEXT_PUBLIC_HF_TOKEN (optional client-side, for public models only)
- NEXT_PUBLIC_HF_MIRROR=/api/hf (recommended to mirror model assets via local proxy)
- LM_REPO (HF repo id for LM safetensors) or LM_GGUF (absolute GGUF path for text-only LM mode)
- MIMI_REPO (HF repo id for Mimi/tokenizer) or MIMI_LOCAL (absolute local safetensors path)
- Notes: Model readiness visible at http://localhost:8788/weights; encode/decode require real Mimi; LM step requires loaded weights

Documentation
- Architecture and runtime contracts: ARCHITECTURE.md
- Execution plan and milestones: PLAN.md

---

## Additional docs
- Architecture and runtime contracts: ARCHITECTURE.md
- Execution plan and milestones: PLAN.md
- CSM integration details: docs/CSM.md

## Repository layout highlights
- original_csm/: Reference copy of the original CSM code for study and integration planning.
- models/: Contains local model artifacts. The .gguf file here corresponds to the included CSM model (used for LM text-only experiments in this repo).

## Acknowledgments
- Sesame AI Labs for CSM (Conversational Speech Model).
- Kyutai for Moshi (speech–text) and Mimi (streaming codec).
- Hugging Face for model hosting and Transformers ecosystem.

Note: Any legacy content referencing LM Studio has been archived and is not part of this Next.js packetized implementation.

## Profiling
A lightweight LM profiling endpoint is available on the packet server to help measure per‑step generation latency.

- Endpoint: GET http://localhost:8788/profile/lm
- Query params:
  - steps: number of timed steps (default 16; min 1; max 1000)
  - warmup: number of warmup steps before timing (default 2; min 0; max 100)
  - timer or debug: set to 1 (default) to include perStepMs array; 0 to omit

Example:
```
curl "http://localhost:8788/profile/lm?steps=32&warmup=4&timer=1"
```
Response:
```
{
  "ok": true,
  "steps": 32,
  "warmup": 4,
  "totalMs": 420,
  "avgMs": 13.1,
  "perStepMs": [12, 13, ...],
  "tokens": [123, 456, ...]
}
```
Notes:
- Returns 503 if the LM is not ready (weights not loaded).
- In text‑only GGUF mode (audio_codebooks=0) the endpoint still works, feeding only the text channel.
