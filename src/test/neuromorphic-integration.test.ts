/**
 * Integration test for neuromorphic consciousness components
 * 
 * Tests the integration between:
 * - ConsciousnessOrchestrator 
 * - PerformanceOptimizer
 * - MoshiModelBridge
 * - Neural packet flow
 */

import { ConsciousnessOrchestrator } from '../lib/moshi-neuromorphic/ConsciousnessOrchestrator';
import { MoshiModelBridge } from '../lib/moshi-neuromorphic/MoshiModelBridge';
import { performanceOptimizer } from '../lib/moshi-neuromorphic/PerformanceOptimizer';
import { NeuralPacket, PacketType } from '../experiments/neuromorphic-research/neural-packet-types';

describe('Neuromorphic Integration Tests', () => {
  let orchestrator: ConsciousnessOrchestrator;
  let bridge: MoshiModelBridge;

  beforeEach(() => {
    // Reset performance optimizer
    performanceOptimizer.reset();
    
    // Create fresh instances
    orchestrator = new ConsciousnessOrchestrator();
    bridge = new MoshiModelBridge({
      sampleRate: 24000,
      frameSize: 1920,
      temperature: 0.8
    });
  });

  afterEach(() => {
    if (orchestrator) {
      orchestrator.reset();
    }
    if (bridge) {
      bridge.reset();
    }
  });

  test('consciousness orchestrator processes neural packets', async () => {
    // Create test neural packets
    const testPackets: NeuralPacket[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-packet-${i}`,
      type: PacketType.AUDIO_PCM,
      timestamp: BigInt(Date.now() * 1000 + i * 1000),
      sourceAS: { id: 'test-source', type: 'audio' },
      destinationAS: { id: 'consciousness', type: 'processing' },
      frequency: 40 + Math.random() * 20, // 40-60 Hz
      amplitude: 0.5 + Math.random() * 0.5,
      phase: Math.random() * 2 * Math.PI,
      payload: {
        audioData: new Float32Array(320).fill(0.1),
        sampleRate: 24000
      },
      qos: {
        dscp: 46,
        latency: 100,
        bandwidth: 64000,
        priority: 7
      },
      metadata: {}
    }));

    // Inject packets into orchestrator
    orchestrator.injectPackets('test-stream', testPackets);

    // Wait for processing cycle
    await new Promise(resolve => setTimeout(resolve, 150));

    // Check consciousness state
    const state = orchestrator.getState();
    expect(state.arousal).toBeGreaterThan(0);
    expect(state.confidence).toBeGreaterThan(0);

    // Check metrics
    const metrics = orchestrator.getMetrics();
    expect(metrics.packetsProcessed).toBeGreaterThan(0);

    console.log('✅ Consciousness orchestrator processing test passed');
    console.log(`State: arousal=${state.arousal.toFixed(3)}, confidence=${state.confidence.toFixed(3)}`);
    console.log(`Metrics: processed=${metrics.packetsProcessed}, thoughts=${metrics.thoughtsRaced}`);
  });

  test('performance optimizer tracks consciousness cycles', async () => {
    // Start timing simulation
    performanceOptimizer.startTiming('consciousness-cycle');
    
    // Simulate processing work
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const cycleTime = performanceOptimizer.endTiming('consciousness-cycle');
    performanceOptimizer.recordConsciousnessCycle(cycleTime);

    // Generate performance profile
    const profile = performanceOptimizer.generateProfile({
      packetsProcessed: 10,
      thoughtsRaced: 5,
      attentionShifts: 2,
      gammaBindingEvents: 3,
      hebbianUpdates: 4,
      averageLatency: cycleTime
    });

    expect(profile.avgConsciousnessCycleTime).toBeGreaterThan(0);
    expect(profile.consciousnessCyclesPerSecond).toBeGreaterThan(0);
    expect(profile.bottlenecks).toBeDefined();
    expect(profile.recommendations).toBeDefined();

    console.log('✅ Performance optimizer tracking test passed');
    console.log(`Cycle time: ${profile.avgConsciousnessCycleTime.toFixed(2)}ms`);
    console.log(`Recommendations: ${profile.recommendations.length}`);
  });

  test('moshi bridge initializes with mock transformers', async () => {
    // Test initialization
    await bridge.initialize();

    // Test audio processing with mock data
    const testAudio = new Float32Array(1920).map(() => Math.random() * 0.1);
    
    const result = await bridge.processRealAudio(testAudio);

    expect(result).toBeDefined();
    expect(result.audioTokens).toBeDefined();
    expect(result.processingTime).toBeGreaterThan(0);

    // Check consciousness state integration
    const state = bridge.getConsciousnessState();
    expect(state).toBeDefined();

    console.log('✅ Moshi bridge integration test passed');
    console.log(`Processing time: ${result.processingTime.toFixed(2)}ms`);
    console.log(`Audio tokens: ${result.audioTokens.length}, Text tokens: ${result.textTokens.length}`);
  });

  test('end-to-end packet flow through consciousness pipeline', async () => {
    // Initialize bridge
    await bridge.initialize();

    // Create realistic audio frame
    const audioFrame = new Float32Array(1920);
    for (let i = 0; i < audioFrame.length; i++) {
      // Generate test sine wave
      audioFrame[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / 24000);
    }

    // Process through bridge (includes neuromorphic layer)
    const startTime = performance.now();
    const result = await bridge.processRealAudio(audioFrame);
    const totalTime = performance.now() - startTime;

    // Verify results
    expect(result.processingTime).toBeLessThan(200); // Real-time constraint
    expect(totalTime).toBeLessThan(300); // Total pipeline constraint

    // Check consciousness state after processing
    const finalState = bridge.getConsciousnessState();
    expect(finalState.arousal).toBeGreaterThan(0);

    // Check performance metrics
    const finalMetrics = bridge.getProcessingMetrics();
    expect(finalMetrics.packetsProcessed).toBeGreaterThan(0);

    console.log('✅ End-to-end packet flow test passed');
    console.log(`Total pipeline time: ${totalTime.toFixed(2)}ms`);
    console.log(`Bridge processing: ${result.processingTime.toFixed(2)}ms`);
    console.log(`Final arousal: ${finalState.arousal.toFixed(3)}`);
  });

  test('performance optimization recommendations', async () => {
    // Simulate various processing times
    const operations = ['consciousness-cycle', 'thought-race', 'gamma-binding'];
    
    for (const op of operations) {
      performanceOptimizer.startTiming(op);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10));
      performanceOptimizer.endTiming(op);
    }

    // Generate profile with recommendations
    const profile = performanceOptimizer.generateProfile({
      packetsProcessed: 100,
      thoughtsRaced: 50,
      attentionShifts: 20,
      gammaBindingEvents: 30,
      hebbianUpdates: 40,
      averageLatency: 25
    });

    expect(profile.recommendations.length).toBeGreaterThan(0);
    expect(profile.bottlenecks.length).toBeGreaterThan(0);

    // Test auto-optimization
    const optimizationResult = performanceOptimizer.autoOptimize(profile);
    expect(optimizationResult.applied).toBeDefined();
    expect(optimizationResult.failed).toBeDefined();

    console.log('✅ Performance optimization test passed');
    console.log(`Bottlenecks found: ${profile.bottlenecks.length}`);
    console.log(`Recommendations: ${profile.recommendations.length}`);
    console.log(`Auto-applied optimizations: ${optimizationResult.applied.length}`);
  });
});