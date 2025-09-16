/**
 * Competitive Hebbian Learning Module
 * 
 * Implements spike-timing dependent plasticity (STDP) and competitive
 * learning rules for neural packet routing. "Cells that fire together,
 * wire together" - but in a packet network!
 */

import {
  NeuralPacket,
  SynapticPath,
  SynapticWeight,
  ArmStats,
  CognitiveAS,
  DSCP
} from './neural-packet-types';

// ============================================================================
// COMPETITIVE HEBBIAN LEARNING
// ============================================================================

export interface CompetitiveHebbianStatistics {
  totalSynapses: number;
  averageStrength: number;
  strongestPath: string;
  weakestPath: string;
  maxStrength: number;
  minStrength: number;
  qosDistribution: Map<DSCP, number>;
}


export class CompetitiveHebbian {
  private synapses: Map<string, SynapticWeight> = new Map();
  private spikeHistory: Map<string, bigint[]> = new Map();
  private readonly STDP_WINDOW = 20; // ms - spike timing window
  private readonly LTP_RATE = 0.1; // Long-term potentiation rate
  private readonly LTD_RATE = 0.05; // Long-term depression rate
  
  /**
   * Update weights based on spike timing - "Cells that fire first, wire first"
   */
  updateWeights(winner: NeuralPacket, losers: NeuralPacket[]): void {
    const winPath: string = this.getPathKey(winner);
    const winTime: bigint = winner.timestamp;
    
    // Record spike time
    this.recordSpike(winPath, winTime);
    
    // Winner gets potentiated (LTP)
    this.potentiate(winPath, winner);
    
    // Apply STDP rule
    this.applySTDP(winPath, winTime);
    
    // Lateral inhibition - losers get depressed
    losers.forEach(loser => {
      const lossPath: string = this.getPathKey(loser);
      this.recordSpike(lossPath, loser.timestamp);
      this.depress(lossPath, loser);
    });
    
    // Homeostatic normalization to prevent runaway growth
    this.normalizeWeights();
  }
  
  /**
   * Spike-Timing Dependent Plasticity
   * Pre-before-post strengthens, post-before-pre weakens
   */
  private applySTDP(postPath: string, postTime: bigint): void {
    // Check all recent spikes
    this.spikeHistory.forEach((spikeTimes, prePath) => {
      if (prePath === postPath) return; // Skip self
      
      spikeTimes.forEach(preTime => {
        const timeDiff = Number(postTime - preTime) / 1000000; // Convert to ms
        
        if (Math.abs(timeDiff) < this.STDP_WINDOW) {
          const connectionKey = `${prePath}->${postPath}`;
          const weight = this.synapses.get(connectionKey) || new SynapticWeight();
          
          if (timeDiff > 0) {
            // Pre before post - strengthen (LTP)
            const potentiation = this.LTP_RATE * Math.exp(-Math.abs(timeDiff) / this.STDP_WINDOW);
            weight.strength *= (1 + potentiation);
            weight.winStreak++;
          } else {
            // Post before pre - weaken (LTD)
            const depression = this.LTD_RATE * Math.exp(-Math.abs(timeDiff) / this.STDP_WINDOW);
            weight.strength *= (1 - depression);
            weight.lossStreak++;
          }
          
          weight.lastUsed = postTime;
          weight.totalUses++;
          this.synapses.set(connectionKey, weight);
        }
      });
    });
  }
  
  /**
   * Long-term potentiation for winning paths
   */
  private potentiate(path: string, packet: NeuralPacket): void {
    const weight: SynapticWeight = this.synapses.get(path) || new SynapticWeight();
    
    // Strengthen based on packet amplitude (signal strength)
    const strengthBonus: number = this.LTP_RATE * packet.amplitude;
    weight.strength = Math.min(10, weight.strength * (1 + strengthBonus));
    
    // Speed bonus - faster packets strengthen more
    const speedBonus = 1000 / packet.qos.latency;
    weight.strength *= (1 + 0.01 * speedBonus);
    
    // Update QoS for consistent winners
    weight.winStreak++;
    weight.lossStreak = 0;
    
    if (weight.winStreak > 3) {
      weight.qosClass = this.upgradeQoS(weight.qosClass);
      weight.bandwidth *= 1.2;
      weight.priority = Math.min(100, weight.priority + 5);
    }
    
    // Update statistics
    weight.lastUsed = packet.timestamp;
    weight.totalUses++;
    weight.averageLatency = (weight.averageLatency * (weight.totalUses - 1) + packet.qos.latency) / weight.totalUses;
    
    this.synapses.set(path, weight);
  }
  
  /**
   * Long-term depression for losing paths
   */
  private depress(path: string, packet: NeuralPacket): void {
    const weight: SynapticWeight = this.synapses.get(path) || new SynapticWeight();
    
    // Homeostatic depression
    weight.strength *= (1 - this.LTD_RATE);
    
    // Update streaks
    weight.lossStreak++;
    weight.winStreak = 0;
    
    // Downgrade QoS for consistent losers
    if (weight.lossStreak > 5) {
      weight.qosClass = this.downgradeQoS(weight.qosClass);
      weight.bandwidth *= 0.8;
      weight.priority = Math.max(0, weight.priority - 5);
    }
    
    // Update statistics
    weight.lastUsed = packet.timestamp;
    weight.totalUses++;
    
    this.synapses.set(path, weight);
  }
  
  /**
   * Normalize weights to prevent explosion/vanishing
   */
  private normalizeWeights(): void {
    // Calculate total synaptic weight
    let totalWeight: number = 0;
 this.synapses.forEach((weight: SynapticWeight) => {
 totalWeight += weight.strength;
    });
    
    if (totalWeight === 0) return;
    
    // Target total weight (homeostasis)
    const targetTotal = this.synapses.size * 1.0; // Average strength of 1.0
    const scaleFactor = targetTotal / totalWeight;
    
    // Only normalize if weights are getting too extreme
    if (scaleFactor < 0.5 || scaleFactor > 2.0) {
 this.synapses.forEach((weight: SynapticWeight) => {
        weight.strength *= scaleFactor;
      });
    }
  }
  
  /**
   * Record spike time for STDP
   */
  private recordSpike(path: string, time: bigint): void {
    const history: bigint[] = this.spikeHistory.get(path) || [];
    history.push(time);
    
    // Keep only recent spikes (within STDP window)
    const cutoff: bigint = time - BigInt(this.STDP_WINDOW * 2 * 1000000);
    const recentSpikes = history.filter(t => t > cutoff);
    
    this.spikeHistory.set(path, recentSpikes);
  }
  
  /**
   * Get synaptic weight for a path
   */
  getWeight(from: string, to: string): number {
    const key: string = `${from}->${to}`;
    const weight: SynapticWeight | undefined = this.synapses.get(key);
    return weight ? weight.strength : 1.0;
  }
  
  /**
   * Prune weak/unused synapses
   */
  pruneSynapses(maxAge: bigint = BigInt(60000000000)): number {
    // 60 seconds in microseconds
    const now = BigInt(Date.now() * 1000);
    let pruned: number = 0;

    this.synapses.forEach((weight, key) => {
      const age = now - weight.lastUsed;
      
      // Prune if too old or too weak
      if (age > maxAge || weight.strength < 0.1) {
        this.synapses.delete(key);
        pruned++;
      }
    });
    
    return pruned;
  }
  
  private getPathKey(packet: NeuralPacket): string {
    if (packet.path) {
      return `${packet.path.source}->${packet.path.destination}`;
    }
    return `stream_${packet.streamId}`;
  }
  
  private upgradeQoS(current: DSCP): DSCP {
    const progression: DSCP[] = [
      DSCP.DEFAULT,
      DSCP.SUBCONSCIOUS,
      DSCP.BACKGROUND_PROCESS,
      DSCP.WORKING_MEMORY,
      DSCP.ATTENTION_FOCUS,
      DSCP.CONSCIOUS_THOUGHT
    ];
    
    const idx: number = progression.indexOf(current);
    return progression[Math.min(idx + 1, progression.length - 1)];
  }
  
  private downgradeQoS(current: DSCP): DSCP {
    const progression: DSCP[] = [
      DSCP.DEFAULT, // Explicit type
      DSCP.SUBCONSCIOUS,
      DSCP.BACKGROUND_PROCESS,
      DSCP.WORKING_MEMORY,
      DSCP.ATTENTION_FOCUS,
      DSCP.CONSCIOUS_THOUGHT
    ];
    
    const idx: number = progression.indexOf(current); // Explicit type
    return progression[Math.max(idx - 1, 0)];
  }
  
  getStatistics(): CompetitiveHebbianStatistics {
    const stats: CompetitiveHebbianStatistics = {
      totalSynapses: this.synapses.size,
      strongestPath: '',
      weakestPath: '',
      maxStrength: 0,
      minStrength: Infinity,
      qosDistribution: new Map<DSCP, number>()
    };
    
    let totalStrength = 0;

    this.synapses.forEach((weight: SynapticWeight, path: string) => {
      totalStrength += weight.strength;
      
      if (weight.strength > stats.maxStrength && isFinite(weight.strength)) {
        stats.maxStrength = weight.strength;
        stats.strongestPath = path;
      }
      
      if (weight.strength < stats.minStrength) {
        stats.minStrength = weight.strength;
        stats.weakestPath = path;
      }
      
      const count: number = stats.qosDistribution.get(weight.qosClass) || 0;
      stats.qosDistribution.set(weight.qosClass, count + 1);
    });
    
    stats.averageStrength = totalStrength / this.synapses.size;
    
    return stats;
  }
}

/**
 * Statistics for the NeuralBandit
 */
export interface NeuralBanditStatistics {
  totalArms: number;
  totalPulls: number;
  exploration: number;
  armStats: Map<string, { pulls: number, meanReward: number, variance: number, qosMultiplier: number, confidence: number }>;
}

// ============================================================================
// NEURAL MULTI-ARMED BANDIT
  private arms: Map<string, ArmStats> = new Map();
  private totalPulls: number = 0;
  private exploration: number = 0.1; // Epsilon for exploration
  private readonly DECAY_RATE = 0.99; // Decay for old rewards
  
  /**
   * Select route using Thompson sampling with QoS priors
   */
  selectRoute(packet: NeuralPacket, availableRoutes: string[]): string {
    if (availableRoutes.length === 0) {
      throw new Error('No available routes');
    }
    
    if (availableRoutes.length === 1) {
      return availableRoutes[0];
    }
    
    // Exploration vs exploitation
    if (Math.random() < this.exploration) {
      // Explore: random route
      return availableRoutes[Math.floor(Math.random() * availableRoutes.length)];
    }
    
    // Exploit: choose best route based on UCB1 with QoS weighting
    let bestRoute: string = availableRoutes[0];
    let bestScore: number = -Infinity;
    
    availableRoutes.forEach(route => {
      const score = this.calculateUCB(route, packet);
      if (score > bestScore) {
        bestScore = score;
        bestRoute = route;
      }
    });
    
    return bestRoute;
  }
  
  /**
   * Calculate Upper Confidence Bound with QoS weighting
   */
  private calculateUCB(route: string, packet: NeuralPacket): number {
    const stats: ArmStats = this.arms.get(route) || new ArmStats();
    
    if (stats.pulls === 0) {
      return Infinity; // Unexplored routes have infinite potential
    }
    
    // Base UCB1 formula
    const exploitation: number = stats.meanReward;
    const exploration: number = Math.sqrt(2 * Math.log(this.totalPulls + 1) / stats.pulls);
    
    // QoS weighting based on packet priority
    const qosWeight = (packet.qos.dscp + 1) / 50; // Normalize DSCP to 0-1
    const qosBonus = stats.qosMultiplier * qosWeight;
    
    return exploitation + exploration + qosBonus;
  }
  
  /**
   * Update arm statistics after observing reward
   */
  updateArm(route: string, reward: number, latency: number): void {
    const stats: ArmStats = this.arms.get(route) || new ArmStats();
    
    // Speed-based reward (inverse latency)
    const speedReward: number = Math.min(1, 100 / latency); // Cap at 1 for very fast
    const finalReward: number = (reward + speedReward) / 2;
    
    // Update running average with decay for old observations
    stats.pulls++;
    if (stats.pulls === 1) {
      stats.meanReward = finalReward;
      stats.variance = 0;
    } else { // Explicit type for delta
      const delta: number = finalReward - stats.meanReward;
      stats.meanReward += delta / stats.pulls;
      stats.variance = stats.variance * this.DECAY_RATE + delta * delta * (1 - this.DECAY_RATE);
    }
    
    // Update QoS multiplier for consistently good routes
    const performance = stats.meanReward / Math.max(0.1, Math.sqrt(stats.variance + 0.01));
    if (performance > 2.0) {
      stats.qosMultiplier = Math.min(5, stats.qosMultiplier * 1.05);
    } else if (performance < 0.5) {
      stats.qosMultiplier = Math.max(0.2, stats.qosMultiplier * 0.95);
    }
    
    stats.lastPull = BigInt(Date.now() * 1000);
    this.arms.set(route, stats);
    this.totalPulls++;
    
    // Decay exploration over time
    this.exploration *= 0.9999;
    this.exploration = Math.max(0.01, this.exploration); // Minimum exploration
  }
  
  /**
   * Get performance percentile for a reward value
   */
  getPercentile(percentile: number): number {
    const rewards: number[] = []; // Explicit type
    this.arms.forEach((stats: ArmStats) => { // Explicit type
      if (stats.pulls > 0) {
        rewards.push(stats.meanReward);
      }
    });
    if (rewards.length === 0) return 0;
    
    rewards.sort((a, b) => a - b);
    const index = Math.floor(rewards.length * percentile);
    return rewards[Math.min(index, rewards.length - 1)];
  }
  
  /**
   * Reset poorly performing arms
   */
  resetPoorPerformers(threshold: number = 0.1): number {
    let reset: number = 0;
    const cutoff: number = this.getPercentile(threshold);

    this.arms.forEach((stats, route) => {
      if (stats.meanReward < cutoff && stats.pulls > 10) {
        // Give poor performers another chance
        stats.pulls = Math.floor(stats.pulls / 2);
        stats.meanReward = (stats.meanReward + 0.5) / 2; // Move toward neutral
        stats.variance = 1.0; // Reset uncertainty
        reset++;
      }
    });
    
    return reset;
  }
  
  getStatistics(): NeuralBanditStatistics {
    const stats: NeuralBanditStatistics = {
      totalArms: this.arms.size,
      totalPulls: this.totalPulls,
      exploration: this.exploration,
      armStats: new Map<string, { pulls: number, meanReward: number, variance: number, qosMultiplier: number, confidence: number }>()
    };
    
    this.arms.forEach((armStats, route) => {
      stats.armStats.set(route, {
        pulls: armStats.pulls,
        meanReward: armStats.meanReward,
        variance: armStats.variance,
        qosMultiplier: armStats.qosMultiplier,
        confidence: armStats.meanReward / Math.sqrt(armStats.variance + 0.01)
      });
    });
    
    return stats;
  }
}

// ============================================================================
// MICRO EXPERT GATE - Ion channel simulation
// ============================================================================

import { IonChannel, GateConfig } from './neural-packet-types';

export class MicroExpertGate {
  private config: GateConfig;
  private lastSpike: bigint = BigInt(0);
  private adaptationLevel: number = 0;
  private isOpen: boolean = false;
  
  constructor(config: GateConfig) {
    this.config = config;
  }
  
  /**
   * Determine if gate should activate (ion channel opens)
   */
  shouldActivate(packet: NeuralPacket): boolean {
    const now: bigint = packet.timestamp;
    const timeSinceLastSpike: number = Number(now - this.lastSpike) / 1000000; // ms
    
    // Check refractory period
    if (timeSinceLastSpike < this.config.refractory) {
      return false; // Still in refractory period
    }
    
    // Voltage-gated: amplitude must exceed threshold
    const effectiveThreshold: number = this.config.threshold * (1 + this.adaptationLevel);
    if (packet.amplitude < effectiveThreshold) {
      return false;
    }
    
    // Frequency selectivity (like ion channel selectivity)
    const resonance: number = this.calculateResonance(packet.frequency);
    if (resonance < 0.5) {
      return false; // Wrong frequency
    }
    
    // Phase coherence for specific channels
    if (this.config.ionChannel === IonChannel.NMDA) {
      // NMDA requires coincidence detection
      if (!this.checkCoincidence(packet)) {
        return false;
      }
    }
    
    // Gate opens!
    this.isOpen = true;
    this.lastSpike = now;
    
    // Spike-frequency adaptation
    this.adaptationLevel = Math.min(1, this.adaptationLevel + this.config.adaptation);
    
    return true;
  }
  
  /**
   * Calculate resonance with preferred frequency
   */
  private calculateResonance(frequency: number): number {
    const diff: number = Math.abs(frequency - this.config.resonantFreq);
    const bandwidth: number = this.config.resonantFreq * 0.2; // 20% bandwidth
    
    if (diff < bandwidth) {
      return 1 - (diff / bandwidth);
    }
    
    return Math.exp(-diff / bandwidth); // Exponential falloff
  }
  
  /**
   * Check for coincidence detection (NMDA-like)
   */

  private checkCoincidence(packet: NeuralPacket): boolean {
    // NMDA requires both presynaptic (high frequency) and postsynaptic (amplitude) activity
    return packet.frequency > 20 && packet.amplitude > 0.7;
  }
  
  /**
   * Reset adaptation (like removing calcium)
   */
 private resetAdaptation(): void {
    this.adaptationLevel = Math.max(0, this.adaptationLevel - 0.1);
  }
  
  /**
   * Get gate conductance (how much signal passes through)
   */
  getConductance(): number { // Return type already explicitly defined as number
    if (!this.isOpen) return 0;
    
    // Conductance depends on ion channel type
    switch (this.config.ionChannel) {
      case IonChannel.SODIUM:
        return 1.0; // Fast, full conductance
      case IonChannel.POTASSIUM:
        return 0.8; // Slightly slower
      case IonChannel.CALCIUM:
        return 0.5; // Slow, modulatory
      case IonChannel.NMDA:
        return 0.3; // Slow, voltage-dependent
      case IonChannel.AMPA:
        return 0.9; // Fast excitation
      case IonChannel.GABA:
        return -0.8; // Inhibitory (negative)
      default:
        return 0.5;
    }
  }
  
  /**
   * Close gate after some time
   */
  update(currentTime: bigint): void {
    const timeSinceSpike: number = Number(currentTime - this.lastSpike) / 1000000;
    
    // Different channels have different kinetics
    let closingTime: number = 5; // ms default
    
    switch (this.config.ionChannel) {
      case IonChannel.SODIUM:
        closingTime = 2; // Fast
        break;
      case IonChannel.CALCIUM:
        closingTime = 100; // Very slow
        break;
      case IonChannel.NMDA:
        closingTime = 150; // Even slower
        break;
    }
    
    if (timeSinceSpike > closingTime) {
      this.isOpen = false;
    }
    
    // Decay adaptation over time
    if (timeSinceSpike > 100) {
      this.resetAdaptation();
    }
  }
}