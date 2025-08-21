import {
  NeuralPacket,
  NeuralQoS,
  DSCP,
  SynapticPath,
  RaceResult,
  Race,
  CognitiveAS
} from './neural-packet-types';

/**
 * Statistics for the ThoughtRacer
 */
export interface ThoughtRacerStatistics {
  totalRaces: number;
  pathBoosts: { [key: string]: number };
  averageWinTimes: { [key: string]: number };
}

/**
 * Represents a thought currently racing
 */
export interface Racer {
  thought: NeuralPacket;
  startTime: number;
  path: SynapticPath;
  qos: NeuralQoS;
}

// ============================================================================\
// THOUGHT RACER - Competitive Neural Selection
// ============================================================================\

export class ThoughtRacer {
  private races: Map<string, Race> = new Map();
  private qosBoosts: Map<string, number> = new Map();
  private winHistory: Map<string, number[]> = new Map();

  /**
   * Race multiple thoughts - fastest one wins and gets QoS boost
   */
  async race(thoughts: NeuralPacket[]): Promise<NeuralPacket> {
    const raceId: string = crypto.randomUUID();
    const race = new Race(raceId);
    this.races.set(raceId, race);

    // Launch all thoughts simultaneously
    const racers: Racer[] = thoughts.map(thought => ({
      thought: thought,
      startTime: performance.now(),
      // Assuming selectPath is synchronous or returns SynapticPath
      path: this.selectPath(thought),
      // Note: calculateEffectiveQoS should return NeuralQoS as per its signature
      qos: this.calculateEffectiveQoS(thought)
    }));

    // Race with QoS-weighted propagation delays
    const winnerResult = await Promise.race(
      racers.map(async (racer) => {
        // Simulate propagation with QoS-based delay
        const delay = this.calculatePropagationDelay(racer);
        await this.simulateDelay(delay);

        const result: RaceResult = { // Explicit type
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

    // Although Promise.race returns RaceResult, we want the winning packet
    const winner: NeuralPacket = winnerResult.thought;
    winnerResult.winner = true; // Mark the winner in the RaceResult
    race.winner = winnerResult; // Store the winning RaceResult in the Race

    // Winner gets QoS boost (Hebbian reinforcement)
    this.reinforceWinner(winnerResult);

    // Losers get slight QoS penalty
    const losers: RaceResult[] = racers // Explicit type
      .filter(r => r.thought.id !== winner.id)
      .map(r => race.participants.get(r.thought.id)!)
      .filter(r => r !== undefined);

    this.penalizeLosers(losers);

    // Update win history for analysis
    this.updateWinHistory(winnerResult);

    return winner; // Return the winning NeuralPacket
  }

  private calculateEffectiveQoS(thought: NeuralPacket): NeuralQoS {
    const pathKey = this.getPathKey(thought);
    const boost = this.qosBoosts.get(pathKey) || 1.0;

    return {
      ...thought.qos,
      latency: thought.qos.latency / boost,
      bandwidth: thought.qos.bandwidth * boost,
      priority: Math.min(100, thought.qos.priority + Math.floor(boost * 10))
    };
  }

  private calculatePropagationDelay(racer: Racer): number {
    const baseDelay = racer.qos.latency; // Explicit type
    const jitterNoise = (Math.random() - 0.5) * racer.qos.jitter; // Explicit type
    const loadDelay = 1000 / racer.qos.bandwidth; // Inverse bandwidth // Explicit type
    const priorityBonus = (46 - racer.qos.dscp) * 0.5; // Higher DSCP = less delay // Explicit type

    // Packet loss simulation
    if (Math.random() < racer.qos.loss) {
      return Infinity; // Lost packet never arrives
    }

    return Math.max(0, baseDelay + jitterNoise + loadDelay - priorityBonus);
  }

  private async simulateDelay(ms: number): Promise<void> {
    if (ms === Infinity) {
      return new Promise(() => { }); // Never resolves
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private reinforceWinner(winner: RaceResult): void {
    const pathKey: string = this.getPathKey(winner.thought); // Explicit type
    const currentBoost: number = this.qosBoosts.get(pathKey) || 1.0; // Explicit type

    // Adaptive boost based on win margin and speed
    const speedBonus: number = 100 / winner.raceTime; // Faster wins = bigger boost
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
      const newBoost: number = currentBoost * 0.95;
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
      DSCP.CONSCIOUS_THOUGHT,
    ];

    const currentIndex: number = progression.indexOf(current);
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

    const currentIndex: number = progression.indexOf(current);
    return progression[Math.max(currentIndex - 1, 0)];
  }

  private selectPath(thought: NeuralPacket): SynapticPath {
    // Simple path selection - in real implementation would use routing table
    return {
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
    const intermediates: string[] = [];

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
    const pathKey: string = this.getPathKey(winner.thought);
    const history: number[] = this.winHistory.get(pathKey) || [];
    history.push(winner.raceTime);

    // Keep only last 100 wins
    if (history.length > 100) {
      history.shift();
    }

    this.winHistory.set(pathKey, history);
  }

  getStatistics(): ThoughtRacerStatistics {
    const stats: ThoughtRacerStatistics = {
      totalRaces: this.races.size,
      pathBoosts: Object.fromEntries(this.qosBoosts),
      averageWinTimes: {}
    };

    this.winHistory.forEach((times, path) => {
      const avg: number = times.reduce((a, b) => a + b, 0) / times.length;
      stats.averageWinTimes[path] = avg;
    });

    return stats;
  }
}