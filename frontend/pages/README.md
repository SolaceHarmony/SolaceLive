# Frontend Pages (Staged)

This directory holds the active Next.js page implementations (`/packet-voice`, `/whisperx`, `/moshi`, etc.) while the backend-focused build runs without a UI surface. The code here is current and will move back to `next-server/pages/` once we are ready to ship the full client experience.

## Reactivation Checklist

1. Copy the desired page from `frontend/pages/pages/` into `next-server/pages/`.
2. Update imports to point at the live components/services (e.g., rebuilt `PacketStreamingVoiceInterface`).
3. Run `npm run lint` and `npm run build` to ensure the page compiles with the backend focused build.
4. Perform the relevant manual tests:
   - `/packet-voice`: connect to the packet server, verify Mimi playback and metrics dashboard.
   - `/whisperx`: execute the WhisperX regression checklist from `frontend/whisperx/README.md`.
   - `/moshi*`: verify websocket/API endpoints exposed by the backend.
5. Commit the page move and update docs if behaviour changed.
