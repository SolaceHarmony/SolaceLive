/**
 * Packet Flow Test Harness
 * 
 * Tests the complete Moshi → Neuromorphic pipeline with sample audio data
 * and monitors consciousness state changes in real-time.
 */

import { MoshiKernel } from '../MoshiKernel';
import { ConsciousnessOrchestrator, ConsciousnessState, ProcessingMetrics } from '../ConsciousnessOrchestrator';

export interface TestConfig {
  sampleRate: number;           // 24000 Hz (Mimi rate)
  testDuration: number;         // seconds
  frameSize: number;            // samples per frame (1920 for 80ms at 24kHz)
  logInterval: number;          // ms between status logs
  audioType: 'sine' | 'noise' | 'chirp' | 'speech';
}

export interface TestResults {
  totalFrames: number;
  avgProcessingTime: number;
  consciousnessStates: ConsciousnessState[];
  finalMetrics: ProcessingMetrics;
  packetFlowRates: number[];
  attentionShifts: { timestamp: number; focus: string | null }[];
}

export class PacketFlowTest {
  private kernel: MoshiKernel;
  private config: TestConfig;
  private results: TestResults;
  private startTime: number = 0;
  
  constructor(config?: Partial<TestConfig>) {
    this.config = {
      sampleRate: 24000,
      testDuration: 5, // 5 seconds
      frameSize: 1920, // 80ms at 24kHz
      logInterval: 1000, // 1 second
      audioType: 'sine',
      ...config
    };
    
    this.kernel = new MoshiKernel();
    this.results = {
      totalFrames: 0,
      avgProcessingTime: 0,
      consciousnessStates: [],
      finalMetrics: {
        packetsProcessed: 0,
        thoughtsRaced: 0,
        attentionShifts: 0,
        gammaBindingEvents: 0,
        hebbianUpdates: 0,
        averageLatency: 0
      },
      packetFlowRates: [],
      attentionShifts: []
    };
  }
  
  /**
   * Run the complete packet flow test
   */
  public async runTest(): Promise<TestResults> {
    console.log('🧠 Starting Packet Flow Test...');
    console.log(`   Audio Type: ${this.config.audioType}`);
    console.log(`   Duration: ${this.config.testDuration}s`);
    console.log(`   Frame Size: ${this.config.frameSize} samples (${this.config.frameSize / this.config.sampleRate * 1000}ms)`);
    
    this.startTime = Date.now();
    
    // Generate test audio data
    const audioData = this.generateTestAudio();
    console.log(`   Generated ${audioData.length} samples`);
    
    // Process audio in Mimi-sized frames
    const frameCount = Math.floor(audioData.length / this.config.frameSize);
    const processingTimes: number[] = [];
    
    // Start monitoring consciousness state
    const stateMonitor = this.startStateMonitoring();
    
    for (let i = 0; i < frameCount; i++) {
      const frameStart = i * this.config.frameSize;
      const frameEnd = frameStart + this.config.frameSize;
      const frame = audioData.slice(frameStart, frameEnd);
      
      // Measure processing time
      const processStart = performance.now();
      await this.kernel.processMimiFrame(frame);
      const processTime = performance.now() - processStart;
      
      processingTimes.push(processTime);
      
      // Log progress periodically
      if (i % Math.floor(frameCount / 10) === 0) {
        console.log(`   Processed frame ${i}/${frameCount} (${Math.round(i/frameCount*100)}%)`);
      }
      
      // Simulate real-time processing delay
      await this.sleep(80); // 80ms Mimi frame period
    }
    
    // Stop monitoring
    clearInterval(stateMonitor);
    
    // Calculate results
    this.results.totalFrames = frameCount;
    this.results.avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    
    // Get final metrics from consciousness orchestrator
    this.results.finalMetrics = this.getConsciousnessMetrics();
    
    console.log('✅ Packet Flow Test Complete!');
    this.printResults();
    
    return this.results;
  }
  
  /**
   * Generate test audio data based on config
   */
  private generateTestAudio(): Float32Array {
    const totalSamples = this.config.sampleRate * this.config.testDuration;
    const audio = new Float32Array(totalSamples);
    
    switch (this.config.audioType) {
      case 'sine':
        // 440Hz sine wave (A4 note)
        for (let i = 0; i < totalSamples; i++) {
          audio[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / this.config.sampleRate);
        }
        break;
        
      case 'noise':
        // White noise
        for (let i = 0; i < totalSamples; i++) {
          audio[i] = (Math.random() - 0.5) * 0.5;
        }
        break;
        
      case 'chirp':
        // Frequency sweep from 200Hz to 2000Hz
        for (let i = 0; i < totalSamples; i++) {
          const t = i / this.config.sampleRate;
          const freq = 200 + (2000 - 200) * t / this.config.testDuration;
          audio[i] = 0.5 * Math.sin(2 * Math.PI * freq * t);
        }
        break;
        
      case 'speech':
        // Simulate speech-like formants
        for (let i = 0; i < totalSamples; i++) {
          const t = i / this.config.sampleRate;
          // Fundamental + formants
          const f0 = 150; // Fundamental frequency
          const f1 = 800; // First formant
          const f2 = 1200; // Second formant
          
          audio[i] = 0.3 * (
            Math.sin(2 * Math.PI * f0 * t) +
            0.5 * Math.sin(2 * Math.PI * f1 * t) +
            0.3 * Math.sin(2 * Math.PI * f2 * t)
          );
        }
        break;
    }
    
    return audio;
  }
  
  /**
   * Start monitoring consciousness state changes
   */
  private startStateMonitoring(): NodeJS.Timeout {
    return setInterval(() => {
      const state = this.getConsciousnessState();
      const metrics = this.getConsciousnessMetrics();
      
      // Record state snapshot
      this.results.consciousnessStates.push({
        ...state,
        timestamp: Date.now() - this.startTime
      } as any);
      
      // Track attention shifts
      if (this.results.consciousnessStates.length > 1) {
        const prevState = this.results.consciousnessStates[this.results.consciousnessStates.length - 2];
        if (state.focus !== prevState.focus) {
          this.results.attentionShifts.push({
            timestamp: Date.now() - this.startTime,
            focus: state.focus
          });
        }
      }
      
      // Calculate packet flow rate
      const packetsPerSecond = metrics.packetsProcessed / ((Date.now() - this.startTime) / 1000);
      this.results.packetFlowRates.push(packetsPerSecond);
      
      // Log current state
      console.log(`📊 Consciousness State: arousal=${state.arousal.toFixed(2)}, confidence=${state.confidence.toFixed(2)}, focus=${state.focus}`);
      console.log(`📈 Metrics: ${metrics.packetsProcessed} packets, ${metrics.thoughtsRaced} races, ${metrics.attentionShifts} shifts`);
      
    }, this.config.logInterval);
  }
  
  /**
   * Get current consciousness state from the kernel
   */
  private getConsciousnessState(): ConsciousnessState {
    return this.kernel.getConsciousnessState();
  }
  
  /**
   * Get consciousness processing metrics from the kernel
   */
  private getConsciousnessMetrics(): ProcessingMetrics {
    return this.kernel.getProcessingMetrics();
  }
  
  /**
   * Print test results summary
   */
  private printResults(): void {
    console.log('\n🎯 Test Results Summary:');
    console.log(`   Frames Processed: ${this.results.totalFrames}`);
    console.log(`   Avg Processing Time: ${this.results.avgProcessingTime.toFixed(2)}ms per frame`);
    console.log(`   Total Packets: ${this.results.finalMetrics.packetsProcessed}`);
    console.log(`   Thoughts Raced: ${this.results.finalMetrics.thoughtsRaced}`);
    console.log(`   Attention Shifts: ${this.results.finalMetrics.attentionShifts}`);
    console.log(`   Gamma Binding Events: ${this.results.finalMetrics.gammaBindingEvents}`);
    console.log(`   Hebbian Updates: ${this.results.finalMetrics.hebbianUpdates}`);
    console.log(`   Avg Packet Rate: ${(this.results.packetFlowRates.reduce((a, b) => a + b, 0) / this.results.packetFlowRates.length).toFixed(1)} packets/sec`);
    
    if (this.results.attentionShifts.length > 0) {
      console.log(`   Attention Timeline:`);
      this.results.attentionShifts.forEach(shift => {
        console.log(`     ${shift.timestamp}ms: → ${shift.focus}`);
      });
    }
  }
  
  /**
   * Sleep utility for simulating real-time processing
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export test runner for easy usage
export async function runPacketFlowTest(config?: Partial<TestConfig>): Promise<TestResults> {
  const test = new PacketFlowTest(config);
  return await test.runTest();
}

// Quick test configurations
export const TestPresets = {
  QUICK: { testDuration: 2, audioType: 'sine' as const },
  SPEECH: { testDuration: 5, audioType: 'speech' as const },
  SWEEP: { testDuration: 3, audioType: 'chirp' as const },
  NOISE: { testDuration: 4, audioType: 'noise' as const }
};