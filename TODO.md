# Repository TODO Checklist

## Root / Misc
- [x] .idx/dev.nix — contains Node 20 + IDX preview config; keep for IDX users and document in repo setup notes.

## Frontend Workspace (`frontend/`)
- [x] frontend/README.md — roadmap table + owners placeholder added.
- [x] frontend/whisperx/README.md — regression checklist documented.
- [x] frontend/mimi-packet/README.md — milestones broken into actionable tasks.
- [x] frontend/pages/README.md — activation checklist documented.
- [x] frontend/pages/index.jsx — now surfaces backend status & reintegration checklist.
- [x] frontend/pages/moshi.tsx — now documents new packet server checklist.
- [x] frontend/pages/moshi-mlx.jsx — now documents action items for new packet/MLX API.
- [x] frontend/pages/packet-voice.tsx — placeholder now outlines rebuild checklist.
- [x] frontend/pages/whisperx.tsx — placeholder now references regression checklist before reinstating.

## Docs (`/docs`)
- [ ] Review PLAN.md & ARCHITECTURE.md after frontend work is restored.
- [x] Archived FUTURE.md, NOVEL_CSM.md, research-journal.md under `archive/docs/`.

## Models
- [x] models/Modelfile — document Ollama usage in models/README.md.
- [x] models/gemma3-12b-csm-3.gguf — noted storage instructions in models/README.md.

## `next-server` Config & Tooling
- [x] next-server/package.json — reviewed runtime deps; moved `eslint-plugin-react` to dev.
- [x] next-server/tsconfig.json & tsconfig.gguf.json — documented roles in next-server/README.md.
- [ ] next-server/next.config.js — remove ignoreBuildErrors/ignoreDuringBuilds once frontend reinstated (next.config.cjs removed).
- [x] next-server/.eslintrc.* — removed legacy configs; flat `eslint.config.js` is now sole source.
- [x] next-server/dist/** — documented regeneration command in next-server/README.md.

## Experiments (`archive/experiments/neuromorphic/**`)
- [x] Moved neuromorphic experiments to `archive/experiments/` outside production tree.

## Public Assets (`next-server/public/`)
- [x] Remove/relocate unused demo images — moved to `frontend/assets/`.
- [x] Relocated `audio-test.html` to frontend assets; removed unused `vite.svg`.
- [x] Documented decoder worker assets in `next-server/public/README.md`.

## Examples (`next-server/examples/`)
- [x] Document scripts in `next-server/examples/README.md`; run on demand with `tsx`.

## Scripts (`next-server/scripts/`)
- [x] Documented existing scripts in `next-server/scripts/README.md` (functional verification pending as backend matures).

## Core Library (`next-server/lib/core/*`)
- [ ] Review tests & integrate into CI.
- [ ] Confirm decoderWorker pipeline relevance.

## Backend Library (`next-server/backend/*`)
- [ ] Rebuild PacketStreamingVoiceInterface functionality.
- [ ] Align WhisperX files with frontend plan; keep regression coverage.
- [x] Audit services (speechService, voiceActivityDetection, whisperWasmService) — moved to `archive/unified/services/`.
- [x] Review archive/tests/app directories — moved to `archive/unified/`.
- [ ] Update configs, docs, utils for current architecture.

## Server (`next-server/backend/server/`)
- [ ] Ensure README & implementation stay aligned with MLX backend work.

## API Routes (`next-server/pages/api/**`)
- [ ] Confirm all testing endpoints remain necessary & documented.

## Original CSM Snapshot
- [x] Archived under `archive/original_csm` with README noting purpose.

## Editor/IDE Files
- [x] Removed legacy IDE configs (.vscode/, .idea/). Document editor setup separately if needed.
