# Archived Unified Library Assets

- `archive/` — old UI/services that no longer ship with the packet backend.
- `app/` — the earlier standalone Vite app; kept for reference only.
- `services/` — browser services (speech synthesis, VAD, whisper WASM) removed from production.
- `tests/` — legacy test harnesses (csm-gguf, send_pcm_frame, etc.). Retain for reference but do not run as part of main build.

Move pieces back into `next-server/backend/` only after they’re updated to current architecture.
