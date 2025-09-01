# SolaceLive Architecture (Aligned with Current Code)

This document reflects the current, focused design: Next.js UI + packetized WebSocket server with MLX-based Moshi/Mimi, and a browser WhisperX demo. It is the canonical contract to prevent drift.

## System Overview
- **App**: Next.js (React 19) UI in `next-server/` with packet voice and browser WhisperX pages.
- **Realtime server**: Packetized WebSocket server (TypeScript + MLX) in `next-server/lib/unified/server/server.ts`.
- **Core libs**: Unified library under `next-server/lib/unified/` (WebSocket, models, audio, services).
- **Models**: Moshi (LM) + Mimi (codec) in `next-server/lib/unified/models/moshi-mlx/`.
- **Configuration**: Model configs in `next-server/lib/unified/configs/` (e.g., `moshi_mlx_2b.json`).

## Runtime Targets
- **Audio cadence**: 24 kHz PCM; strict 12.5 Hz steps (80 ms), 1920 samples per step.
- **Packet bridge**: Binary WS frames with typed headers; streaming audio/text partials.
- **No simulation**: All outputs must be model-driven; if weights missing, functions throw.

## Core Components (with filepaths)
- **UI Pages**
  - `next-server/pages/packet-voice.tsx`: Real-time mic capture (24 kHz, 80 ms), packet WS streaming, audio playback, text partials.
  - `next-server/pages/whisperx.tsx`: Browser WhisperX demo; auto register `public/coi-serviceworker.js`.
- **Client Libraries**
  - `lib/unified/core/websocket-client.ts`: `PacketWebSocket`, `SolaceLivePacketClient` (priority queues, acks, heartbeat).
  - `lib/unified/services/packetStreamingService.ts`: Bridges UI to packet server.
  - `lib/unified/utils/audioFrames.ts`: `AudioFrameCapturer` (24 kHz, 1920 samples per frame).
- **Server**
  - `lib/unified/server/server.ts`: Packet WS server (TypeScript, MLX). Per-step LM generation (audio-first), Mimi encode/decode hooks.
- **Models (MLX TS)**
  - `lib/unified/models/moshi-mlx/transformer.ts`: Transformer stack (RMSNorm, MHA, FFN).
  - `lib/unified/models/moshi-mlx/lm.ts`: `LmModel` with `forward()`, `generate()`, `step()`; weights enforced.
  - `lib/unified/models/moshi-mlx/mimi.ts`: `Mimi` streaming API enforcing protocol (24 kHz/12.5 Hz); weights enforced.
  - `lib/unified/models/moshi-mlx/tokenizer.ts`: Interface stub only (audio-first design – no tokenizer bound).

## Data Flows

### Upstream (Mic → Server)
1. UI captures 24 kHz audio; emits 80 ms `Float32Array(1920)` frames.
2. Client sends `AUDIO_CHUNK` packets (critical priority) via packet WS.

### Server (Mimi + LM step)
1. Accumulates exact 80 ms frames; calls `Mimi.encode(frame)` → `[n_q, 1]` tokens.
2. For each new step: `LmModel.step(pad_text_id, per_codebook_audio_token, cache)` → next `[text_id, audio_tokens]`.
3. Calls `Mimi.decode(generated_audio_tokens)` → `Float32Array(1920)`.
4. Streams AUDIO_CHUNK and TEXT_PARTIAL (token ids) to client.

### Downstream (Server → UI)
1. UI plays PCM (24 kHz) and displays text token ids.

## Packet Protocol
- **Header (17 bytes)**: type (u8), priority (u8), sequence (u32-le), timestamp (f64-le), length (u16-le), requiresAck (u8)
- **Types**: HEARTBEAT=0x01, ACK=0x02, AUDIO_CHUNK=0x10, TEXT_PARTIAL=0x20, TEXT_FINAL=0x21, METADATA=0x30
- **Semantics**:
  - Audio frames are 80 ms aligned (1920 32-bit samples @ 24 kHz).
  - ACKs used for final/critical messages; HEARTBEAT every 5s.

### Sequence Diagram (packet voice path)
```
Client (Next)                            Server (MLX)
-------------                            -------------
Mic → 24kHz frames (1920) ──AUDIO_CHUNK──▶ Buffer (80ms aligned)
                                        │
                                        │ Mimi.encode(frame) → [n_q, 1]
                                        │ LmModel.step(pad, tokens, cache)
                                        │ Mimi.decode([n_q, 1]) → PCM(1920)
◀──AUDIO_CHUNK (PCM 1920)────────────────┘
◀──TEXT_PARTIAL (token id)
```

## Model Integration (Config-Driven)
- **Config**: `lib/unified/configs/moshi_mlx_2b.json`
  - `n_q`: number of audio codebooks (RVQ levels)
  - `card`: audio vocab size; `text_card`, `existing_text_padding_id` (text pad only by default)
  - `delays`: per-codebook acoustic delay (to be applied in LM step)
- **LM**: `LmModel.step()` is the canonical per-80ms interface; caches; (pending) delay alignment.
- **Mimi**: `Mimi.streaming()`, `encode()`, `decode()` enforce protocol; require real weights.

## Browser WhisperX (Faster-Whisper)
- **What**: In-browser ASR path using WhisperX/Faster-Whisper semantics for low-latency, privacy-preserving transcription.
- **Components**: `lib/unified/audio/whisperx/*` (engine, VAD, alignment, diarization) and `lib/unified/components/WhisperXDemo.tsx`.
- **Page**: `/whisperx` (COI SW auto-reg via `public/coi-serviceworker.js`).
- **Auth**: `NEXT_PUBLIC_HF_TOKEN` (browser) for gated HF model downloads when required.
- **Providers**: Uses browser-compatible backends (e.g., Transformers.js/Xenova or wasm-backed transcribers) configured inside the WhisperX engine.
- **Why**:
  - Privacy-first: audio stays on-device (no upstream audio).
  - Perceptual latency: faster local partials before server round-trips.
  - Composability: partial text can optionally be packetized as `TEXT_PARTIAL` (normal priority) alongside `AUDIO_CHUNK`.
- **Interplay with Packet Loop**:
  - Default packet loop is audio-first. When WhisperX is enabled, the UI may send partial text (`TEXT_PARTIAL`) to improve perceived responsiveness while still streaming audio for LM/Mimi generation.

### Lightweight Model Loading (Browser)
- **Loader**: `lib/unified/audio/whisperx/utils/modelPrefetch.ts`
  - `prefetchWhisper(model, device)`: warms Transformers.js pipeline and caches weights in IndexedDB.
  - `detectDevice()`: selects `webgpu` when available or falls back to wasm/CPU.
  - `prefetchAlignment()`: preloads alignment models (e.g., wav2vec2) for WhisperX.
- **Token/Access**: `lib/unified/audio/whisperx/utils/hfAuth.ts` applies `NEXT_PUBLIC_HF_TOKEN`/localStorage for gated repos.
- **Backend Mirror (optional)**: Set `NEXT_PUBLIC_HF_MIRROR=https://host/api/hf` to route model assets via a local proxy (improves reliability/rate limits, centralizes auth). The prefetch code supports both Vite (`VITE_HF_MIRROR`) and Next (`NEXT_PUBLIC_HF_MIRROR`).

## Configuration / Env
- `NEXT_PUBLIC_PACKET_WS`: packet server WS URL (`ws://localhost:8788` default)
- `HF_TOKEN`: server-side HF downloads; `NEXT_PUBLIC_HF_TOKEN`: client-side
- Optional legacy LM Studio envs are ignored in packet path

## Canonical Contracts
- Audio frame: `Float32Array(1920) @ 24kHz`
- LM step input: `pad_text_id` + `[n_q, 1]` audio tokens
- LM step output: next text token id + `[n_q, 1]` audio tokens
- Mimi I/O: encode `Float32Array(1920)` → `[n_q, 1]`; decode `[n_q, 1]` → `Float32Array(1920)`
- No tokenizer bound: text is pad-only per step unless numeric tokens are supplied explicitly

## Gaps / Backlog (Design-Aligned)
1. Weight loading: safetensors loader + `hfGet` for LM/Mimi; apply via `LmModel.loadWeights()` and `Mimi.loadWeights()`
2. Acoustic delays: apply `delays` from config in `LmModel.step()`
3. Server cadence: strict 80 ms tick and backpressure/telemetry
4. Telemetry: latency, queue depth, token rates, audio drift endpoints/logs

## How To Run
```bash
# Realtime packet server (MLX)
cd next-server && npm install
npm run packet:server   # ws://localhost:8788

# Next.js UI
npm run dev             # http://localhost:3000
# Open: /packet-voice (packet path), /whisperx (browser WhisperX)
```

## Anti-Drift Practices
- Contracts-first: this document is canonical for step API, packet types, cadence
- Single source: model config (`lib/unified/configs/`) is authoritative (n_q, delays, ids)
- Build scope: `next-server/tsconfig.json` excludes references/experiments; only unified libs compile
- No sim: encode/step/decode throw without real weights; avoids silent drift

## Operational Insights & Guidance

### Invariants & Preconditions
- **No-Simulation Invariant**: `Mimi.encode/ decode` and `LmModel.step/forward/generate` MUST throw if real weights are not loaded; callers treat this as a degraded state (UI keeps running, streaming can continue without model output).
- **Step Contract**: One LM step per 80 ms audio frame. Inputs and outputs strictly follow `[n_q, 1]` audio tokens + optional `pad_text_id` for text. Outputs are streamed immediately per step.
- **Frame Contract**: All upstream audio MUST be `Float32Array(1920)` at 24 kHz. Any resampling or buffering to reach exact 1920 boundary is done client-side (or at capture point) to keep server deterministic.
- **Weight Preconditions**: Weight loaders are responsible to fully populate parameter maps; partial loads are considered invalid (throw). Safetensors + config must agree on dims, `n_q`, vocab sizes.

### QoS, Backpressure, Jitter
- **Priority**: `AUDIO_CHUNK` > `TEXT_FINAL` > `TEXT_PARTIAL` > `METADATA/HEARTBEAT`. Queues enforce priority ordering.
- **Backpressure**: Under load, prefer dropping low-priority text partials first, then skipping decode for a step, before dropping critical audio frames. Never block the event loop.
- **Jitter Buffer (Client)**: Playback schedules audio slightly in the future (small ramp-in/out) to mask network jitter. When buffer underrun occurs, increase target buffer by small increments; log a “missed audio” event.
- **Late Frames**: If a received frame’s presentation time has passed, skip scheduling and optionally bump the buffer target; record metrics.

### Acoustic Delays (Application Plan)
- **Delays Source**: `delays` array from `moshi_mlx_2b.json` indicates per-codebook acoustic delay in steps.
- **Alignment**: In `LmModel.step()`, mask or shift audio embeddings so text and audio are aligned per `delays`. For codebooks that require future context, use padding/null tokens until the delayed positions are available; keep caches consistent.
- **Observability**: Track and emit “effective delay” per stream and ensure step-to-step latency budget remains within target.

### Timebase & Clock Sync
- **Authoritative Time**: Server timestamps packets; client uses sequence + server time to schedule playback. If drift exceeds a threshold (e.g., > 200 ms), client falls back to local clock and resets buffer targets.
- **Ordering**: Sequence numbers ensure reordering tolerance. Late `AUDIO_CHUNK` may be discarded if scheduling horizon elapsed.

### Observability (Planned Metrics)
- **Latency**: Capture encode/step/decode durations, end-to-end (mic → audible) latency, and jitter.
- **Throughput**: Steps per second, token rates, queue depths, late/missed frame counts.
- **Stability**: HF proxy success rates, cache hits, auth failures; number of weight-load attempts.
- **Export**: Surface in `/health` (aggregated) and periodic logs.

### Security & Privacy
- **Browser ASR**: WhisperX runs fully in the browser; audio stays on-device. Partial text is optional (`TEXT_PARTIAL`) and plaintext.
- **Server Token Hygiene**: HF token lives server-side; browsers should use the proxy (`/api/hf`) or a public token with limited scope.
- **Packet Content**: Upstream audio is PCM; downstream audio is PCM. Audio tokens stay server-side unless explicitly exported.

### Failure Modes & Recovery
- **Weights Missing/Invalid**: Model calls throw; system continues streaming audio and text partials if enabled; UI surfaces a clear degraded-state banner.
- **HF Proxy Failures**: Fallback guidance: add/refresh `HF_TOKEN`, accept model licenses, try direct client-side with `NEXT_PUBLIC_HF_TOKEN` for public repos if acceptable.
- **Network Jitter**: Buffer underruns increase target buffer gradually; backpressure drops partials before audio.

### Multi-Stream (Future)
- **Stream IDs**: Extend packet header with `streamId` to support multiple concurrent speakers or sessions per WS. Maintain per-stream caches/state.
- **Mixing**: Client can route streams to separate players or mix channels; server tags metadata with stream identity.

### Adaptivity
- **Dynamic `n_q`**: Allow reducing codebooks under load (trading quality for compute/bandwidth). Must be coordinated with model weights.
- **Step Size**: Keep 80 ms as the hard contract; avoid variable step sizes to preserve determinism.

### Testability & Determinism
- **Smoke Tests**: `/api/test/packet-health`, `/api/test/hf-proxy`, and `npm run smoke` validate basic readiness.
- **Seeding**: If sampling is introduced later (e.g., non-argmax), expose a seed and temperature to allow repeatable runs during testing.

### Resource Targets (Guidance)
- **Server**: Keep per-step encode+step+decode << 80 ms on target hardware (aim for 10–30 ms). Log when budget exceeded.
- **Client**: Avoid audio work on the main thread where possible; keep frame capture and playback lightweight.

## CSM Integration Path (Adapter)
- CSM is a Sesame Conversational Speech Model that generates Mimi RVQ audio codes from text/audio using a Llama backbone plus an audio decoder. As of 2025‑05‑20 it is available in Hugging Face Transformers (>= 4.52.1).
- SolaceLive integrates CSM via a server‑side adapter while keeping the core stack Next.js + TypeScript MLX.

Adapter modes
- Local sidecar (recommended): run the official Python/Transformers service on CUDA; expose HTTP endpoints that return Mimi codes or 24 kHz PCM.
- Hosted Space: point the adapter to a HF Space exposing the same API.

Contract (suggested)
- Request: { text: string; speaker?: number; context?: Array<{ text?: string; speaker?: number; audio?: base64 }>; max_audio_length_ms?: number }
- Response (either):
  - { type: "mimi_codes", n_q, sample_rate: 24000, frame_rate: 12.5, codes: number[][] }
  - { type: "audio_pcm", sample_rate: 24000, pcm: base64(Float32Array) }

Routing
- mimi_codes → decode via server Mimi backend → stream 80 ms AUDIO_CHUNK frames.
- audio_pcm → frame directly into 1920‑sample chunks and stream.

Notes
- GGUF in this repo is for LM text‑only experiments and is unrelated to Mimi. The real‑time voice loop requires Mimi encode/decode via a real backend.


## Local references
- original_csm/: Snapshot of the original CSM codebase included in this repository for reference and future integration.
- models/: Contains local model artifacts. The .gguf file here corresponds to the included CSM model and is used in this repo for LM text-only experiments (unrelated to Mimi).
