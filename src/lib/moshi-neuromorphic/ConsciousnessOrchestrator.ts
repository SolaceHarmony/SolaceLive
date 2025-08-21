/**
 * Consciousness Orchestrator - Unified control system for neuromorphic processing
 * 
 * This orchestrates all neuromorphic components to create a coherent
 * consciousness-like processing layer over the Moshi kernel.
 */

import { NeuralPacket, DSCP } from '../../experiments/neuromorphic-research/neural-packet-types';
import { ThoughtRacer } from '../../experiments/neuromorphic-research/thought-racer';
import { AttentionMechanism } from '../../experiments/neuromorphic-research/attention-mechanism';
import { GammaOscillator } from '../../experiments/neuromorphic-research/gamma-oscillator';
import { HebbianNetwork } from '../../experiments/neuromorphic-research/hebbian-learning';
import { QoSNeuralNetwork } from '../../experiments/neuromorphic-research/qos-neural-network';
import { performanceOptimizer } from './PerformanceOptimizer';

export interface ConsciousnessState {
  arousal: number;           // 0-1, general activation level
  focus: string | null;      // Current attention target
  workingMemory: Map<string, NeuralPacket[]>;
  emotionalTone: number;     // -1 to 1, valence
  confidence: number;        // 0-1, certainty in current processing
}

export interface ProcessingMetrics {
  packetsProcessed: number;
  thoughtsRaced: number;
  attentionShifts: number;
  gammaBindingEvents: number;
  hebbianUpdates: number;
  averageLatency: number;
}

export class ConsciousnessOrchestrator {
  // Core neuromorphic components
  private thoughtRacer: ThoughtRacer;
  private attention: AttentionMechanism;
  private gammaOsc: GammaOscillator;
  private hebbian: HebbianNetwork;
  private qosNetwork: QoSNeuralNetwork;
  
  // State management
  private state: ConsciousnessState;
  private metrics: ProcessingMetrics;
  private packetBuffer: Map<string, NeuralPacket[]>;
  
  // Timing constants
  private readonly CONSCIOUSNESS_CYCLE = 100; // ms, alpha rhythm
  private readonly WORKING_MEMORY_CAPACITY = 7; // Miller's magic number
  private readonly ATTENTION_THRESHOLD = 0.7;
  
  constructor() {
    // Initialize components
    this.thoughtRacer = new ThoughtRacer();
    this.attention = new AttentionMechanism();
    this.gammaOsc = new GammaOscillator();
    this.hebbian = new HebbianNetwork();
    this.qosNetwork = new QoSNeuralNetwork();
    
    // Initialize state
    this.state = {
      arousal: 0.5,
      focus: null,
      workingMemory: new Map(),
      emotionalTone: 0,
      confidence: 0.5
    };
    
    this.metrics = {
      packetsProcessed: 0,
      thoughtsRaced: 0,
      attentionShifts: 0,
      gammaBindingEvents: 0,
      hebbianUpdates: 0,
      averageLatency: 0
    };
    
    this.packetBuffer = new Map();
    
    // Start consciousness cycle
    this.startConsciousnessCycle();
  }
  
  /**
   * Main consciousness processing cycle - runs at ~10Hz (alpha rhythm)
   */
  private async startConsciousnessCycle(): Promise<void> {
    setInterval(async () => {
      await this.processConsciousnessFrame();
    }, this.CONSCIOUSNESS_CYCLE);
  }
  
  /**
   * Process one frame of consciousness
   */
  private async processConsciousnessFrame(): Promise<void> {
    performanceOptimizer.startTiming('consciousness-cycle');
    
    // 1. Gather packets from all streams
    const allPackets = this.gatherPackets();
    if (allPackets.length === 0) {
      performanceOptimizer.endTiming('consciousness-cycle');
      return;
    }
    
    // 2. Apply attention mechanism to select focus
    const interference = this.attention.calculateInterference(allPackets);
    const focusedPackets = this.attention.focus(allPackets);
    
    // 3. Update attention state if focus changed
    const newFocus = this.determineFocus(focusedPackets);
    if (newFocus !== this.state.focus) {
      this.state.focus = newFocus;
      this.metrics.attentionShifts++;
    }
    
    // 4. Race thoughts for competitive selection
    if (focusedPackets.length > 1) {
      performanceOptimizer.startTiming('thought-race');
      const winner = await this.thoughtRacer.race(focusedPackets);
      performanceOptimizer.endTiming('thought-race');
      this.metrics.thoughtsRaced++;
      
      // 5. Generate gamma burst for binding
      performanceOptimizer.startTiming('gamma-binding');
      const boundPackets = this.gammaOsc.generateThetaGamma(winner);
      performanceOptimizer.endTiming('gamma-binding');
      this.metrics.gammaBindingEvents++;
      
      // 6. Update working memory
      this.updateWorkingMemory(winner.sourceAS.id, boundPackets);
      
      // 7. Apply Hebbian learning to strengthen successful paths
      this.hebbian.updateWeights(winner, []); // Use updateWeights with winner and empty losers array
      this.metrics.hebbianUpdates++;
      // Note: A more complete implementation would get losers from ThoughtRacer
      
      // 8. Update consciousness state based on processing
      const pathStrength = winner.amplitude; // Use packet amplitude as proxy for path strength
      this.updateConsciousnessState(winner, pathStrength);
    }
    
    // 9. Update QoS for future packets
    this.updateQoSPriorities(focusedPackets);
    
    this.metrics.packetsProcessed += allPackets.length;
    
    // Record performance metrics
    const cycleTime = performanceOptimizer.endTiming('consciousness-cycle');
    performanceOptimizer.recordConsciousnessCycle(cycleTime);
    performanceOptimizer.recordPacketProcessing(allPackets, cycleTime);
  }
  
  /**
   * Inject packets from Moshi kernel or other sources
   */
  public injectPackets(streamId: string, packets: NeuralPacket[]): void {
    if (!this.packetBuffer.has(streamId)) {
      this.packetBuffer.set(streamId, []);
    }
    
    const buffer = this.packetBuffer.get(streamId)!;
    buffer.push(...packets);
    
    // Maintain buffer size
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 100);
    }
  }
  
  /**
   * Gather all available packets for processing
   */
  private gatherPackets(): NeuralPacket[] {
    const packets: NeuralPacket[] = [];
    
    for (const [, buffer] of this.packetBuffer) {
      // Take up to 10 packets per stream
      const streamPackets = buffer.splice(0, 10);
      packets.push(...streamPackets);
    }
    
    return packets;
  }
  
  /**
   * Determine the current focus target
   */
  private determineFocus(packets: NeuralPacket[]): string | null {
    if (packets.length === 0) return null;
    
    // Find the stream with highest amplitude (strongest signal)
    const streamStrengths = new Map<string, number>();
    
    for (const packet of packets) {
      const streamId = packet.sourceAS.id;
      const current = streamStrengths.get(streamId) || 0;
      streamStrengths.set(streamId, current + packet.amplitude);
    }
    
    let maxStrength = 0;
    let focusStream = null;
    
    for (const [stream, strength] of streamStrengths) {
      if (strength > maxStrength) {
        maxStrength = strength;
        focusStream = stream;
      }
    }
    
    return focusStream;
  }
  
  /**
   * Update working memory with new packets
   */
  private updateWorkingMemory(streamId: string, packets: NeuralPacket[]): void {
    if (!this.state.workingMemory.has(streamId)) {
      this.state.workingMemory.set(streamId, []);
    }
    
    const memory = this.state.workingMemory.get(streamId)!;
    memory.push(...packets);
    
    // Maintain capacity limit (7±2 items)
    if (memory.length > this.WORKING_MEMORY_CAPACITY * 10) {
      memory.splice(0, memory.length - this.WORKING_MEMORY_CAPACITY * 10);
    }
    
    // Prune old streams if too many
    if (this.state.workingMemory.size > this.WORKING_MEMORY_CAPACITY) {
      const oldest = [...this.state.workingMemory.keys()][0];
      this.state.workingMemory.delete(oldest);
    }
  }
  
  /**
   * Update consciousness state based on processing results
   */
  private updateConsciousnessState(winner: NeuralPacket, pathStrength: number): void {
    // Arousal increases with high-priority packets
    if (winner.qos.dscp === DSCP.EF || winner.qos.dscp === DSCP.AF41) {
      this.state.arousal = Math.min(1, this.state.arousal + 0.1);
    } else {
      this.state.arousal = Math.max(0, this.state.arousal - 0.05);
    }
    
    // Confidence increases with strong paths and coherent packets
    this.state.confidence = 0.7 * this.state.confidence + 0.3 * pathStrength;
    
    // Emotional tone from packet metadata (if available)
    if (winner.metadata?.emotion) {
      this.state.emotionalTone = 0.8 * this.state.emotionalTone + 
                                 0.2 * (winner.metadata.emotion as number);
    }
  }
  
  /**
   * Update QoS priorities based on consciousness state
   */
  private updateQoSPriorities(packets: NeuralPacket[]): void {
    for (const packet of packets) {
      // Boost priority for focused stream
      if (packet.sourceAS.id === this.state.focus) {
        packet.qos.dscp = DSCP.AF41; // Higher priority
      }
      
      // Adjust based on arousal
      packet.qos.latency *= (2 - this.state.arousal); // Lower latency when aroused
      
      // Adjust bandwidth based on confidence
      packet.qos.bandwidth *= this.state.confidence;
    }
  }
  
  /**
   * Get current consciousness state
   */
  public getState(): ConsciousnessState {
    return { ...this.state };
  }
  
  /**
   * Get processing metrics
   */
  public getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get performance profile for optimization
   */
  public getPerformanceProfile() {
    return performanceOptimizer.generateProfile(this.metrics);
  }
  
  /**
   * Apply automatic performance optimizations
   */
  public autoOptimize() {
    const profile = this.getPerformanceProfile();
    return performanceOptimizer.autoOptimize(profile);
  }
  
  /**
   * Reset consciousness to baseline
   */
  public reset(): void {
    this.state = {
      arousal: 0.5,
      focus: null,
      workingMemory: new Map(),
      emotionalTone: 0,
      confidence: 0.5
    };
    
    this.packetBuffer.clear();
    this.metrics.packetsProcessed = 0;
    this.metrics.thoughtsRaced = 0;
    this.metrics.attentionShifts = 0;
    this.metrics.gammaBindingEvents = 0;
    this.metrics.hebbianUpdates = 0;
    
    // Reset performance tracking
    performanceOptimizer.reset();
  }
}