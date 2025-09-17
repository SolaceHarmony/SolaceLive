# How to Run Neuromorphic Experiments

These are research demos and tests. Do not wire them into production.

## Prerequisites
- Node 18+
- npm
- A modern browser (for the visualizer and WebGPU demo)

## Directory Overview
- experiments/neuromorphic/research/ — Core research modules and a visualizer HTML.
- experiments/neuromorphic/models/ — Consciousness orchestrator and synchronizers.
- experiments/neuromorphic/ui/ — React demo component (not used by production pages).
- experiments/neuromorphic/tests/ — Headless tests and integration scripts.

## Headless Smoke Test
Run the simple JS test (uses Node APIs like perf_hooks):

```
node next-server/experiments/neuromorphic/tests/neuromorphic-simple.js
```

Expected: checkmarks for optimizer, packet flow, and consciousness simulation.

## CSM + Neuromorphic (Mock) Integration Test
This test exercises the orchestration loop with mocked CSM outputs:

- TypeScript variant:
```
# You may run this through ts-node or transpile first
node --loader ts-node/esm next-server/experiments/neuromorphic/tests/csm-neuromorphic-integration.ts
```

- JavaScript live harness:
```
node next-server/experiments/neuromorphic/tests/csm-neuromorphic-live-test.js
```

Note: These tests use mock CSM responses by default. To integrate a real local CSM backend, follow the guidance in PROGRESS_REPORT.md and WHITEPAPER.md; adapt the fetch endpoints accordingly.

## Neural Visualizer (Browser)
Open the research visualizer directly in a browser:
```
open next-server/experiments/neuromorphic/research/neural-visualizer.html
```
It expects a WebSocket server from NeuralObservatory (if started). You can import and start the observatory in a small Node script and then open the page.

## React Demo (Experimental)
The React component lives here:
```
next-server/experiments/neuromorphic/ui/NeuromorphicVoiceInterface.tsx
```
This is not registered in production pages. If you want to try it in a sandboxed route, ensure you import it only inside a dev‑only page and never from unified libs.

## Safety Notes
- Keep this folder excluded from production builds.
- Do not import experiments/* from production code paths.
- Treat outputs as research artifacts; logs and timings are not production‑grade telemetry.
