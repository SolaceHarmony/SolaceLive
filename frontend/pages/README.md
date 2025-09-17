# Frontend Pages (Staged)

This directory holds the active Next.js page implementations (`/packet-voice`, `/whisperx`, `/moshi`, etc.) while the backend-focused build runs without a UI surface. The code here is current and will move back to `next-server/pages/` once we are ready to ship the full client experience.

To reactivate a page, copy it from `frontend/pages/` into `next-server/pages/` and verify the required services (WhisperX WebGPU, packet streaming UI, Moshi adapters) are available.
