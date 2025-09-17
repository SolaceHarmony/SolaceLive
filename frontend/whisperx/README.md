# WhisperX Frontend

The WebGPU/WASM fast-whisper port lives at `next-server/lib/unified/audio/whisperx`. It provides:

- Streaming transcription (`WhisperXEngine.ts`) backed by Transformers.js or WASM models.
- Speaker diarisation, alignment, and waveform visualisation components under `components/`.
- HF proxy integration for model prefetch (`utils/hfAuth.ts`).

## Immediate Tasks

- Restore a minimal `/whisperx` page that mounts `WhisperXDemoWithProvider` once the pipeline passes regression tests.
- Verify the fast-whisper build on Chromium/WebGPU (desktop) and fall back to WASM when unavailable.
- Document required browser flags and service-worker setup (`public/coi-serviceworker.js`).

## Regression Checklist

1. **Chrome Canary (WebGPU on)**
   - Enable `chrome://flags/#enable-unsafe-webgpu` (on Mac) or ensure WebGPU is GA on Windows/Linux.
   - Serve the app (`npm run dev` in `next-server/`) and load `/whisperx` after reinstating the page.
   - Confirm transcription updates while audio stays local (monitor Network tab for absence of audio uploads).
2. **Chrome Stable (WebGPU off)**
   - Disable WebGPU flag / use stable build.
   - Ensure WASM backend loads (`WhisperXEngine` should log fallback) and transcription still works.
3. **Service Worker / COOP-COEP**
   - Check that `public/coi-serviceworker.js` registers successfully; deal with cross-origin isolation errors.
4. **Model Prefetch**
   - Pre-populate IndexedDB via `prefetchWhisper` / `prefetchAlignment` and document offline behavior.

Record results in this folder before promoting the page back into `next-server/pages/`.

## Related Code

- `next-server/lib/unified/components/WhisperXDemo.tsx`
- `next-server/lib/unified/audio/whisperx/hooks/useWhisperX.ts`
- `docs/ARCHITECTURE.md` (Browser WhisperX section)
