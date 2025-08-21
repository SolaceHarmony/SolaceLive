/**
 * Experimental: Neuromorphic Packet Routing
 * 
 * Bio-inspired packet networking where packets behave like neural signals,
 * using QoS as synaptic weights and BGP-style routing as Hebbian learning.
 * 
 * WARNING: This is highly experimental research code exploring the intersection
 * of neuroscience, networking, and AI. Not for production use!
 */

// ============================================================================
// NEURAL PACKET TYPES
// ============================================================================

/**
 * Differentiated Services Code Points mapped to cognitive priority levels
 */
export enum DSCP {
  // Neural priority classes (descending priority)
  CONSCIOUS_THOUGHT = 46,      // EF - Expedited Forwarding (highest)
  ATTENTION_FOCUS = 34,        // AF41 - Assured Forwarding Class 4
  WORKING_MEMORY = 26,         // AF31 - Assured Forwarding Class 3
  BACKGROUND_PROCESS = 18,     // AF21 - Assured Forwarding Class 2
  SUBCONSCIOUS = 10,          // AF11 - Assured Forwarding Class 1
  DEFAULT = 0                 // BE - Best Effort
}

/**
 * Quality of Service parameters with neural dynamics
 */
export interface NeuralQoS {
  // Standard QoS parameters
  dscp: DSCP;                // Differentiated Services Code Point
  latency: number;           // ms - propagation speed (inverse of neural conduction velocity)
  bandwidth: number;         // bps - channel capacity (synaptic strength)
  jitter: number;           // ms - timing variance (neural noise)
  loss: number;             // % - packet drop rate (synaptic failure rate)
  
  // Neural-specific QoS parameters
  spikeRate: number;        // Hz - firing frequency
  burstiness: number;       // 0-1 - temporal clustering (burst firing)
  coherence: number;        // 0-1 - phase alignment with other packets
  plasticityRate: number;   // 0-1 - how quickly this route adapts
}

/**
 * Neural packet extends base packet with brain-inspired properties
 */
export interface NeuralPacket {
  // Packet identification
  id: string;
  streamId: number;
  sequenceNumber: number;
  timestamp: bigint;
  
  // Neural properties
  amplitude: number;         // 0-1, signal strength (maps to priority)
  frequency: number;         // Hz, oscillation frequency
  phase: number;            // 0-2π, for interference patterns
  harmonics: number[];      // Frequency multiples for binding
  
  // QoS parameters
  qos: NeuralQoS;
  
  // Payload
  payload: any;
  
  // Routing metadata
  path?: SynapticPath;
  hops?: number;
  ttl?: number;
}

/**
 * Represents a synaptic connection between neural nodes
 */
export interface SynapticPath {
  source: string;           // Source neuron/node ID
  destination: string;      // Destination neuron/node ID
  intermediates: string[];  // Intermediate nodes (axon path)
  weight: number;          // Synaptic weight (0-1)
  delay: number;           // Axonal delay in ms
  reliability: number;     // Probability of successful transmission
}

/**
 * Cognitive Autonomous System numbers (like BGP AS)
 */
export enum CognitiveAS {
  // Sensory input systems
  VISUAL_CORTEX = 65001,      // Visual processing
  AUDITORY_CORTEX = 65002,    // Auditory processing
  SOMATOSENSORY = 65003,      // Touch/proprioception
  
  // Language systems
  WERNICKE = 65010,           // Language comprehension
  BROCA = 65011,              // Language production
  
  // Memory systems
  HIPPOCAMPUS = 65020,        // Memory formation
  ENTORHINAL = 65021,         // Memory encoding
  
  // Executive systems
  PREFRONTAL = 65030,         // Executive function
  ACC = 65031,                // Anterior cingulate (attention/conflict)
  
  // Motor systems
  MOTOR_CORTEX = 65040,       // Motor planning
  CEREBELLUM = 65041,         // Motor coordination
  
  // Emotional systems
  AMYGDALA = 65050,           // Fear/emotion processing
  INSULA = 65051,             // Interoception/empathy
  
  // Integration hubs
  THALAMUS = 65100,           // Relay/gating
  CORPUS_CALLOSUM = 65101,    // Inter-hemispheric
}

/**
 * Interference pattern from multiple neural packets
 */
export interface InterferencePattern {
  intensity: number;         // Summed amplitude (constructive/destructive)
  binding: number;          // Gamma-band coherence (40Hz)
  frequency: number;        // Dominant frequency
  phase: number;           // Resultant phase
  locations: string[];     // Where interference is strongest
}

/**
 * Memory trace stored via harmonic resonance
 */
export interface MemoryTrace {
  content: any;            // Stored information
  strength: number;        // 0-1, memory strength
  frequency: number;       // Resonant frequency for retrieval
  phase: number;          // Phase encoding
  timestamp: bigint;      // When stored
  accessCount: number;    // How often accessed (LRU)
  decay: number;         // Forgetting rate
}

/**
 * Result of a thought race
 */
export interface RaceResult {
  thought: NeuralPacket;
  raceTime: number;       // ms to complete
  path: SynapticPath;
  hops: number;
  winner: boolean;
}

/**
 * Synaptic weight with history
 */
export class SynapticWeight {
  strength: number = 1.0;
  winStreak: number = 0;
  lossStreak: number = 0;
  qosClass: DSCP = DSCP.DEFAULT;
  bandwidth: number = 1000;  // bps
  priority: number = 0;
  lastUsed: bigint = BigInt(0);
  totalUses: number = 0;
  averageLatency: number = 0;
}

/**
 * Multi-armed bandit arm statistics
 */
export class ArmStats {
  pulls: number = 0;
  meanReward: number = 0;
  variance: number = 0;
  qosMultiplier: number = 1.0;
  lastPull: bigint = BigInt(0);
}

/**
 * A racing context for competitive thoughts
 */
export class Race {
  id: string;
  startTime: number;
  participants: Map<string, RaceResult> = new Map();
  winner?: RaceResult;
  
  constructor(id: string) {
    this.id = id;
    this.startTime = performance.now();
  }
}

/**
 * Types of ion channels for gating
 */
export enum IonChannel {
  SODIUM = 'Na+',           // Fast depolarization
  POTASSIUM = 'K+',         // Repolarization
  CALCIUM = 'Ca2+',         // Slow signals, plasticity
  CHLORIDE = 'Cl-',         // Inhibition
  NMDA = 'NMDA',           // Coincidence detection
  AMPA = 'AMPA',           // Fast excitation
  GABA = 'GABA',           // Fast inhibition
}

/**
 * Configuration for micro-expert gates
 */
export interface GateConfig {
  threshold: number;         // Activation threshold (mV equivalent)
  resonantFreq: number;     // Preferred frequency (Hz)
  ionChannel: IonChannel;   // Type of channel
  refractory: number;       // Refractory period (ms)
  adaptation: number;       // Spike-frequency adaptation rate
}

/**
 * Neural oscillation bands
 */
export enum OscillationBand {
  DELTA = 'delta',          // 0.5-4 Hz (deep sleep)
  THETA = 'theta',          // 4-8 Hz (memory, navigation)
  ALPHA = 'alpha',          // 8-12 Hz (relaxation, inhibition)
  BETA = 'beta',            // 12-30 Hz (active thinking)
  GAMMA = 'gamma',          // 30-100 Hz (binding, consciousness)
  HIGH_GAMMA = 'high_gamma' // 100-200 Hz (micro-consciousness)
}

/**
 * Get the frequency range for an oscillation band
 */
export function getOscillationRange(band: OscillationBand): [number, number] {
  switch (band) {
    case OscillationBand.DELTA: return [0.5, 4];
    case OscillationBand.THETA: return [4, 8];
    case OscillationBand.ALPHA: return [8, 12];
    case OscillationBand.BETA: return [12, 30];
    case OscillationBand.GAMMA: return [30, 100];
    case OscillationBand.HIGH_GAMMA: return [100, 200];
  }
}

/**
 * Calculate interference between two waves
 */
export function calculateInterference(
  wave1: { amplitude: number; frequency: number; phase: number },
  wave2: { amplitude: number; frequency: number; phase: number }
): number {
  // Simplified interference calculation
  const phaseDiff = wave2.phase - wave1.phase;
  const freqRatio = wave2.frequency / wave1.frequency;
  
  // Constructive if in phase and similar frequency
  if (Math.abs(phaseDiff) < Math.PI / 4 && Math.abs(freqRatio - 1) < 0.1) {
    return wave1.amplitude + wave2.amplitude;
  }
  
  // Destructive if out of phase
  if (Math.abs(phaseDiff - Math.PI) < Math.PI / 4) {
    return Math.abs(wave1.amplitude - wave2.amplitude);
  }
  
  // Partial interference
  return Math.sqrt(
    wave1.amplitude ** 2 + 
    wave2.amplitude ** 2 + 
    2 * wave1.amplitude * wave2.amplitude * Math.cos(phaseDiff)
  );
}

/**
 * Check if frequency is within an oscillation band
 */
export function isInBand(frequency: number, band: OscillationBand): boolean {
  const [min, max] = getOscillationRange(band);
  return frequency >= min && frequency <= max;
}

/**
 * Generate harmonics for a fundamental frequency
 */
export function generateHarmonics(fundamental: number, count: number = 5): number[] {
  const harmonics: number[] = [];
  for (let i = 1; i <= count; i++) {
    harmonics.push(fundamental * (i + 1)); // 2f, 3f, 4f, etc.
  }
  return harmonics;
}

/**
 * Calculate phase coherence between multiple packets
 */
export function calculateCoherence(packets: NeuralPacket[]): number {
  if (packets.length < 2) return 1.0;
  
  let sumCos = 0;
  let sumSin = 0;
  
  for (const packet of packets) {
    sumCos += Math.cos(packet.phase);
    sumSin += Math.sin(packet.phase);
  }
  
  const meanCos = sumCos / packets.length;
  const meanSin = sumSin / packets.length;
  
  // Phase locking value (PLV)
  return Math.sqrt(meanCos ** 2 + meanSin ** 2);
}