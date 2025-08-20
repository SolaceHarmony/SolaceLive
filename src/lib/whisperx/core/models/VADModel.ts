import type { VADSegment, AudioChunk } from '../../../../types/whisperx';

export interface VADConfig {
  threshold: number;
  sampleRate: number;
  windowSize?: number;
  hopLength?: number;
  minSpeechDuration?: number;
  minSilenceDuration?: number;
}

export class VADModel {
  private config: Required<VADConfig>;
  private isInitialized: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor(config: VADConfig) {
    this.config = {
      windowSize: 512,
      hopLength: 256,
      minSpeechDuration: 0.1,
      minSilenceDuration: 0.3,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      this.audioContext = new AC({
        sampleRate: this.config.sampleRate
      });
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.windowSize * 2;
      this.analyser.smoothingTimeConstant = 0.3;
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`VAD model initialization failed: ${error}`);
    }
  }

  async detect(audioChunk: AudioChunk): Promise<VADSegment[]> {
    if (!this.isInitialized) {
      throw new Error('VAD model not initialized');
    }

    const segments: VADSegment[] = [];
    const audioData = audioChunk.data;
    const sampleRate = audioChunk.sampleRate;
    
    // Simple energy-based VAD with smoothing
    const windowSize = this.config.windowSize;
    const hopLength = this.config.hopLength;
    const numWindows = Math.floor((audioData.length - windowSize) / hopLength) + 1;
    
    const energyValues: number[] = [];
    
    // Calculate energy for each window
    for (let i = 0; i < numWindows; i++) {
      const startIdx = i * hopLength;
      const endIdx = Math.min(startIdx + windowSize, audioData.length);
      
      let energy = 0;
      for (let j = startIdx; j < endIdx; j++) {
        energy += audioData[j] * audioData[j];
      }
      energy = Math.sqrt(energy / (endIdx - startIdx));
      energyValues.push(energy);
    }
    
    // Normalize energy values
    const maxEnergy = Math.max(...energyValues);
    const normalizedEnergy = energyValues.map(e => e / maxEnergy);
    
    // Apply threshold and find speech segments
    const speechMask = normalizedEnergy.map(e => e > this.config.threshold);
    
    // Smooth the mask to reduce false positives
    const smoothedMask = this.smoothBinaryMask(speechMask, 3);
    
    // Find continuous speech segments
    let isInSpeech = false;
    let speechStart = 0;
    
    for (let i = 0; i < smoothedMask.length; i++) {
      const timeStamp = (i * hopLength) / sampleRate;
      
      if (smoothedMask[i] && !isInSpeech) {
        // Speech start
        speechStart = timeStamp;
        isInSpeech = true;
      } else if (!smoothedMask[i] && isInSpeech) {
        // Speech end
        const duration = timeStamp - speechStart;
        
        if (duration >= this.config.minSpeechDuration) {
          segments.push({
            start: speechStart,
            end: timeStamp,
            confidence: this.calculateSegmentConfidence(
              normalizedEnergy,
              Math.floor(speechStart * sampleRate / hopLength),
              Math.floor(timeStamp * sampleRate / hopLength)
            )
          });
        }
        
        isInSpeech = false;
      }
    }
    
    // Handle case where audio ends during speech
    if (isInSpeech) {
      const endTime = audioData.length / sampleRate;
      const duration = endTime - speechStart;
      
      if (duration >= this.config.minSpeechDuration) {
        segments.push({
          start: speechStart,
          end: endTime,
          confidence: this.calculateSegmentConfidence(
            normalizedEnergy,
            Math.floor(speechStart * sampleRate / hopLength),
            normalizedEnergy.length - 1
          )
        });
      }
    }
    
    return this.mergeSimilarSegments(segments);
  }

  private smoothBinaryMask(mask: boolean[], kernelSize: number): boolean[] {
    const smoothed = [...mask];
    const halfKernel = Math.floor(kernelSize / 2);
    
    for (let i = halfKernel; i < mask.length - halfKernel; i++) {
      let trueCount = 0;
      
      for (let j = i - halfKernel; j <= i + halfKernel; j++) {
        if (mask[j]) trueCount++;
      }
      
      smoothed[i] = trueCount > halfKernel;
    }
    
    return smoothed;
  }

  private calculateSegmentConfidence(
    energyValues: number[],
    startIdx: number,
    endIdx: number
  ): number {
    if (startIdx >= endIdx || endIdx >= energyValues.length) return 0;
    
    let sum = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      sum += energyValues[i];
    }
    
    return Math.min(sum / (endIdx - startIdx + 1), 1.0);
  }

  private mergeSimilarSegments(segments: VADSegment[]): VADSegment[] {
    if (segments.length <= 1) return segments;
    
    const merged: VADSegment[] = [];
    let current = segments[0];
    
    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      const gap = next.start - current.end;
      
      // Merge if gap is smaller than minimum silence duration
      if (gap < this.config.minSilenceDuration) {
        current = {
          start: current.start,
          end: next.end,
          confidence: Math.max(current.confidence, next.confidence)
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  // Advanced VAD using spectral features
  async detectAdvanced(audioChunk: AudioChunk): Promise<VADSegment[]> {
    if (!this.isInitialized || !this.audioContext) {
      throw new Error('VAD model not initialized');
    }

    // Create audio buffer for analysis
    const audioBuffer = this.audioContext.createBuffer(
      1,
      audioChunk.data.length,
      audioChunk.sampleRate
    );
    audioBuffer.copyToChannel(audioChunk.data, 0);
    
    // Perform FFT analysis
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    
    // Calculate spectral features
    const spectralFeatures = this.calculateSpectralFeatures(audioChunk.data, audioChunk.sampleRate);
    
    // Use multiple features for VAD decision
    const vadDecisions = spectralFeatures.map(features => {
      const energyScore = features.energy > this.config.threshold ? 1 : 0;
      const spectralScore = features.spectralCentroid > 1000 ? 1 : 0;
      const rolloffScore = features.spectralRolloff > 0.5 ? 1 : 0;
      const zcrScore = features.zeroCrossingRate < 0.3 ? 1 : 0;
      
      return (energyScore + spectralScore + rolloffScore + zcrScore) / 4;
    });
    
    // Convert decisions to segments
    return this.decisionsToSegments(vadDecisions, audioChunk.sampleRate);
  }

  private calculateSpectralFeatures(audioData: Float32Array, sampleRate: number) {
    const windowSize = 1024;
    const hopLength = 512;
    const numWindows = Math.floor((audioData.length - windowSize) / hopLength) + 1;
    
    const features = [];
    
    for (let i = 0; i < numWindows; i++) {
      const startIdx = i * hopLength;
      const window = audioData.slice(startIdx, startIdx + windowSize);
      
      const fft = this.simpleFFT(window);
      const magnitude = fft.map(complex => Math.sqrt(complex.real * complex.real + complex.imag * complex.imag));
      
      features.push({
        energy: this.calculateEnergy(window),
        spectralCentroid: this.calculateSpectralCentroid(magnitude, sampleRate),
        spectralRolloff: this.calculateSpectralRolloff(magnitude),
        zeroCrossingRate: this.calculateZeroCrossingRate(window)
      });
    }
    
    return features;
  }

  private simpleFFT(signal: Float32Array) {
    // Simplified FFT implementation (for real use, consider using a proper FFT library)
    const N = signal.length;
    const result = [];
    
    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      
      result.push({ real, imag });
    }
    
    return result;
  }

  private calculateEnergy(window: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < window.length; i++) {
      energy += window[i] * window[i];
    }
    return Math.sqrt(energy / window.length);
  }

  private calculateSpectralCentroid(magnitude: number[], sampleRate: number): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < magnitude.length; i++) {
      const frequency = (i * sampleRate) / (2 * magnitude.length);
      weightedSum += frequency * magnitude[i];
      magnitudeSum += magnitude[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralRolloff(magnitude: number[]): number {
    const totalEnergy = magnitude.reduce((sum, mag) => sum + mag * mag, 0);
    const threshold = 0.85 * totalEnergy;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < magnitude.length; i++) {
      cumulativeEnergy += magnitude[i] * magnitude[i];
      if (cumulativeEnergy >= threshold) {
        return i / magnitude.length;
      }
    }
    
    return 1;
  }

  private calculateZeroCrossingRate(window: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < window.length; i++) {
      if ((window[i] > 0) !== (window[i - 1] > 0)) {
        crossings++;
      }
    }
    return crossings / (window.length - 1);
  }

  private decisionsToSegments(decisions: number[], sampleRate: number): VADSegment[] {
    const threshold = 0.5;
    const segments: VADSegment[] = [];
    
    let isInSpeech = false;
    let speechStart = 0;
    
    for (let i = 0; i < decisions.length; i++) {
      const timeStamp = (i * this.config.hopLength) / sampleRate;
      const isSpeech = decisions[i] > threshold;
      
      if (isSpeech && !isInSpeech) {
        speechStart = timeStamp;
        isInSpeech = true;
      } else if (!isSpeech && isInSpeech) {
        segments.push({
          start: speechStart,
          end: timeStamp,
          confidence: decisions.slice(
            Math.floor(speechStart * sampleRate / this.config.hopLength),
            i
          ).reduce((sum, val) => sum + val, 0) / (i - Math.floor(speechStart * sampleRate / this.config.hopLength))
        });
        isInSpeech = false;
      }
    }
    
    if (isInSpeech) {
      segments.push({
        start: speechStart,
        end: (decisions.length * this.config.hopLength) / sampleRate,
        confidence: decisions.slice(Math.floor(speechStart * sampleRate / this.config.hopLength))
          .reduce((sum, val) => sum + val, 0) / 
          (decisions.length - Math.floor(speechStart * sampleRate / this.config.hopLength))
      });
    }
    
    return segments;
  }

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.isInitialized = false;
  }
}