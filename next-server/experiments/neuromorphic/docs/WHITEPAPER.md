# Neuromorphic Moshi: Neural Packets, QoS as Synapses, and Gamma Binding

Date: 2025-08-25
Status: Research Prototype (non‑production)

## 1. Motivation

Moshi is a real‑time dialogue system. This research line explores whether bio‑inspired network dynamics can improve streaming cognition:
- Represent information as “neural packets” with amplitude, frequency, phase.
- Use network QoS (latency, bandwidth, jitter, DSCP) as synapse‑like parameters.
- Select winning interpretations by competitive racing (fastest thought wins).
- Leverage gamma (≈40 Hz) bursts for cross‑modal binding and “conscious” updates.

## 2. Core Concepts

1) Neural Packet
- Extends a transport packet with brain‑like fields: amplitude, frequency, phase, harmonics, QoS, and payload.
- Encodes where it came from/where it’s headed (Cognitive Autonomous Systems).

2) QoS → Synapses
- Latency ~ conduction speed; bandwidth ~ synaptic strength; jitter/loss ~ noise/failure.
- DSCP priority levels mapped to cognitive priority (e.g., CONSCIOUS_THOUGHT/ATTENTION_FOCUS/WORKING_MEMORY/etc.).

3) Thought Racing
- Multiple candidate packets/interpretations compete via propagation delay plus noise; winner gets reinforced.
- Hebbian rules (STDP) strengthen paths that frequently win; losers decay or are pruned.

4) Gamma/Theta Dynamics
- Gamma (~40 Hz) for binding/focus; theta (~4–8 Hz) modulates episodic encoding.
- Mimi audio frames (≈12.5 Hz) are synchronized to gamma by inserting 3–4 bursts per frame.

## 3. Architecture Overview

- research/
  - neural-packet-types.ts: All core types (DSCP, NeuralQoS, NeuralPacket, oscillation helpers).
  - thought-racer.ts: Competitive routing (race), QoS boosting/downgrading.
  - gamma-oscillator.ts: Burst generation and binding checks; theta–gamma coupling.
  - attention-mechanism.ts: Interference‑based focusing; phase/frequency alignment gains.
  - hebbian-learning.ts: Competitive Hebbian, STDP, multi‑armed bandit, micro‑expert gates.
  - neural-observatory.ts & neural-visualizer.html: Telemetry + browser visualizer.
  - moshi-csm-neural.ts: Full mocked neural orchestration with WebGPU compute prototype (browser).

- models/
  - ConsciousnessOrchestrator.ts: Cyclic consciousness loop (attention, racing, gamma bursts, Hebbian updates).
  - MimiGammaSynchronizer.ts: Bridge Mimi frames (12.5 Hz) to gamma bursts (≈40 Hz).
  - MoshiKernel.ts: Entry for neuromorphic processing tied to Moshi bridge.
  - PerformanceOptimizer.ts: Latency and throughput profiling + recommendations.

- ui/
  - NeuromorphicVoiceInterface.tsx: Demo UI for mic → frames → bridge → neuromorphic layer.

- tests/
  - neuromorphic-simple.js: Headless smoke tests (timers, packet flow, mock consciousness).
  - csm-neuromorphic-integration.ts/js: End‑to‑end CSM mock + neuromorphic layer tests.

## 4. Processing Loop

1) Ingest: Audio frames (Float32, 24 kHz, 80 ms → 1920 samples) or Moshi tokens.
2) Synchronize: Convert each frame to ~3–4 gamma bursts; embed spectral + energy metadata.
3) Focus: Compute interference pattern; apply attention gain for phase/frequency alignment.
4) Compete: ThoughtRacer computes QoS‑weighted delays; Promise.race selects winner.
5) Bind: Gamma burst train; detect phase‑locking for “conscious” updates.
6) Learn: Hebbian STDP potentiates frequent winners; depresses/normalizes weak paths.

## 5. Scientific Basis (informal pointers)
- STDP (Hebb/Markram); gamma binding (Singer/Fries); theta–gamma coupling (Lisman/Canolty);
- Winner‑take‑all networks (Amari/Arbib); ion channel gating (Hodgkin–Huxley); phase‑locking measures.

## 6. Implementation Status
- All neuromorphic code moved to experiments tree; production has no dependency.
- Mocked pipelines are runnable; observability + UI demos present.
- WebGPU compute kernel prototype included in browser‑only path.

## 7. Limitations & Risks
- Research prototypes only; many modules use mock data.
- Timing in JS is coarse; real coherence measures require DSP.
- WebGPU path is experimental and browser‑specific.
- Consciousness semantics are metaphorical; do not claim sentience.

## 8. Opportunities
- Replace mocks with MLX/ONNX inference to test attention/racing on real features.
- Upgrade observability (coherence spectra, PLV matrices, route heatmaps).
- Explore hybrid control: neuromorphic layer as policy over conventional model states.

## 9. Ethics & Safety
- Avoid anthropomorphic claims; document limitations.
- Maintain strict separation from production to prevent accidental coupling.

## 10. References
(See research/README.md for a narrative bibliography and related links.)
