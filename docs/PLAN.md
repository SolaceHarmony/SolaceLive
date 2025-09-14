# Project Plan: Real‑Time Packetized Speech‑to‑Speech (Next.js + MLX)

**Purpose**
- Deliver a privacy‑first, low‑latency speech‑to‑speech assistant using a packetized 80 ms loop (Mimi → Moshi) with a browser UI and a local MLX server. No simulation; all outputs must be weight‑backed.

**What We’re Building**
- Upstream PCM (24 kHz, 80 ms) → Mimi encode → Moshi LM step → Mimi decode → Downstream PCM.
- Browser WhisperX (Faster‑Whisper semantics) for optional on‑device partial transcripts.
- Packet protocol with priority, acks, heartbeats, and backpressure.

**Architecture Summary (canonical paths)**
- UI (Next.js): `next-server/pages/{packet-voice,whisperx}.tsx`
- Packet server (TypeScript + MLX): `next-server/lib/unified/server/server.ts`
- Models (MLX TS): `next-server/lib/unified/models/moshi-mlx/{mimi.ts,lm.ts,transformer.ts}`
- Config: `next-server/lib/unified/configs/moshi_mlx_2b.json`
- WS client: `next-server/lib/unified/core/websocket-client.ts`
- Frame capture: `next-server/lib/unified/utils/audioFrames.ts`
- HF proxy: `next-server/pages/api/hf/[...path].ts` (server `HF_TOKEN`)

**Protocol Contracts**
- Audio frame: `Float32Array(1920) @ 24kHz` (80 ms exact)
- Mimi: `encode(frame) -> [n_q,1]`, `decode([n_q,1]) -> PCM(1920)`
- LM step: input `pad_text_id + [n_q,1]`, output `next_text_id + [n_q,1]`
- Packet header (17B): `type:u8`, `priority:u8`, `seq:u32le`, `timestamp:f64le`, `len:u16le`, `ack:u8`
- Types: `AUDIO_CHUNK=0x10`, `TEXT_PARTIAL=0x20`, `TEXT_FINAL=0x21`, `METADATA=0x30`, `HEARTBEAT=0x01`, `ACK=0x02`

**Workstreams**
- Realtime engine: strict 80 ms step loop (encode → step → decode) with caches, no placeholders.
- WhisperX (browser): model prefetch, WebGPU/wasm fallback, optional `TEXT_PARTIAL` streaming.
- Infra: HF proxy, smoke tests, health endpoints, mirror support (`NEXT_PUBLIC_HF_MIRROR=/api/hf`).
- Observability: health checks now; step latency/queue/token‑rate metrics next.

**Milestones**
- M1 Weights & E2E: Load full LM/Mimi safetensors; enable encode/step/decode end‑to‑end (no partial/minimal subset).
- M2 Delays & Stability: Apply `delays` in LM step; harden 80 ms pacing/backpressure; add core metrics.
- M3 UX Polish: Optional tokenizer for readable text; partials UI toggle; status/metrics panels.
- M4 Productization: Configurable models, docs for deployment, simple installer.

**Near‑Term (Next 2 Weeks)**
- Implement safetensors loaders and wire `LmModel.loadWeights()` / `Mimi.loadWeights()`.
- Apply `delays` from `moshi_mlx_2b.json` in `LmModel.step()`.
- Add step latency + queue depth metrics; expose in `/health`.
- Validate end‑to‑end flow: audio continuity, step pacing, smoke tests green.

**Execution Checklist (trackable)**
- [x] Consolidate to Next.js + MLX; remove Vite root and unused refs
- [x] Packet server + client framing (80 ms @ 24 kHz)
- [x] HF proxy + mirror support; smoke tests and test endpoints
- [x] Browser WhisperX demo + partials toggle in packet UI
- [ ] Safetensors weight loaders for Moshi/Mimi; wire `loadWeights()`
- [ ] Apply `delays` in `LmModel.step()` and validate alignment
- [x] Add metrics (step latency, queue depth, underruns) to `/health`
- [ ] E2E validation against success metrics (< 200 ms, underruns < 1%)
- [ ] Deployment docs + simple configuration guide
- [ ] Archive/experiments relocation (see below)

**Execution Strategy Update (Aggressive, No‑Simulation)**

Immediate (1–3 days)
- Loaders: Implement safetensors weight loading for LM/Mimi (server‑side first). Validate shapes against `moshi_mlx_2b.json` and fail fast on mismatch.
- LM delays: Apply acoustic `delays` in `LmModel.step()` (shift/mask per codebook; maintain cache alignment).
- Telemetry: Add step metrics (encode/step/decode timings, queue depth, underruns) to `/health`.

Short Term (3–7 days)
- Refine dead‑code report: Treat all `pages/**/*.tsx` as entrypoints; add library‑only unreferenced view.
- Status panel: In `/packet-voice`, display step rate, queue depth, last decode ms, and packet server health.
- Browser VAD option: Integrate a real VAD backend (onnxruntime‑web Silero or WebRTC‑VAD); add UI toggle; throw if not ready.

Medium Term (1–2 weeks)
- Tokenizer (server‑only, optional): Add SentencePiece runtime to map token ids ↔ text.
- Backpressure policies: Drop low‑priority `TEXT_PARTIAL` first; skip decode when over budget; expose counters.

Implementation Notes
- Safetensors mapping: Group tensors by layer/param (q/k/v/o, w1/2/3, norms). Reject partial loads.
- Mimi: Keep codec server‑side initially; expose explicit "not ready" errors (no simulation).
- Strict 80 ms loop: One LM step per audio frame; sequentially process bursts; never buffer partial frames server‑side.
- WhisperX: No fallbacks—UI must surface readiness/token/mirror requirements.

Risk Management
- Model sizes: Keep Mimi on server; use browser only for ASR (smaller models). Use `/api/hf` mirror and IndexedDB cache.
- Performance: Target encode+step+decode ≤ 30 ms; log "over‑budget" counter in `/health` and in status panel.
- DX: Fix/disable broken pre‑commit hooks or document `--no-verify` in dev docs.

Docs & Testing
- Weights & Delays page: Document fetch, shape validation, and application with CLI examples.
- Extend smoke: After weights, assert non‑zero step counts and decode timings in `/health` and one downstream audio frame.

**Archive / Experiments Candidates (lib/unified)**
These are useful references but not in the critical path of the current packetized stack. Keep under `lib/unified/experiments` or `lib/unified/archive` for clarity.

- components/
  - `StreamingVoiceInterface.tsx` (legacy UI superseded by `PacketStreamingVoiceInterface.tsx`)
  - `HFServerTest.tsx` (legacy server test UI)
  - `MoshiWsDemo.tsx` (older WS demo)
  - `SmokeTest.tsx` (test harness; move to `examples/` or `tests/`)
- core/
  - `transformer.ts` (deprecated; superseded by MLX transformer in models)
  - `moshi-ws-client.ts` (older client; if unused, archive)
  - `audio-processor.ts` (worklet for legacy path; if unused, experiments)
- services/
  - `csmStreamingService.ts` (non‑packet CSM; not on current path)
  - `lmStudioService.ts` (legacy LM text/streaming; not on packet path)
  - `audioService.ts` (LiveKit/MediaRecorder; packet path uses `AudioFrameCapturer`)
  - Keep: `packetStreamingService.ts`, `speechService.ts`, `whisperWasmService.ts`, `voiceActivityDetection.ts`
- audio/whisperx/
  - Keep engine and components; audit “mock” fallbacks in model files and gate/remove for prod builds.
- docs/
  - `moshi-ws-protocol.md` mentions mocks; move to `docs/archive/` or update to reflect packet protocol v2.

Notes:
- Do not delete code with partial mock fallbacks embedded (e.g., WhisperX models); prefer gating or removing mock branches in production builds.
- Before moving, verify no imports remain by searching repo; then relocate and fix imports if any.

**Risks & Mitigations**
- Weights/Access: Use HF proxy with server `HF_TOKEN`; accept model licenses.
- Performance budget: Keep encode+step+decode << 80 ms; add backpressure & metrics.
- Drift: Contracts in ARCHITECTURE.md; tests and smoke gating; build scope excludes references.

**Ops & Commands**
- Install: `npm -C next-server install`
- Packet server: `npm -C next-server run packet:server` (health: `http://localhost:8788/health`)
- Next dev: `npm -C next-server run dev` (UI: `/packet-voice`, `/whisperx`)
- Smoke: `npm -C next-server run smoke` (boots both, probes health + HF proxy)
- Tests (API helpers): `/api/test/packet-health`, `/api/test/hf-proxy?path=org/repo/resolve/main/file`

**Acceptance Criteria**
- End‑to‑end 80 ms step loop operates with real weights (no simulation), producing continuous downstream audio.
- Under nominal load, mic→speaker latency ≤ 200 ms; underruns < 1%.
- HF proxy reachable and used for browser model prefetch; WhisperX runs in‑browser.
- Architecture and plan remain coherent with code (filepaths + contracts verified by smoke tests).

**Verification Checklist (code-backed)**
- [x] /health endpoint exists and reports readiness + metrics (file: next-server/lib/unified/server/server.ts)
- [x] /weights endpoint exists and reports LM/Mimi readiness (file: next-server/lib/unified/server/server.ts)
- [x] LmModel.step() implements delays pipeline entry point (file: next-server/lib/unified/models/moshi-mlx/lm.ts)
- [x] isReady()/debugInfo() present on LM; server uses them in /health and /weights
- [ ] Mimi.loadWeights() wired and Mimi.isReady() reflects state (requires real weights)
- [ ] Safetensors/loader path validated via models/moshi-mlx/weights/loader resolvers (set LM_REPO/MIMI_REPO)
- [ ] Smoke script asserts: /health ok, /weights ok, and non-zero step counts after a basic generate/profile run
- [ ] UI status panel surfaces step rate, queue depth, last decode ms

Quick manual checks
- curl http://localhost:8788/health → readiness booleans and metrics with budgetMs:80 present
- curl http://localhost:8788/weights → lm.ready/mimi.ready and debug info objects
- curl http://localhost:8788/profile/lm?steps=8&warmup=1 → returns avgMs and tokens when LM weights are loaded
- npm -C next-server run smoke → in addition to health/proxy/weights via Next, logs LM profile results when LM is ready

## Getting Started Workboard (Day 0–1)

Status update (2025-09-01 03:17 local)
- [x] Verified Next API test endpoints exist: `/api/test/packet-health`, `/api/test/hf-proxy`
- [x] Verified HF proxy route exists: `pages/api/hf/[...path].ts`
- [x] Confirmed npm scripts: `packet:server`, `dev`, `smoke`
- [x] Updated README to align with packetized plan and ARCHITECTURE
- [x] Run smoke locally and record initial `/health` payload
- [ ] Weights work: begin safetensors loader scaffolding and throw-on-missing enforcement checks

Next up (immediate)
- Implement safetensors loader paths: `LmModel.loadWeights()`, `Mimi.loadWeights()`
- [x] Expose basic step latency counters in `lib/unified/server/server.ts` `/health` (present)


## Next 3–5 Days (2025-09-01 03:03 local)

- Weights loading (server-side first)
  - Implement safetensors loading for LM/Mimi via existing loaders; validate shapes against moshi_mlx_2b.json; fail fast on mismatch.
  - Wire Mimi.loadWeights() using HF proxy or local path (MIMI_REPO or MIMI_LOCAL). Ensure Mimi.isReady() reflects state. 
- Acoustic delays in LM
  - Apply delays from moshi_mlx_2b.json in LmModel.step() alignment; keep cache consistent; log effective delay.
- Telemetry additions
  - Expose queue depth and underrun counters alongside existing encode/step/decode timings in /health.
- Smoke gating
  - Run npm -C next-server run smoke and ensure: /health ok, /api/test/hf-proxy ok, /api/test/weights ok. Record snapshot.

### Developer Environment Checklist

- LM weights: set LM_REPO (HF repo id) or LM_GGUF (absolute file path) for text-only mode.
- Mimi weights: set one of MIMI_REPO (HF repo id) or MIMI_LOCAL (absolute file path).
- HF_TOKEN: server-side for /api/hf proxy access to gated repos.
- NEXT_PUBLIC_HF_MIRROR=/api/hf recommended for browser model asset mirroring.
- NEXT_PUBLIC_PACKET_WS=ws://localhost:8788 if non-default.

Quick verify
- curl http://localhost:8788/weights → should return both lm and mimi objects. Example (degraded mode):

```
{
  "lm": { "ready": false, "transformer": { "num_layers": 0, "d_model": 0, "num_heads": 0, "layer_param_counts": [] } },
  "mimi": { "ready": false, "sample_rate": 24000, "frame_rate": 12.5, "frame_size": 1920, "n_q": 8, "vocab_size": 2048, "streaming": false, "batchSize": 1 }
}
```

Example /health payload (initial, degraded):

```
{
  "status": "healthy",
  "clients": 0,
  "uptime": 12.3,
  "readiness": { "lm": false, "mimi": false },
  "metrics": {
    "encode": { "count": 0, "avgMs": 0, "lastMs": 0 },
    "step": { "count": 0, "avgMs": 0, "lastMs": 0, "overBudget": 0, "budgetMs": 80 },
    "decode": { "count": 0, "avgMs": 0, "lastMs": 0 }
  }
}
```
