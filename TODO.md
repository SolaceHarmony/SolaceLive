# Repository TODO Checklist

## Root / Misc
- [ ] .idx/dev.nix — confirm still needed for local env; document or archive.

## Frontend Workspace (`frontend/`)
- [ ] frontend/README.md — expand roadmap & link to active owners.
- [ ] frontend/whisperx/README.md — add regression/test instructions.
- [ ] frontend/mimi-packet/README.md — turn TODO bullets into actionable tasks.
- [ ] frontend/pages/README.md — keep activation instructions current.
- [ ] frontend/pages/pages/index.jsx — adapt to backend changes before restoring to Next.js.
- [ ] frontend/pages/pages/moshi.tsx — same as above.
- [ ] frontend/pages/pages/moshi-mlx.jsx — same as above.
- [ ] frontend/pages/pages/packet-voice.tsx — rebuild around refreshed packet UI.
- [ ] frontend/pages/pages/whisperx.tsx — reinstate once WebGPU fast-whisper passes tests.

## Docs (`/docs`)
- [ ] Review PLAN.md & ARCHITECTURE.md after frontend work is restored.
- [ ] Decide retention/archive status for FUTURE.md, NOVEL_CSM.md, research-journal.md.

## Models
- [ ] models/Modelfile — verify usage (Ollama) and document.
- [ ] models/gemma3-12b-csm-3.gguf — confirm checksum/version & storage strategy.

## `next-server` Config & Tooling
- [ ] next-server/package.json — audit dependencies post-frontend split.
- [ ] next-server/tsconfig.json & tsconfig.gguf.json — document separate roles.
- [ ] next-server/next.config.js / next.config.cjs — consolidate; revisit ignoreBuildErrors.
- [ ] next-server/.eslintrc.* — collapse into single config.
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

