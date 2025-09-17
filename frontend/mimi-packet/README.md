# Mimi + Packet UI

Client-facing pieces for the packetised Moshi/Mimi loop currently live at:

- LM + Mimi bindings: `next-server/lib/unified/models/moshi-mlx/**`
- Packet protocol + queues: `next-server/lib/unified/core/**/*`
- Placeholder voice interface: `next-server/lib/unified/components/PacketStreamingVoiceInterface.tsx`

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
- Keep WebSocket framing aligned with the server headers defined in `lib/unified/core/packets.ts`.
