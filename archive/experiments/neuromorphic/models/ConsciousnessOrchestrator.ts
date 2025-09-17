/**
 * Consciousness Orchestrator - Unified control system for neuromorphic processing
 */

import { NeuralPacket, DSCP } from '../research/neural-packet-types';
import { ThoughtRacer } from '../research/thought-racer';
import { AttentionMechanism } from '../research/attention-mechanism';
import { GammaOscillator } from '../research/gamma-oscillator';
import { HebbianNetwork } from '../research/hebbian-learning';
import { QoSNeuralNetwork } from '../research/qos-neural-network';
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
  private thoughtRacer: ThoughtRacer;
  private attention: AttentionMechanism;
  private gammaOsc: GammaOscillator;
  private hebbian: HebbianNetwork;
  private qosNetwork: QoSNeuralNetwork;
  private state: ConsciousnessState;
  private metrics: ProcessingMetrics;
  private packetBuffer: Map<string, NeuralPacket[]>;
  private readonly CONSCIOUSNESS_CYCLE = 100; // ms, alpha rhythm
  private readonly WORKING_MEMORY_CAPACITY = 7; // Miller's magic number
  private readonly ATTENTION_THRESHOLD = 0.7;
  
  constructor() {
    this.thoughtRacer = new ThoughtRacer();
    this.attention = new AttentionMechanism();
    this.gammaOsc = new GammaOscillator();
    this.hebbian = new HebbianNetwork();
    this.qosNetwork = new QoSNeuralNetwork();
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
    this.startConsciousnessCycle();
  }
  
  private async startConsciousnessCycle(): Promise<void> {
    setInterval(async () => {
      await this.processConsciousnessFrame();
    }, this.CONSCIOUSNESS_CYCLE);
  }
  
  private async processConsciousnessFrame(): Promise<void> {
    performanceOptimizer.startTiming('consciousness-cycle');
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
      
      performanceOptimizer.startTiming('gamma-binding');
      const boundPackets = this.gammaOsc.generateThetaGamma(winner);
      performanceOptimizer.endTiming('gamma-binding');
      this.metrics.gammaBindingEvents++;
      this.updateWorkingMemory(winner.sourceAS.id, boundPackets);

      // TODO: Get actual losers from ThoughtRacer instead of empty array
      this.hebbian.updateWeights(winner, []);
      this.metrics.hebbianUpdates++;

      // TODO: Calculate actual path strength from network topology
      const pathStrength = winner.amplitude;
      this.updateConsciousnessState(winner, pathStrength);
    }
    this.updateQoSPriorities(focusedPackets);
    
    this.metrics.packetsProcessed += allPackets.length;
    const cycleTime = performanceOptimizer.endTiming('consciousness-cycle');
    performanceOptimizer.recordConsciousnessCycle(cycleTime);
    performanceOptimizer.recordPacketProcessing(allPackets, cycleTime);
  }
  
  public injectPackets(streamId: string, packets: NeuralPacket[]): void {
    if (!this.packetBuffer.has(streamId)) {
      this.packetBuffer.set(streamId, []);
    }
    
    const buffer = this.packetBuffer.get(streamId)!;
    buffer.push(...packets);
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 100);
    }
  }
  
  private gatherPackets(): NeuralPacket[] {
    const packets: NeuralPacket[] = [];
    
    for (const [, buffer] of this.packetBuffer) {
      const streamPackets = buffer.splice(0, 10);
      packets.push(...streamPackets);
    }
    
    return packets;
  }
  
  private determineFocus(packets: NeuralPacket[]): string | null {
    if (packets.length === 0) return null;

    // TODO: Use actual attention salience instead of just amplitude
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
    if (winner.qos.dscp === DSCP.CONSCIOUS_THOUGHT || winner.qos.dscp === DSCP.ATTENTION_FOCUS) {
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