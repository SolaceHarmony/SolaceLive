# Integration Plan: Moshi TypeScript in Solace Live

Purpose
- Document the plan and concrete steps to merge the Moshi TypeScript stack into Solace Live for end-to-end, web-native, real-time dialogue.

Goals
- Use the Moshi TypeScript server (WS) for real-time audio/text.
- Keep Solace Live’s Node API (/api/*) for ASR, embeddings, LM text.
- Enable the web app to speak to Moshi via a proxied WebSocket path.
- Provide unified dev scripts and a basic test procedure.

Components
- moshi-typescript/server: Express + WebSocket server, TypeScript-first transformer mock (extensible to real models).
- solace-live/server: Existing HTTP API for ASR/embeddings/generation.
- solace-live/vite dev server: Static assets + proxy to Node APIs and Moshi WS.

Protocol
- MessageType: AUDIO(1), TEXT(2), METADATA(3).
- encodeMessage/decodeMessage: first byte type, rest payload (Uint8Array or UTF-8 text), same as moshi-ts client.

Plan of Record
1) Wire Dev Orchestration
   - Add root scripts to install and run both:
     - Solace Live dev (client + API on :5173 + :8787)
     - Moshi TS server (WS on :8088)
2) Frontend Connectivity
   - Add Vite proxy route /moshi -> ws://localhost:8088 (ws: true) so the browser can connect via ws(s)://host/moshi in dev.
   - The Moshi server accepts WebSocket upgrades on any path.
3) Minimal E2E Check
   - Start moshi-ts server.
   - Run moshi-typescript/server integration.examples.ts to verify echo path and METADATA.
4) Next Integration Steps (App)
   - Add a small client util to open a WebSocket to /moshi and exchange TEXT/AUDIO.
   - Hook up microphone capture: encode audio frames (e.g., Opus/PCM placeholders) -> MessageType.AUDIO.
   - Render incoming TEXT and synthesized AUDIO responses.

Milestones
- M1: Dev orchestration + WS proxy + server smoke test (this change).
- M2: Client-side WS service in Solace Live + minimal UI to send text and see echo.
- M3: Audio I/O: capture microphone and play back server audio.
- M4: Replace mock transformer with real model backend (ONNX/TFJS/WASM), keep protocol stable.

Testing
- Unit: moshi-ts server test and examples (src/transformer.test.ts, src/integration.examples.ts).
- Smoke: Connect via ws://localhost:5173/moshi in dev and exchange TEXT.

Risks & Mitigations
- WS proxy mismatch: Ensure ws: true in Vite proxy; use /moshi path consistently.
- Port conflicts: Keep moshi-ts on 8088; Solace API on 8787; Vite on 5173.
- Latency: Mock transformer is cheap; real model will need perf work (WASM/ONNX GPU backends).

Rollout
- Keep Python/MLX servers available as alternates; TypeScript server is a drop-in for demos and iteration.

Ownership
- Moshi TS server: moshi-typescript/server.
- App integration: solace-live/src (WebSocket service + UI).

Appendix: Quick Start
- Start Moshi TS server: npm -C moshi-typescript/server run dev (ws://localhost:8088)
- Start Solace Live dev: npm -C solace-live run dev (http://localhost:5173)
- Or run both via root script: npm run dev:with-moshi (added by this change)

