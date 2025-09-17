# Models Directory

This folder stores large artifacts used during local testing:

- `gemma3-12b-csm-3.gguf` — Ollama-compatible Gemma 3 CSM checkpoint referenced by `docs/INTEGRATION_PLAN.md` and `archive/unified/tests/csm-gguf-test.js`. Download instructions are printed by the test harness if the file is missing.
- `Modelfile` — helper used to create the Ollama model during CSM integration tests.

If you do not run the neuromorphic/CSM tests you can omit the GGUF file; follow the prompts from `npm run test:gguf` when you need it.
