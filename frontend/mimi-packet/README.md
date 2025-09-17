# Mimi + Packet UI

Client-facing pieces for the packetised Moshi/Mimi loop currently live at:

- LM + Mimi bindings: `next-server/backend/models/moshi-mlx/**`
- Packet protocol + queues: `next-server/backend/core/**/*`
- Placeholder voice interface: `frontend/pages/packet-voice.tsx` (staged) using components in `frontend/components/`

## Milestones

1. **Packet Voice UI v2**
   - [ ] Implement microphone capture + 80 ms chunking (24 kHz) using Web Audio.
   - [ ] Stream audio via `PacketWebSocket` and handle Mimi-coded responses.
   - [ ] Render decoded audio through `AudioChunkPlayer` (jitter-buffer aware).
2. **Observability Panel**
   - [ ] Expose `/health`, `/weights`, `/profile` data in a React dashboard.
   - [ ] Visualise queue depth, underruns, encode/step/decode timings.
3. **Client SDK**
   - [ ] Extract packet framing/heartbeat logic into a consumable TS module.
   - [ ] Provide examples for Electron and plain browser clients.

## Notes

- Use the docs in `docs/ARCHITECTURE.md` and `docs/PLAN.md` for cadence, priority queues, and Mimi delays.
- Keep WebSocket framing aligned with the server headers defined in `backend/core/packets.ts`.
