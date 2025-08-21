/**
 * QoS-Weighted Neural Network
 * 
 * Implements "fastest thought wins" architecture where network QoS parameters
 * act as synaptic weights, creating a competitive neural dynamics system.
 */

import {
  NeuralPacket,
  NeuralQoS,
  DSCP,
  SynapticPath,
  RaceResult,
  Race,
  CognitiveAS,
  OscillationBand,
  InterferencePattern,
  calculateCoherence,
  isInBand
} from './neural-packet-types';

// ============================================================================
// THOUGHT RACER - Competitive Neural Selection
// ============================================================================

/**
 * Represents a participant in a thought race before completion.
 */
interface Racer {
  thought: NeuralPacket;
  startTime: number;
  path: SynapticPath;
  qos: NeuralQoS;
  }

/**
 * Statistics for the ThoughtRacer
 */
export interface ThoughtRacerStatistics {
  totalRaces: number;
  pathBoosts: { [key: string]: number };
  averageWinTimes: { [key: string]: number };
}

export class ThoughtRacer {
  private races: Map<string, Race> = new Map(); // Explicit type
  private qosBoosts: Map<string, number> = new Map(); // Explicit type
  private winHistory: Map<string, number[]> = new Map(); // Explicit type
  
  /**
   * Race multiple thoughts - fastest one wins and gets QoS boost
   */
  async race(thoughts: NeuralPacket[]): Promise<RaceResult> {
  async race(thoughts: NeuralPacket[]): Promise<NeuralPacket> {
    const race = new Race(raceId);
    this.races.set(raceId, race);
    
    // Launch all thoughts simultaneously
    const racers: {
      thought: NeuralPacket;
      startTime: number;
      path: SynapticPath;
      qos: NeuralQoS;
    }[] = thoughts.map(thought => ({
 thought: thought,
      startTime: performance.now(),
      path: this.selectPath(thought), // Assuming selectPath is synchronous or returns SynapticPath
      // Note: calculateEffectiveQoS should return NeuralQoS as per its signature
      qos: this.calculateEffectiveQoS(thought)
    }));
    
    // Race with QoS-weighted propagation delays
    const winner = await Promise.race(
      racers.map(async (racer) => {
        // Simulate propagation with QoS-based delay
        const delay = this.calculatePropagationDelay(racer);
        await this.simulateDelay(delay);

        const result: RaceResult = {
          thought: racer.thought,
          raceTime: performance.now() - racer.startTime,
          path: racer.path,
          hops: racer.path.intermediates.length + 1,
          winner: false
        };
        
        race.participants.set(racer.thought.id, result);
        return result;
      })
    );
    
    const winner: RaceResult = await Promise.race(...); // Type inferred from Promise.race return
 winner.winner = true; // The 'winner' variable is already declared above
    race.winner = winner;
    
    // Winner gets QoS boost (Hebbian reinforcement)
    this.reinforceWinner(winner);
    
    // Losers get slight QoS penalty
    const losers = racers
      .filter(r => r.thought.id !== winner.thought.id)
      .map(r => race.participants.get(r.thought.id)!)
      .filter(r => r !== undefined);
    
    this.penalizeLosers(losers);
    
    // Update win history for analysis
    return winner.thought;
  }
  
  private calculateEffectiveQoS(thought: NeuralPacket): NeuralQoS {
    const pathKey: string = this.getPathKey(thought);
    const boost: number = this.qosBoosts.get(pathKey) || 1.0;
    
    return {
      ...thought.qos,
      latency: thought.qos.latency / boost,
      bandwidth: thought.qos.bandwidth * boost,
      priority: Math.min(100, thought.qos.priority + Math.floor(boost * 10))
    };
  }
  
  private calculatePropagationDelay(racer: { thought: NeuralPacket; startTime: number; path: SynapticPath; qos: NeuralQoS }): number {
    const baseDelay: number = racer.qos.latency;
    const jitterNoise: number = (Math.random() - 0.5) * racer.qos.jitter;
    const loadDelay: number = 1000 / racer.qos.bandwidth; // Inverse bandwidth
    const priorityBonus: number = (46 - racer.qos.dscp) * 0.5; // Higher DSCP = less delay
    
    // Packet loss simulation
    if (Math.random() < racer.qos.loss) {
      return Infinity; // Lost packet never arrives
    }
    
    return Math.max(0, baseDelay + jitterNoise + loadDelay - priorityBonus);
  }
  
  private async simulateDelay(ms: number): Promise<void> {
    if (ms === Infinity) {
      return new Promise(() => {}); // Never resolves
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private reinforceWinner(winner: RaceResult): void {
    const pathKey: string = this.getPathKey(winner.thought);
    const currentBoost: number = this.qosBoosts.get(pathKey) || 1.0;
    
    const speedBonus: number = 100 / winner.raceTime;
    const newBoost: number = currentBoost * (1 + 0.1 * speedBonus);
    
    this.qosBoosts.set(pathKey, Math.min(newBoost, 10)); // Cap at 10x
    
    // Upgrade DSCP class if consistent winner
    if (newBoost > 1.5 && winner.thought.qos.dscp < DSCP.CONSCIOUS_THOUGHT) {
      winner.thought.qos.dscp = this.upgradeDSCP(winner.thought.qos.dscp);
    }
  }
  
  private penalizeLosers(losers: RaceResult[]): void {
    losers.forEach(loser => {
      const pathKey: string = this.getPathKey(loser.thought);
      const currentBoost: number = this.qosBoosts.get(pathKey) || 1.0; // Explicit type

      // Gentle penalty - we still want diversity
      const newBoost: number = currentBoost * 0.95; // Explicit type
      this.qosBoosts.set(pathKey, Math.max(newBoost, 0.1)); // Floor at 0.1x
      
      // Downgrade DSCP if consistent loser
      if (newBoost < 0.5 && loser.thought.qos.dscp > DSCP.DEFAULT) {
        loser.thought.qos.dscp = this.downgradeDSCP(loser.thought.qos.dscp);
      }
    });
  }
  
  private upgradeDSCP(current: DSCP): DSCP {
    const progression: DSCP[] = [ // Explicit type
      DSCP.DEFAULT,
      DSCP.SUBCONSCIOUS,
      DSCP.BACKGROUND_PROCESS,
      DSCP.WORKING_MEMORY,
      DSCP.ATTENTION_FOCUS,
      DSCP.CONSCIOUS_THOUGHT
    ];
    
    const currentIndex: number = progression.indexOf(current); // Explicit type
    return progression[Math.min(currentIndex + 1, progression.length - 1)];
  }
  
  private downgradeDSCP(current: DSCP): DSCP {
    const progression: DSCP[] = [ // Explicit type
      DSCP.DEFAULT,
      DSCP.SUBCONSCIOUS,
      DSCP.BACKGROUND_PROCESS,
      DSCP.WORKING_MEMORY,
      DSCP.ATTENTION_FOCUS,
      DSCP.CONSCIOUS_THOUGHT
    ];
    
    const currentIndex: number = progression.indexOf(current); // Explicit type
    return progression[Math.max(currentIndex - 1, 0)];
  }
  
  private selectPath(thought: NeuralPacket): SynapticPath {
    // Simple path selection - in real implementation would use routing table
    return { // Ensure object literal has correct types
      source: 'input',
      destination: 'output',
      intermediates: this.selectIntermediates(thought),
      weight: (Math.random() * 0.5 + 0.5),
      delay: thought.qos.latency,
      reliability: (1 - thought.qos.loss)
    };
  }

  private selectIntermediates(thought: NeuralPacket): string[] {
    // Route through cognitive systems based on thought type
    const intermediates: string[] = []; // Explicit type

    // Sensory input always goes through thalamus
    intermediates.push(CognitiveAS.THALAMUS.toString());
    
    // High-frequency thoughts go through attention
    if (thought.frequency > 30) {
      intermediates.push(CognitiveAS.ACC.toString());
    }
    
    // Memory-related thoughts go through hippocampus
    if (thought.amplitude > 0.7) {
      intermediates.push(CognitiveAS.HIPPOCAMPUS.toString());
    }
    
    // Executive processing for complex thoughts
    if (thought.qos.dscp >= DSCP.WORKING_MEMORY) {
      intermediates.push(CognitiveAS.PREFRONTAL.toString());
    }
    
    return intermediates;
  }
  
  private getPathKey(thought: NeuralPacket): string {
    return `${thought.streamId}_${thought.qos.dscp}`;
  }
  
  private updateWinHistory(winner: RaceResult): void { 
    const pathKey: string = this.getPathKey(winner.thought); // Explicit type
    const history: number[] = this.winHistory.get(pathKey) || []; // Explicit type
    history.push(winner.raceTime);
    
    // Keep only last 100 wins
    if (history.length > 100) {
      history.shift();
    }
    
    this.winHistory.set(pathKey, history);
  }
  
  getStatistics(): ThoughtRacerStatistics {
    const stats: ThoughtRacerStatistics = { // Explicit type
      totalRaces: this.races.size,
      pathBoosts: Object.fromEntries(this.qosBoosts),
      averageWinTimes: {}
    };
    
    this.winHistory.forEach((times, path) => {
      const avg: number = times.reduce((a: number, b: number) => a + b, 0) / times.length; // Explicit type
      stats.averageWinTimes[path] = avg;
    });
    
    return stats;
  }
}

// ============================================================================
// GAMMA OSCILLATOR - Binding through 40Hz rhythms
// ============================================================================

export class GammaOscillator {
  private readonly GAMMA_FREQ = 40; // Hz - binding frequency
  private readonly BURST_WINDOW = 25; // ms - gamma period (1000/40)
  private readonly THETA_FREQ = 6; // Hz - memory rhythm
  
  /**
 * Generate burst of packets at gamma frequency
   */
  generateBurst(thought: NeuralPacket, burstSize?: number): NeuralPacket[] {
    const burst: NeuralPacket[] = [];
    const size: number = burstSize || Math.ceil(thought.qos.burstiness * 10);
    
    for (let i: number = 0; i < size; i++) {
      const phaseOffset: number = (i / size) * 2 * Math.PI;
      const timeOffset: number = (i * 1000000) / this.GAMMA_FREQ;
      
      burst.push({
        ...thought,
        id: `${thought.id}_burst_${i}`,
        phase: phaseOffset,
        timestamp: thought.timestamp + BigInt(Math.floor(timeOffset)),
        qos: {
          ...thought.qos,
          // QoS modulated by gamma phase
          latency: thought.qos.latency * (1 + 0.1 * Math.sin(phaseOffset)),
          // Burst packets get priority boost
          dscp: this.modulateDSCP(thought.qos.dscp, phaseOffset),
          bandwidth: thought.qos.bandwidth * (1 + thought.qos.burstiness)
        }
      });
    }
    
    return burst;
  }
  
  /**
   * Generate theta-nested gamma bursts (memory encoding)
   */
  generateThetaGamma(thought: NeuralPacket, duration: number = 1000): NeuralPacket[] {
    const packets: NeuralPacket[] = []; // Explicit type
    const thetaPeriod: number = 1000 / this.THETA_FREQ; // ms - Explicit type
    const gammaPeriod: number = 1000 / this.GAMMA_FREQ; // ms - Explicit type
    
    let time: number = 0; // Explicit type
    while (time < duration) {
      // Theta phase determines gamma burst strength
      const thetaPhase: number = (time / thetaPeriod) * 2 * Math.PI; // Explicit type
      const gammaStrength: number = (Math.sin(thetaPhase) + 1) / 2; // 0 to 1 - Explicit type
      
      if (gammaStrength > 0.3) { // Threshold for gamma burst\n
        // Generate gamma burst
        const burstSize = Math.floor(gammaStrength * 7); // 0-7 gamma cycles
        const burst = this.generateBurst(thought, burstSize);
        
        // Adjust timestamp for theta cycle
        burst.forEach(p => {
          p.timestamp = thought.timestamp + BigInt(time * 1000);
          p.amplitude *= gammaStrength; // Modulate by theta
        });
        
        packets.push(...burst);
      }
      
      time += gammaPeriod;
    }
    
    return packets;
  }
  
  /**
   * Detect phase-locked binding between bursts
   */
  detectBinding(bursts: NeuralPacket[][]): boolean {
    // Flatten all packets // Parameter 'bursts' already typed
    const allPackets = bursts.flat();
    
    // Group by timestamp (within gamma period)
    const timeGroups: Map<number, NeuralPacket[]> = new Map();
    
    allPackets.forEach(packet => {
      const timeBin: number = Math.floor(Number(packet.timestamp) / 1000 / this.BURST_WINDOW);
      const group: NeuralPacket[] = timeGroups.get(timeBin) || [];
      group.push(packet);
      timeGroups.set(timeBin, group);
    });
    
    // Check phase coherence in each time bin
    let coherentBins: number = 0;
    timeGroups.forEach(group => {
      const coherence: number = calculateCoherence(group);
      if (coherence > 0.8) coherentBins++;
    });
    
    // Binding occurs if most bins are coherent
    return coherentBins / timeGroups.size > 0.7;
  }
  
  /**
   * Calculate cross-frequency coupling
   */
 calculateCrossFrequencyCoupling(packets: NeuralPacket[]): number { // Parameter 'packets' already typed
    // Group packets by frequency band
    const bands: { theta: NeuralPacket[]; gamma: NeuralPacket[] } = { // Explicit type for bands
      theta: packets.filter(p => isInBand(p.frequency, OscillationBand.THETA)),
      gamma: packets.filter(p => isInBand(p.frequency, OscillationBand.GAMMA))
    };

    if (bands.theta.length === 0 || bands.gamma.length === 0) {
      return 0;
    }
    
    // Calculate phase-amplitude coupling
    let coupling: number = 0;
    bands.theta.forEach(thetaPacket => {
      bands.gamma.forEach(gammaPacket => {
        // Gamma amplitude should be high when theta phase is optimal
        const thetaPacket: NeuralPacket = thetaPacket;
        const gammaPacket: NeuralPacket = gammaPacket;
        const thetaPhase: number = thetaPacket.phase;
        const gammaAmp: number = gammaPacket.amplitude;
        const optimalPhase: number = Math.PI;
        const phaseDiff: number = Math.abs(thetaPhase - optimalPhase);
        
        coupling += gammaAmp * Math.cos(phaseDiff);
      });
    });
    
    return coupling / (bands.theta.length * bands.gamma.length);
  }
  
  private modulateDSCP(baseDSCP: DSCP, phase: number): DSCP { // Parameters already typed
    // Boost priority at peak of gamma cycle
    const boost: boolean = Math.sin(phase) > 0.7; // Explicit type for boost
    
    if (boost && baseDSCP < DSCP.CONSCIOUS_THOUGHT) {
      // Temporary priority boost during gamma peak
      const progression: DSCP[] = [
        DSCP.DEFAULT,
        DSCP.SUBCONSCIOUS,
        DSCP.BACKGROUND_PROCESS, // Corrected indentation
        DSCP.WORKING_MEMORY,
        DSCP.ATTENTION_FOCUS,
        DSCP.CONSCIOUS_THOUGHT
      ];
      
      const currentIndex = progression.indexOf(baseDSCP);
      return progression[Math.min(currentIndex + 1, progression.length - 1)];
    }
    
    return baseDSCP;
  }
}

// ============================================================================
// ATTENTION MECHANISM - Interference-based focusing
// ============================================================================

/**
 * Statistics for the AttentionMechanism
 */
export interface AttentionStatistics {
  averageIntensity: number;
  averageBinding: number;
  shifts: number;
  currentFocus: InterferencePattern | undefined;
}

export class AttentionMechanism {
  private focusHistory: InterferencePattern[] = [];
  private attentionWindow: number = 200; // ms
  
  /**
   * Calculate interference pattern from multiple packets
   */
  calculateInterference(packets: NeuralPacket[]): InterferencePattern { // Parameter 'packets' already typed
 if (packets.length === 0) {
      return {
 intensity: 0,
 binding: 0,
 frequency: 0,
        phase: 0,
        locations: []
      };
    }
    
    // Calculate superposition of all packet waves
    let totalIntensity: number = 0; // Explicit type
    let sumCos: number = 0;
    let sumSin: number = 0;
    let dominantFreq: number = 0;
    let maxAmp: number = 0;
    const activeLocations: Set<string> = new Set<string>();
    
 packets.forEach((packet: NeuralPacket) => {
      // Wave superposition
      const amp: number = packet.amplitude; // Explicit type
      const phase: number = packet.phase; // Explicit type

      sumCos += amp * Math.cos(phase); // Type inferred from assignment
      sumSin += amp * Math.sin(phase); // Type inferred from assignment
      totalIntensity += amp * amp; // Power
      
      // Track dominant frequency
      if (amp > maxAmp) {
        maxAmp = amp;
        dominantFreq = packet.frequency;
      }
      
      // Track active brain regions
      if (packet.path) {
        packet.path.intermediates.forEach(loc => activeLocations.add(loc));
      }
    });
    
    // Resultant wave
    const resultantAmp: number = Math.sqrt(sumCos * sumCos + sumSin * sumSin);
    const resultantPhase: number = Math.atan2(sumSin, sumCos);
    
    // Check for gamma-band binding
    const gammaPackets: NeuralPacket[] = packets.filter(p => 
      isInBand(p.frequency, OscillationBand.GAMMA)
    );
    const bindingStrength: number = gammaPackets.length > 0 // Explicit type
 ? calculateCoherence(gammaPackets) // Type inferred from function return
      : 0;
    
    const pattern: InterferencePattern = {
      intensity: resultantAmp / packets.length, // Normalized
      binding: bindingStrength,
      frequency: dominantFreq,
      phase: resultantPhase,
      locations: Array.from(activeLocations)
    };
    
    this.focusHistory.push(pattern);
    if (this.focusHistory.length > 100) {
      this.focusHistory.shift();
    }
    
    return pattern;
  }
  
  /**
   * Determine if attention should shift based on interference
   */
  shouldShiftAttention(newPattern: InterferencePattern): boolean {
 // Parameter 'newPattern' already typed
    if (this.focusHistory.length === 0) return true;
    
    const currentFocus: InterferencePattern = this.focusHistory[this.focusHistory.length - 1]; // Explicit type
    // Shift if new pattern is significantly stronger
    const intensityRatio: number = newPattern.intensity / (currentFocus.intensity + 0.001); // Explicit type
    if (intensityRatio > 2.0) return true; // Condition checks number value
    
    // Shift if binding is much stronger (conscious breakthrough)
    if (newPattern.binding > 0.9 && currentFocus.binding < 0.5) return true;
    
    // Shift if different brain regions activated
    const overlap = currentFocus.locations.filter(loc => 
      newPattern.locations.includes(loc)
 ).length; // Type inferred from array filter result
    const similarity = overlap / Math.max(
      currentFocus.locations.length,
      newPattern.locations.length,
      1
    );
    
    if (similarity < 0.3) return true; // Very different regions
    
    return false;
  }
  
  /**
   * Apply attention gain to packets
   */
  applyAttentionGain(
    packets: NeuralPacket[],
    focus: InterferencePattern
  ): NeuralPacket[] {
 // Parameters 'packets' and 'focus' already typed
    return packets.map(packet => {
      // Calculate attention weight based on alignment with focus      const phaseAlignment: number = Math.cos(packet.phase - focus.phase); // Explicit type      const freqAlignment: number = 1 / (1 + Math.abs(packet.frequency - focus.frequency)); // Explicit type      const attentionGain: number = (phaseAlignment + 1) * freqAlignment; // Explicit type
      const phaseAlignment: number = Math.cos(packet.phase - focus.phase);
      const freqAlignment: number = 1 / (1 + Math.abs(packet.frequency - focus.frequency));
      const attentionGain: number = (phaseAlignment + 1) * freqAlignment; // Explicit type
      
      return {
        ...packet,
        amplitude: Math.min(1, packet.amplitude * attentionGain),
        qos: {
          ...packet.qos,
          dscp: attentionGain > 1.5 ? DSCP.ATTENTION_FOCUS : packet.qos.dscp,
          priority: Math.min(100, packet.qos.priority + Math.floor(attentionGain * 10))
        }
      };
    });
  }
  
  getAttentionStatistics(): AttentionStatistics {
 // Return type already defined
    if (this.focusHistory.length === 0) {
      return { averageIntensity: 0, averageBinding: 0, shifts: 0, currentFocus: undefined };
    }
    const avgIntensity: number = this.focusHistory.reduce((sum: number, p: InterferencePattern) => sum + p.intensity, 0)
      / this.focusHistory.length;
    const avgBinding: number = this.focusHistory.reduce((sum: number, p: InterferencePattern) => sum + p.binding, 0)
      / this.focusHistory.length;
    
    // Count attention shifts (large changes in pattern)
    let shifts = 0;
    for (let i = 1; i < this.focusHistory.length; i++) {
      const prev: InterferencePattern = this.focusHistory[i - 1]; // Explicit type
      const curr: InterferencePattern = this.focusHistory[i]; // Explicit type
      if (Math.abs(curr.frequency - prev.frequency) > 10) shifts++;
    }
    
    return {
      averageIntensity: avgIntensity,
      averageBinding: avgBinding,
      shifts,
      currentFocus: this.focusHistory[this.focusHistory.length - 1]
    };
  }
}