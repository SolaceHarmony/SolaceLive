# Neuromorphic Experiments – Progress Report

Date: 2025-08-25
Status: Active research; prototypes runnable; production isolated

## Executive Summary
- We relocated all neuromorphic modules from production to next-server/experiments/neuromorphic/.
- The research stack includes: packet types, thought racer, gamma oscillator, attention mechanism, Hebbian learning, and observability.
- A consciousness orchestrator cycles attention/racing/binding/learning.
- A demo voice interface and several tests validate basic data flow.

## What We Attempted
1) Concept Validation
   - Define NeuralPacket and QoS‑as‑synapse mapping.
   - Implement competitive selection (Promise.race abstraction) for thought racing.
   - Prototype gamma/theta rhythm interactions and attention via interference patterns.

2) Integration Hooks
   - MoshiModelBridge invokes Mimi codec (mock) → inference (mock) → neuromorphic processing.
   - MimiGammaSynchronizer converts 12.5 Hz audio frames to ~40 Hz gamma bursts.
   - ConsciousnessOrchestrator accumulates packets, applies attention, races winners, and updates state.

3) Observability & UI
   - NeuralObservatory WebSocket + neural-visualizer.html for live telemetry.
   - NeuromorphicVoiceInterface.tsx to wire a microphone to the bridge and show live metrics.

4) Tests
   - neuromorphic-simple.js: General smoke test of performance and mock packet flow.
   - csm-neuromorphic-* tests: Simulate CSM+neuromorphic interplay with mocked CSM outputs.

## What We Accomplished
- Logical separation of research code from production code (build safety).
- Runnable demo loop: mic → frame → (mock Mimi) → packets → attention → race → (mock bindings).
- Baseline profiling with PerformanceOptimizer and a structured metrics view in the orchestrator.
- A whitepaper‑level articulation of the approach and a research README.

## What’s Not Done Yet
- Real neural DSP for coherence/PLV; current measures are simplified.
- Real Mimi codec + real transformer integration in this path.
- Robust attention policy and winner feedback to a real model.
- Formal evaluation metrics and benchmarks.

## Risks and Constraints
- Conceptual risk: biological metaphors may not translate to measurable gains.
- Engineering risk: timing precision and browser/device variability.
- Safety: avoid anthropomorphic claims; ensure clear separation from production.

## Next Milestones
- Replace mocks with minimal real inference (e.g., ONNX/MLX step) to test attention/racing.
- Expand observability: phase coherence overlays; per‑route statistics; packet timelines.
- Define measurable KPIs (latency, intelligibility, stability) and a repeatable test harness.
