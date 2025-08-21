import {
  NeuralPacket,
  InterferencePattern,
  OscillationBand,
  DSCP,
  calculateCoherence,
  isInBand
} from './neural-packet-types';

/**
 * Statistics for the AttentionMechanism
 */
export interface AttentionStatistics {
  averageIntensity: number;
  averageBinding: number;
  shifts: number;
  currentFocus: InterferencePattern | undefined;
}

// ============================================================================\
// ATTENTION MECHANISM - Interference-based focusing
// ============================================================================\

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
    let totalIntensity: number = 0;
    let sumCos: number = 0;
    let sumSin: number = 0;
    let dominantFreq: number = 0;
    let maxAmp: number = 0;
    const activeLocations: Set<string> = new Set(); // Explicit type

    packets.forEach((packet: NeuralPacket) => {
      // Wave superposition
      const amp: number = packet.amplitude;
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
    const gammaPackets = packets.filter(p =>
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
 const intensityRatio: number = newPattern.intensity / (currentFocus.intensity + 0.001);
 if (intensityRatio > 2.0) return true;

    // Shift if binding is much stronger (conscious breakthrough)
    if (newPattern.binding > 0.9 && currentFocus.binding < 0.5) return true;

    // Shift if different brain regions activated
 const overlap: number = currentFocus.locations.filter(loc =>
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
      // Calculate attention weight based on alignment with focus
      const phaseAlignment: number = Math.cos(packet.phase - focus.phase); // Explicit type
      const freqAlignment: number = 1 / (1 + Math.abs(packet.frequency - focus.frequency)); // Explicit type
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
    const avgIntensity: number = this.focusHistory.reduce((sum: number, p: InterferencePattern) => sum + p.intensity, 0) // Explicit type
      / this.focusHistory.length;
    const avgBinding: number = this.focusHistory.reduce((sum: number, p: InterferencePattern) => sum + p.binding, 0)
 / this.focusHistory.length;
 
    // Count attention shifts (large changes in pattern)
    let shifts: number = 0;
    for (let i = 1; i < this.focusHistory.length; i++) {
      const prev: InterferencePattern = this.focusHistory[i - 1];
      const curr: InterferencePattern = this.focusHistory[i];
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