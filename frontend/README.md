# Frontend Workspace

This workspace collects the browser-facing pieces of SolaceLive: the WebGPU fast-whisper/WhisperX stack, the Mimi codec client, and the packet/WebSocket UI harness. Backend development stays under `next-server/`, but the frontend artifacts live here for easier iteration.

## Layout

- `whisperx/` – documentation and tasks for the in-browser fast-whisper port (WebGPU/WASM, Transformers.js, alignment models).
- `mimi-packet/` – client-side helpers for packet framing, Mimi audio playback, and metrics dashboards.
- `pages/` – the current Next.js pages (`/packet-voice`, `/whisperx`, `/moshi*`) staged outside the build while we focus on backend work.

## Source of Truth

The runnable code still lives under `next-server/`:

- WhisperX engine: `next-server/lib/unified/audio/whisperx/**`
- Packet UI components: `next-server/lib/unified/components/**/*`
- Packet protocol helpers: `next-server/lib/unified/core/**/*`

This folder complements that code with docs, plans, and staging areas for the production UI.

## Roadmap & Owners

| Area | Milestones | Owner |
| --- | --- | --- |
| WhisperX WebGPU | Smoke-test Chromium/WebGPU fast-whisper, re-enable `/whisperx`, document COOP/COEP requirements | _TBD_ |
| Packet Voice UI | Rebuild React component on top of `packetStreamingService`, surface metrics/health panes, publish SDK snippets | _TBD_ |
| Mimi Playback | Finish browser-side Mimi decode/playback demo, add jitter buffer visualisation | _TBD_ |

## Next Steps

1. Run the WhisperX regression suite (Chromium/WebGPU, WASM fallback) and update `frontend/whisperx/README.md` with the process.
2. Design the new packet voice UI in `frontend/pages/pages/packet-voice.tsx` to match backend contracts (audio capture → WS → playback).
3. Capture Mimi codec experiments and telemetry dashboards under `frontend/mimi-packet/` so they’re ready to integrate when the UI returns to production.
