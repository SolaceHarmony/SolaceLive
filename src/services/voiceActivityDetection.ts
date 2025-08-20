export class VoiceActivityDetection {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isListening: boolean = false;
  private vadThreshold: number = 0.01;
  private silenceThreshold: number = 0.005;
  private speechBuffer: Float32Array[] = [];
  private silenceCount: number = 0;
  private speechCount: number = 0;
  private minSpeechFrames: number = 3;
  private minSilenceFrames: number = 10;
  private animationFrameId: number | null = null;

  constructor(threshold: number = 0.01, silenceThreshold: number = 0.005) {
    this.vadThreshold = threshold;
    this.silenceThreshold = silenceThreshold;
  }

  async initialize(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.mediaStream = stream;
      
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = 512;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.analyser.smoothingTimeConstant = 0.85;
      
      source.connect(this.analyser);
      
      console.log('VAD initialized successfully');
    } catch (error) {
      console.error('Failed to initialize VAD:', error);
      throw error;
    }
  }

  startVAD(
    onSpeechStart: () => void,
    onSpeechEnd: () => void,
    onVoiceActivity: (level: number) => void
  ): void {
    if (!this.analyser) {
      throw new Error('VAD not initialized');
    }

    this.isListening = true;
    this.speechBuffer = [];
    this.silenceCount = 0;
    this.speechCount = 0;

    const processAudio = () => {
      if (!this.isListening || !this.analyser) {
        return;
      }

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);

      // Calculate RMS (Root Mean Square) for voice activity level
      const rms = this.calculateRMS(dataArray);
      onVoiceActivity(rms);

      // Voice Activity Detection logic
      const isSpeech = rms > this.vadThreshold;
      const isSilence = rms < this.silenceThreshold;

      if (isSpeech) {
        this.speechCount++;
        this.silenceCount = 0;
        
        if (this.speechCount >= this.minSpeechFrames && this.speechBuffer.length === 0) {
          // Speech started
          onSpeechStart();
          console.log('Speech detected, RMS:', rms);
        }
        
        // Store speech data
        const speechData = new Float32Array(bufferLength);
        for (let i = 0; i < bufferLength; i++) {
          speechData[i] = (dataArray[i] - 128) / 128.0; // Normalize to -1 to 1
        }
        this.speechBuffer.push(speechData);
      } else if (isSilence) {
        this.silenceCount++;
        this.speechCount = 0;
        
        if (this.silenceCount >= this.minSilenceFrames && this.speechBuffer.length > 0) {
          // Speech ended
          onSpeechEnd();
          console.log('Silence detected, speech ended. Buffer length:', this.speechBuffer.length);
          this.speechBuffer = [];
        }
      }

      this.animationFrameId = requestAnimationFrame(processAudio);
    };

    processAudio();
  }

  stopVAD(): void {
    this.isListening = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.speechBuffer = [];
    this.silenceCount = 0;
    this.speechCount = 0;
  }

  private calculateRMS(dataArray: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalizedValue = (dataArray[i] - 128) / 128.0;
      sum += normalizedValue * normalizedValue;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  getSpeechBuffer(): Float32Array[] {
    return [...this.speechBuffer];
  }

  clearSpeechBuffer(): void {
    this.speechBuffer = [];
  }

  setThresholds(vadThreshold: number, silenceThreshold: number): void {
    this.vadThreshold = vadThreshold;
    this.silenceThreshold = silenceThreshold;
  }

  getThresholds(): { vadThreshold: number; silenceThreshold: number } {
    return {
      vadThreshold: this.vadThreshold,
      silenceThreshold: this.silenceThreshold
    };
  }

  getCurrentAudioLevel(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    return this.calculateRMS(dataArray);
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  dispose(): void {
    this.stopVAD();
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
  }

  // Advanced VAD with machine learning-like features
  getAdvancedVADFeatures(dataArray: Uint8Array): {
    spectralCentroid: number;
    spectralRolloff: number;
    zeroCrossingRate: number;
    mfcc: number[];
  } {
    const spectralCentroid = this.calculateSpectralCentroid(dataArray);
    const spectralRolloff = this.calculateSpectralRolloff(dataArray);
    const zeroCrossingRate = this.calculateZeroCrossingRate(dataArray);
    const mfcc = this.calculateMFCC(dataArray);
    
    return {
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate,
      mfcc
    };
  }

  private calculateSpectralCentroid(dataArray: Uint8Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const magnitude = dataArray[i];
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralRolloff(dataArray: Uint8Array): number {
    const totalEnergy = dataArray.reduce((sum, val) => sum + val * val, 0);
    const threshold = 0.85 * totalEnergy;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < dataArray.length; i++) {
      cumulativeEnergy += dataArray[i] * dataArray[i];
      if (cumulativeEnergy >= threshold) {
        return i / dataArray.length;
      }
    }
    
    return 1;
  }

  private calculateZeroCrossingRate(dataArray: Uint8Array): number {
    let crossings = 0;
    for (let i = 1; i < dataArray.length; i++) {
      if ((dataArray[i] > 128) !== (dataArray[i-1] > 128)) {
        crossings++;
      }
    }
    return crossings / (dataArray.length - 1);
  }

  private calculateMFCC(dataArray: Uint8Array): number[] {
    // Simplified MFCC calculation - in practice you'd use a proper MFCC library
    const mfccCoeffs: number[] = [];
    const numCoeffs = 13;
    
    for (let i = 0; i < numCoeffs; i++) {
      let coeff = 0;
      for (let j = 0; j < dataArray.length; j++) {
        coeff += dataArray[j] * Math.cos(Math.PI * i * (j + 0.5) / dataArray.length);
      }
      mfccCoeffs.push(coeff / dataArray.length);
    }
    
    return mfccCoeffs;
  }
}