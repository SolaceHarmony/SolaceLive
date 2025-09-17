# Repository TODO Checklist

## Root / Misc
- [x] .idx/dev.nix — contains Node 20 + IDX preview config; keep for IDX users and document in repo setup notes.

## Frontend Workspace (`frontend/`)
- [x] frontend/README.md — roadmap table + owners placeholder added.
- [x] frontend/whisperx/README.md — regression checklist documented.
- [x] frontend/mimi-packet/README.md — milestones broken into actionable tasks.
- [x] frontend/pages/README.md — activation checklist documented.
- [x] frontend/pages/pages/index.jsx — now surfaces backend status & reintegration checklist.
- [x] frontend/pages/pages/moshi.tsx — now documents new packet server checklist.
- [x] frontend/pages/pages/moshi-mlx.jsx — now documents action items for new packet/MLX API.
- [x] frontend/pages/pages/packet-voice.tsx — placeholder now outlines rebuild checklist.
- [ ] frontend/pages/pages/whisperx.tsx — reinstate once WebGPU fast-whisper passes tests.

## Docs (`/docs`)
- [ ] Review PLAN.md & ARCHITECTURE.md after frontend work is restored.
- [ ] Decide retention/archive status for FUTURE.md, NOVEL_CSM.md, research-journal.md.

## Models
- [ ] models/Modelfile — verify usage (Ollama) and document.
- [ ] models/gemma3-12b-csm-3.gguf — confirm checksum/version & storage strategy.

## `next-server` Config & Tooling
- [x] next-server/package.json — reviewed runtime deps; moved `eslint-plugin-react` to dev.
- [ ] next-server/tsconfig.json & tsconfig.gguf.json — document separate roles.
- [ ] next-server/next.config.js — remove ignoreBuildErrors/ignoreDuringBuilds once frontend reinstated (next.config.cjs removed).
- [x] next-server/.eslintrc.* — removed legacy configs; flat `eslint.config.js` is now sole source.
- [ ] next-server/dist/** — confirm usage; regenerate from scripts if needed.

## Experiments (`next-server/experiments/neuromorphic/**`)
- [ ] Decide whether to maintain in repo, archive elsewhere, or remove unused pieces.
- [ ] Document experimental status in README.

## Public Assets (`next-server/public/`)
- [ ] Remove/relocate unused demo images & HTML.
- [ ] Document decoderWorker assets if still required.

## Examples (`next-server/examples/`)
- [ ] Verify scripts build/run; add instructions or migrate to docs.

## Scripts (`next-server/scripts/`)
- [ ] Ensure each script works after refactor and is documented.

## Core Library (`next-server/lib/core/*`)
- [ ] Review tests & integrate into CI.
- [ ] Confirm decoderWorker pipeline relevance.

## Unified Library (`next-server/lib/unified/*`)
- [ ] Rebuild PacketStreamingVoiceInterface functionality.
- [ ] Align WhisperX files with frontend plan; keep regression coverage.
- [ ] Audit services (speechService, voiceActivityDetection, whisperWasmService) for retention.
- [ ] Review archive/tests directories; decide on migration or removal.
- [ ] Update configs, docs, utils for current architecture.

## Server (`next-server/lib/unified/server/`)
- [ ] Ensure README & implementation stay aligned with MLX backend work.

## API Routes (`next-server/pages/api/**`)
- [ ] Confirm all testing endpoints remain necessary & documented.

## Original CSM Snapshot
- [ ] Decide retention location & document relationship to current adapter.

## Editor/IDE Files
- [ ] Audit .vscode/ and .idea/ configs; keep repo-specific instructions only.
