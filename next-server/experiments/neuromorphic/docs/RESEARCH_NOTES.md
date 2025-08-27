# Research Notes (Running Log)

This is a lab‑style log of parameters, experiments, and observations. Add entries at the top with the most recent first.

## 2025‑08‑25 — Repository Consolidation & Doc Pass
- Moved neuromorphic modules into experiments/neuromorphic/ tree.
- Verified basic tests (neuromorphic-simple.js) run under Node.
- Authored WHITEPAPER, PROGRESS_REPORT, HOW_TO_RUN, and ROADMAP.
- Next: wire up observability demo run script; decide minimal real inference to test attention policy.

## 2025‑08‑24 — Gamma Synchronization Check
- Hypothesis: 12.5 Hz → 3–4 gamma cycles per frame should provide sufficient granularity for attention gating.
- Implemented MimiGammaSynchronizer with fractional carry (phase accumulator) to keep ~3.2 cycles per frame.
- Observation: synthetic bursts are useful for wiring; need real spectral cues to make attention meaningful.

## 2025‑08‑23 — Thought Racing Dynamics
- Config: jitter noise sampled per competitor; priority bonus scales with DSCP.
- Observation: making loss inject Infinity delays simulates dropped thoughts, reduces oscillation.
- Note: Add bandit‑style exploration parameter decay to prevent premature convergence.

## 2025‑08‑22 — Interference & Attention
- Interference calculation using phase/frequency alignment yields plausible gains but needs DSP smoothing.
- Action: cache recent focus patterns; add hysteresis to prevent rapid attention flapping.

## 2025‑08‑21 — Observability Hooks
- NeuralObservatory telemetry buffer + periodic metrics broadcast.
- Visualizer renders bands, packet traces, and coarse brain region activity.
- Need: route graph view + per‑region coherence traces; integrate PLV if feasible.
