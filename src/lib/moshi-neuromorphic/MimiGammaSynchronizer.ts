/**
 * Mimi-Gamma Synchronizer - Bridges 12.5Hz Mimi frames with 40Hz gamma oscillations
 * 
 * This handles the critical timing synchronization between the Mimi codec's
 * frame rate and the neuromorphic gamma oscillations for neural binding.
 */

import { NeuralPacket, PacketType, DSCP } from '../../experiments/neuromorphic-research/neural-packet-types';

export interface MimiFrame {
  data: Float32Array;
  timestamp: number;
  frameIndex: number;
  energy: number;
}

export interface GammaSyncConfig {
  mimiFrameRate: number;    // 12.5 Hz
  gammaFrequency: number;   // 40 Hz
  thetaFrequency: number;   // 6 Hz for memory encoding
  phaseAlignment: boolean;  // Whether to maintain phase coherence
}

export class MimiGammaSynchronizer {
  private config: GammaSyncConfig;
  private phaseAccumulator: number = 0;
  private frameBuffer: MimiFrame[] = [];
  private gammaPhase: number = 0;
  private thetaPhase: number = 0;
  
  // Timing constants
  private readonly MIMI_PERIOD_MS = 80;    // 1000/12.5 Hz
  private readonly GAMMA_PERIOD_MS = 25;   // 1000/40 Hz
  private readonly THETA_PERIOD_MS = 167;  // 1000/6 Hz
  private readonly GAMMA_PER_MIMI = 3.2;   // 40/12.5
  
  constructor(config?: Partial<GammaSyncConfig>) {
    this.config = {
      mimiFrameRate: 12.5,
      gammaFrequency: 40,
      thetaFrequency: 6,
      phaseAlignment: true,
      ...config
    };
  }
  
  /**
   * Synchronize a Mimi frame to gamma oscillations
   * Generates multiple gamma-locked packets per Mimi frame
   */
  public synchronizeToFrame(audioFrame: Float32Array): NeuralPacket[] {
    const packets: NeuralPacket[] = [];
    const frameTimestamp = Date.now();
    
    // Calculate frame energy for amplitude modulation
    const frameEnergy = this.calculateFrameEnergy(audioFrame);
    
    // Generate gamma bursts for this frame (3-4 gamma cycles per Mimi frame)
    const gammaBurstsPerFrame = Math.floor(this.GAMMA_PER_MIMI);
    const extraBurst = (this.phaseAccumulator += 0.2) >= 1; // Handle fractional part
    if (extraBurst) {
      this.phaseAccumulator -= 1;
    }
    
    const totalBursts = gammaBurstsPerFrame + (extraBurst ? 1 : 0);
    
    for (let i = 0; i < totalBursts; i++) {
      // Calculate timing within the Mimi frame
      const gammaOffset = i * this.GAMMA_PERIOD_MS;
      const timestamp = frameTimestamp + gammaOffset;
      
      // Update gamma phase
      this.gammaPhase = (this.gammaPhase + 2 * Math.PI / totalBursts) % (2 * Math.PI);
      
      // Update theta phase (slower modulation)
      this.thetaPhase = (timestamp / this.THETA_PERIOD_MS * 2 * Math.PI) % (2 * Math.PI);
      
      // Theta modulates gamma strength (theta-gamma coupling)
      const thetaModulation = (Math.sin(this.thetaPhase) + 1) / 2; // 0 to 1
      const gammaStrength = 0.5 + 0.5 * thetaModulation; // 0.5 to 1
      
      // Create neural packet for this gamma burst
      const packet: NeuralPacket = this.createGammaPacket(
        audioFrame,
        frameEnergy,
        timestamp,
        i,
        gammaStrength
      );
      
      packets.push(packet);
      
      // Add phase-locked satellites for binding (if phase alignment enabled)
      if (this.config.phaseAlignment && gammaStrength > 0.7) {
        packets.push(...this.createPhaseSatellites(packet));
      }
    }
    
    return packets;
  }
  
  /**
   * Create a gamma-locked neural packet from audio data
   */
  private createGammaPacket(
    audioFrame: Float32Array,
    energy: number,
    timestamp: number,
    burstIndex: number,
    strength: number
  ): NeuralPacket {
    // Extract features from audio frame segment
    const segmentStart = Math.floor((burstIndex / this.GAMMA_PER_MIMI) * audioFrame.length);
    const segmentEnd = Math.floor(((burstIndex + 1) / this.GAMMA_PER_MIMI) * audioFrame.length);
    const segment = audioFrame.slice(segmentStart, segmentEnd);
    
    // Calculate spectral centroid for frequency mapping
    const spectralCentroid = this.calculateSpectralCentroid(segment);
    
    return {
      id: crypto.randomUUID(),
      type: PacketType.PERCEPTION,
      timestamp: BigInt(timestamp * 1000), // Convert to microseconds
      
      sourceAS: {
        id: 'mimi-codec',
        type: 'sensory'
      },
      destinationAS: {
        id: 'gamma-binding',
        type: 'consciousness'
      },
      
      // Neural properties
      frequency: this.config.gammaFrequency,
      amplitude: energy * strength,
      phase: this.gammaPhase,
      
      // QoS for real-time processing
      qos: {
        dscp: energy > 0.5 ? DSCP.EF : DSCP.AF31, // High energy gets priority
        latency: this.GAMMA_PERIOD_MS,
        bandwidth: segment.length * 4, // Float32 bytes
        jitter: 5, // ms
        burstiness: strength,
        reliability: 0.99
      },
      
      // Audio payload
      payload: {
        audioSegment: Array.from(segment),
        spectralCentroid,
        energy,
        frameIndex: Math.floor(timestamp / this.MIMI_PERIOD_MS),
        gammaIndex: burstIndex,
        thetaPhase: this.thetaPhase
      },
      
      metadata: {
        synchronizer: 'mimi-gamma',
        gammaStrength: strength,
        phaseCoherent: this.config.phaseAlignment
      }
    };
  }
  
  /**
   * Create phase-locked satellite packets for neural binding
   */
  private createPhaseSatellites(
    primaryPacket: NeuralPacket
  ): NeuralPacket[] {
    const satellites: NeuralPacket[] = [];
    
    // Create 2-3 phase-locked satellites at harmonic frequencies
    const harmonics = [2, 3]; // 80Hz, 120Hz
    
    for (const harmonic of harmonics) {
      const satellite: NeuralPacket = {
        ...primaryPacket,
        id: `${primaryPacket.id}_h${harmonic}`,
        frequency: this.config.gammaFrequency * harmonic,
        amplitude: primaryPacket.amplitude * (1 / harmonic), // Decrease with harmonic
        phase: primaryPacket.phase * harmonic, // Phase-locked
        
        metadata: {
          ...primaryPacket.metadata,
          satelliteOf: primaryPacket.id,
          harmonic
        }
      };
      
      satellites.push(satellite);
    }
    
    return satellites;
  }
  
  /**
   * Calculate frame energy (RMS)
   */
  private calculateFrameEnergy(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }
  
  /**
   * Calculate spectral centroid (brightness indicator)
   */
  private calculateSpectralCentroid(segment: Float32Array): number {
    // Simple approximation using zero-crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < segment.length; i++) {
      if ((segment[i] >= 0) !== (segment[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    
    // Map to frequency estimate (very rough)
    const zeroCrossingRate = zeroCrossings / segment.length;
    return zeroCrossingRate * 12000; // Map to 0-12kHz range
  }
  
  /**
   * Reset phase accumulators for clean start
   */
  public reset(): void {
    this.phaseAccumulator = 0;
    this.gammaPhase = 0;
    this.thetaPhase = 0;
    this.frameBuffer = [];
  }
  
  /**
   * Get current synchronization state
   */
  public getState() {
    return {
      gammaPhase: this.gammaPhase,
      thetaPhase: this.thetaPhase,
      phaseAccumulator: this.phaseAccumulator,
      bufferedFrames: this.frameBuffer.length
    };
  }
}