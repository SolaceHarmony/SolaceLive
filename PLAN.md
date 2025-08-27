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
- M1 Weights & E2E: Load LM/Mimi safetensors; enable encode/step/decode end‑to‑end.
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
- [ ] Add metrics (step latency, queue depth, underruns) to `/health`
- [ ] E2E validation against success metrics (< 200 ms, underruns < 1%)
- [ ] Deployment docs + simple configuration guide
- [ ] Archive/experiments relocation (see below)

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
