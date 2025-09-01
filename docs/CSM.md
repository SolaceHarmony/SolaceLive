# CSM (Conversational Speech Model) — Integration in SolaceLive

CSM is Sesame’s speech generation model that produces Mimi RVQ audio codes from text and audio inputs using a Llama backbone and a compact audio decoder.

- 2025-05-20: CSM is available natively in Hugging Face Transformers (v4.52.1).
- 2025-03-13: Sesame released the 1B CSM variant; checkpoints are on Hugging Face.
- A fine‑tuned variant powers the Sesame interactive voice demo.

SolaceLive is a Next.js (React 19) + TypeScript implementation focused on a packetized 80 ms voice loop (Mimi ↔ Moshi). CSM is integrated via a server‑side adapter while keeping our stack in TypeScript.

## Local snapshot & models
- original_csm/: A reference copy of the original CSM code is included here for study and planning future integration.
- models/: Contains local model artifacts. The .gguf file in this folder corresponds to the included CSM model and is used in this repo for LM text-only experiments (it is not used for Mimi).

## How CSM fits SolaceLive
- Moshi: speech–text model used for our 80 ms step loop (TypeScript MLX).
- Mimi: streaming codec (24 kHz → 12.5 Hz tokens); encode/decode required for the loop.
- CSM: can generate Mimi RVQ codes from text/audio. We integrate it as an optional generator via an adapter.

Important clarifications
- GGUF is only used here for LM text‑only experiments (no audio). It is unrelated to Mimi. The voice loop requires Mimi with a real backend.

## Adapter modes
1) Local sidecar (recommended)
- Run the official Python/Transformers CSM server on a CUDA‑capable machine.
- Expose a small HTTP API that returns Mimi codes or 24 kHz PCM.

2) Hosted Space
- Point the adapter to a Hugging Face Space exposing the same API.

Suggested API shape
- Request JSON: { text: string; speaker?: number; context?: Array<{ text?: string; speaker?: number; audio?: base64 }>; max_audio_length_ms?: number }
- Response JSON (either):
  - { type: "mimi_codes", n_q: number, sample_rate: 24000, frame_rate: 12.5, codes: number[][] }
  - { type: "audio_pcm", sample_rate: 24000, pcm: base64(Float32Array) }

Routing into the packet loop
- If mimi_codes: decode via the server Mimi backend and stream AUDIO_CHUNK frames (80 ms) to the client.
- If audio_pcm: frame into 1920‑sample chunks and stream directly.

## Environment variables (proposed)
- CSM_MODE=off|remote|local
- CSM_REMOTE_URL=https://…  (remote Space)
- CSM_LOCAL_URL=http://localhost:8998  (local sidecar)
- CSM_PREFERRED_OUTPUT=mimi|pcm (default: mimi)
- CSM_SPEAKER_DEFAULT=0
- HF_TOKEN (if endpoint/models require auth)

## References / setup (official)
- CSM repo: SesameAILabs/csm
- Transformers >= 4.52.1: native CSM support
- Quickstart summary (Python):
  - Python 3.10; CUDA 12.4/12.6 tested
  - hugggingface-cli login; access Llama‑3.2‑1B and CSM‑1B
  - Optional: ffmpeg for audio ops

## Credits and licenses
- CSM by Sesame AI Labs (see their repo for license details).
- Kyutai: Moshi (speech–text) and Mimi (streaming codec) underpin the step semantics.
- This repository: Next.js + TypeScript implementation (see project LICENSE).
