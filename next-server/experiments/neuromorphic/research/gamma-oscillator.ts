/**
 * Gamma Oscillator - Binding through 40Hz rhythms
 *
 * Simulates gamma band oscillations (around 40Hz), which are hypothesized
 * to be involved in neural binding and consciousness. It also incorporates
 * theta oscillations for memory encoding.
 */

import {
  NeuralPacket,
  DSCP,
  OscillationBand,
  calculateCoherence,
  isInBand
} from './neural-packet-types';

export class GammaOscillator {
  private readonly GAMMA_FREQ = 40; // Hz - binding frequency
  private readonly BURST_WINDOW = 25; // ms - gamma period (1000/40)
  private readonly THETA_FREQ = 6; // Hz - memory rhythm

  private gammaPhaseAccumulator: number = 0; // Accumulates phase for gamma synchronization
  private thetaPhase: number = 0; // Current theta phase

  /**
   * Synchronize an input frame (like audio) to gamma oscillations.
   * This simulates converting a lower-frequency input stream into
   * gamma-band packets for binding.
   */
  public synchronizeToFrame(audioFrame: Float32Array): NeuralPacket[] {
    const packets: NeuralPacket[] = [];
    const frameTimestamp = Date.now(); // Get current timestamp in ms

    // Calculate basic frame energy for amplitude
    const frameEnergy = this.calculateFrameEnergy(audioFrame);

    // Determine number of gamma cycles per frame (approx 3.2 for 12.5Hz input to 40Hz gamma)
    const gammaCyclesPerFrame = this.GAMMA_FREQ / (1000 / (audioFrame.length / 44100 * 1000)); // Assuming 44.1kHz sample rate for audioFrame
    const numGammaPackets = Math.floor(gammaCyclesPerFrame + this.gammaPhaseAccumulator);

    // Update phase accumulator for fractional cycles
    this.gammaPhaseAccumulator = (gammaCyclesPerFrame + this.gammaPhaseAccumulator) % 1;

    for (let i = 0; i < numGammaPackets; i++) {
      const packetTimestamp = frameTimestamp + (i * (1000 / this.GAMMA_FREQ)); // Distribute packets within the frame duration

      // Update gamma phase
      const gammaPhase = (i / numGammaPackets) * 2 * Math.PI; // Distribute phase evenly across packets in this frame

      // Update theta phase (slower modulation)
      // Estimate time elapsed since start or track globally for smoother theta
      // For simplicity here, a basic time mapping within the frame:
      const thetaPhase = (packetTimestamp / (1000 / this.THETA_FREQ) * 2 * Math.PI) % (2 * Math.PI);
      this.thetaPhase = thetaPhase; // Store the last calculated theta phase

      // Theta modulates gamma amplitude (theta-gamma coupling)
      const thetaModulation = (Math.sin(this.thetaPhase) + 1) / 2; // 0 to 1 based on sine wave
      const gammaAmplitude = frameEnergy * (0.5 + 0.5 * thetaModulation); // Modulate frame energy

      // Create a basic NeuralPacket for this gamma cycle
      packets.push({
        id: `${crypto.randomUUID()}_gamma_sync_${i}`,
        type: PacketType.PERCEPTION, // Or a new type like SYNC
        timestamp: BigInt(packetTimestamp * 1000), // Convert ms to microseconds
        sourceAS: { id: 'gamma-oscillator', type: 'internal' }, // Source is the oscillator
        destinationAS: { id: 'gamma-binding', type: 'consciousness' }, // Destination for binding
        amplitude: gammaAmplitude,
        frequency: this.GAMMA_FREQ,
        phase: gammaPhase,
        harmonics: [], // Simplification for this method
        qos: { dscp: DSCP.BACKGROUND_PROCESS, latency: 25, bandwidth: 0, jitter: 1, loss: 0, spikeRate: 40, burstiness: thetaModulation, coherence: 0, plasticityRate: 0.1 }, // Basic QoS
        payload: { sourceFrameEnergy: frameEnergy, thetaPhase: this.thetaPhase }, // Include relevant data in payload
      });
    }
    return packets;
  }

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

    let time: number = 0;
    while (time < duration) {
      // Theta phase determines gamma burst strength
      const thetaPhase: number = (time / thetaPeriod) * 2 * Math.PI;
      const gammaStrength: number = (Math.sin(thetaPhase) + 1) / 2; // 0 to 1

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
    // Flatten all packets
    const allPackets: NeuralPacket[] = bursts.flat();

    // Group by timestamp (within gamma period)
    const timeGroups: Map<number, NeuralPacket[]> = new Map(); // Explicit type

    allPackets.forEach(packet => {
      const timeBin: number = Math.floor(Number(packet.timestamp) / 1000 / this.BURST_WINDOW);
      const group: NeuralPacket[] = timeGroups.get(timeBin) || [];
      group.push(packet);
      timeGroups.set(timeBin, group);
    });

    // Check phase coherence in each time bin
    let coherentBins = 0; // Explicit type
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
 return 0; // Explicit return type is number
    }

    // Calculate phase-amplitude coupling
    let coupling = 0;
    bands.theta.forEach(thetaPacket => {
      bands.gamma.forEach(gammaPacket => {
        // Gamma amplitude should be high when theta phase is optimal
        const thetaPhase: number = thetaPacket.phase; // Explicit type for thetaPhase
        const gammaAmp: number = gammaPacket.amplitude; // Explicit type for gammaAmp
        const optimalPhase: number = Math.PI; // Peak of theta - Explicit type
        const phaseDiff: number = Math.abs(thetaPhase - optimalPhase); // Explicit type for phaseDiff

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
      const progression: DSCP[] = [ // Explicit type for progression
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