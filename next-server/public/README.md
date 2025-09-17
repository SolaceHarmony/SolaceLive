# Public Assets

- `decoderWorker.min.js` / `decoderWorker.min.wasm` — legacy Opus/Mimi decoder worker shipped for browser playback. Keep until the new packet voice UI confirms whether the worker is still required; update references in `backend/core/decoderWorker.ts`.
- `coi-serviceworker.js` — Cross-Origin Isolation helper needed for WhisperX WebGPU.
- Favicons (`favicon*.png`, `favicon.ico`) and `logo.svg` — production icons.
- `vite.svg` — historical asset; safe to remove if not referenced.

Development/demo files such as `audio-test.html` and sample imagery have been moved to `frontend/assets/`.
