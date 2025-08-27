# Neuromorphic Experiments – Roadmap

## Goals (Next 2–4 Weeks)
1. Replace mocks with a minimal real inference path
   - Option A: ONNX/ORT CPU for a tiny acoustic/text head
   - Option B: MLX TS binding (if viable) for stepwise token/codes
   - Success metric: demonstrate attention/racing alters inference schedule/content in a measurable way

2. Observability Enhancements
   - Per‑region packet timelines; gamma burst overlays; attention focus ribbon
   - Simple PLV/coherence proxy; route strengths over time; QoS boost heatmap

3. Test Harness & KPIs
   - Define streaming latency budget and steady‑state cadence
   - Stability under packet loss/jitter; responsiveness to priority changes

## Medium‑Term (1–2 Months)
- Bandit routing feedback into model prompts/conditioning
- Memory traces: stabilize working memory APIs and decay/retrieval policies
- Safety guardrails: rate limit “conscious” escalations; cap priority boosting

## Risks
- Time sync/precision in JS; may need native addon for DSP‑level analysis
- Complexity creep without measurable wins; keep minimal, testable slices

## Out of Scope (For Now)
- Full‑fidelity neurobiology; keep metaphors lightweight
- Any production coupling; experiments remain isolated
