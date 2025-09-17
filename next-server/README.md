# Next Server Workspace

## TypeScript Configs

- `tsconfig.json` — primary config used by Next.js (`npm run dev` / `next build`). It targets React/Node code under `pages/` and `lib/` (excluding experiments/archive) with `noEmit` so Next handles transpilation.
- `tsconfig.gguf.json` — extends the base config but enables emit (`outDir: dist`) for the standalone GGUF tooling under `backend/models/{gguf,llama}`. Run via `npm run load:gguf` or other scripts when generating helper bundles.

Keep both files in sync when upgrading compiler options; only `tsconfig.gguf.json` should set `noEmit: false`.

## Generated Artifacts

The `dist/` subtree holds the output of the GGUF/LLaMA tooling (compiled by `tsconfig.gguf.json`). Regenerate it with:

```bash
npm run load:gguf -- models/gemma3-12b-csm-3.gguf --max-layers 1
```

or related scripts in `next-server/scripts/` when needed.
