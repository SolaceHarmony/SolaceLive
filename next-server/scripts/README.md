# Scripts

Utility scripts for working with weights, GGUF models, and smoke tests.

| Command | Description |
| --- | --- |
| `npm run smoke` | Calls `scripts/smoke-test.mjs` to hit `/api/test/*` endpoints. |
| `npm run load:gguf -- <path>` | Uses `scripts/load-gguf-lite.mjs` to load a GGUF file into the MLX tooling. |
| `npm run inspect:gguf` | Runs `scripts/inspect-gguf.mjs` for metadata inspection. |
| `npm run test:gguf` | Executes `scripts/test-gguf.mjs` against supplied models. |
| `npm run code:report` | Generates code usage report via `scripts/code-usage-report.mjs`. |
| `npm run llama:dry` | Dry run LLaMA model interaction (`scripts/llama-dry-run.mjs`). |

Python helper:

| Script | Description |
| --- | --- |
| `scripts/inspect-weights.py` | Dumps weight tensor shapes from safetensors.

All CLI scripts assume you have run `npm install`. Add new ones to this table when introduced.
