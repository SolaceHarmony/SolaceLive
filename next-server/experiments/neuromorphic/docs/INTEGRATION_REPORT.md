# Integration Report (Neuromorphic Experiments)

This report summarizes integration status of neuromorphic modules with the broader Moshi stack.

Note: The canonical repository‑wide INTEGRATION_REPORT.md remains at the project root for historical context. This file captures the neuromorphic‑specific view; see also WHITEPAPER.md and PROGRESS_REPORT.md.

## Status
- All neuromorphic code is located under next-server/experiments/neuromorphic/.
- There are no production imports referencing experiments/*.
- TypeScript configs should exclude experiments from production builds (verify in next-server/tsconfig.json when build profiles are defined).

## Interfaces
- MoshiModelBridge (mock) can invoke Mimi (mock) → neuromorphic kernel; production bridges should not import experiments.
- UI components in experiments/ui are not routed from Next.js production pages.

## Tests/Demos
- See HOW_TO_RUN.md for running neuromorphic-simple and CSM mock tests.
- Visualizer available at research/neural-visualizer.html (browser).

## Follow‑Ups
- If/when a production‑safe Moshi bridge is reintroduced, ensure it has no neuromorphic imports; keep neuromorphic bridge only in experiments.
- Consider CI lint rule/prohibit-imports to block experiments/* in production code.
