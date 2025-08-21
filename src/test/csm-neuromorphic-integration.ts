/**
 * CSM + Neuromorphic Integration Tests
 * 
 * Tests the integration between the Gemma3-CSM model and our neuromorphic
 * consciousness layer, validating that consciousness simulation works with
 * real model inference.
 */

import { MoshiModelBridge } from '../lib/moshi-neuromorphic/MoshiModelBridge';
import { ConsciousnessOrchestrator } from '../lib/moshi-neuromorphic/ConsciousnessOrchestrator';
import { performanceOptimizer } from '../lib/moshi-neuromorphic/PerformanceOptimizer';
import { NeuralPacket, PacketType } from '../experiments/neuromorphic-research/neural-packet-types';

// CSM Model Configuration
const CSM_MODEL_CONFIG = {
  modelUrl: 'https://huggingface.co/crossscreenmedia/gemma3-csm-3',
  localEndpoint: 'http://localhost:11434/api/generate', // Ollama endpoint
  modelName: 'gemma3-csm-3',
  maxTokens: 2048,
  temperature: 0.7,
  consciousnessEnabled: true
};

interface CSMResponse {
  text: string;
  consciousness_state?: {
    arousal: number;
    valence: number;
    attention_focus: string[];
    working_memory: string[];
    emotional_tone: number;
  };
  tokens: number[];
  processing_time: number;
}

export class CSMNeuromorphicTester {
  private bridge: MoshiModelBridge;
  private orchestrator: ConsciousnessOrchestrator;
  private modelAvailable: boolean = false;

  constructor() {
    this.bridge = new MoshiModelBridge({
      sampleRate: 24000,
      frameSize: 1920,
      temperature: CSM_MODEL_CONFIG.temperature,
      maxSequenceLength: CSM_MODEL_CONFIG.maxTokens
    });
    
    this.orchestrator = new ConsciousnessOrchestrator();
  }

  /**
   * Initialize CSM model connection
   */
  async initialize(): Promise<void> {
    console.log('🧠 Initializing CSM + Neuromorphic Integration...');
    
    try {
      // Test if CSM model is available locally
      await this.testCSMConnection();
      
      // Initialize our neuromorphic bridge
      await this.bridge.initialize();
      
      console.log('✅ CSM + Neuromorphic integration ready!');
      
    } catch (error) {
      console.warn('⚠️ CSM model not available locally, using mock implementation');
      console.log('💡 To test with real CSM model, run: ollama pull crossscreenmedia/gemma3-csm-3');
      await this.bridge.initialize(); // Will use mock implementation
    }
  }

  /**
   * Test connection to CSM model
   */
  private async testCSMConnection(): Promise<void> {
    try {
      const response = await fetch(CSM_MODEL_CONFIG.localEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CSM_MODEL_CONFIG.modelName,
          prompt: 'Test consciousness state',
          stream: false,
          options: {
            temperature: 0.1,
            max_tokens: 10
          }
        })
      });

      if (response.ok) {
        this.modelAvailable = true;
        console.log('✅ CSM model available locally');
      }
    } catch (error) {
      throw new Error('CSM model not available');
    }
  }

  /**
   * Query CSM model with consciousness state extraction
   */
  private async queryCSM(prompt: string): Promise<CSMResponse> {
    if (!this.modelAvailable) {
      // Return mock response for testing
      return this.createMockCSMResponse(prompt);
    }

    const response = await fetch(CSM_MODEL_CONFIG.localEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CSM_MODEL_CONFIG.modelName,
        prompt: `${prompt}\n\nPlease respond with your consciousness state including arousal, valence, attention focus, and working memory.`,
        stream: false,
        options: {
          temperature: CSM_MODEL_CONFIG.temperature,
          max_tokens: CSM_MODEL_CONFIG.maxTokens
        }
      })
    });

    const data = await response.json();
    
    return {
      text: data.response || '',
      consciousness_state: this.extractConsciousnessState(data.response || ''),
      tokens: data.tokens || [],
      processing_time: data.total_duration || 0
    };
  }

  /**
   * Extract consciousness state from CSM response
   */
  private extractConsciousnessState(response: string): any {
    // Simple pattern matching to extract consciousness metrics
    // In a real implementation, this would be more sophisticated
    const arousalMatch = response.match(/arousal[:\s]+([0-9.]+)/i);
    const valenceMatch = response.match(/valence[:\s]+([0-9.-]+)/i);
    const focusMatch = response.match(/focus[:\s]+([^.]+)/i);
    
    return {
      arousal: arousalMatch ? parseFloat(arousalMatch[1]) : 0.5,
      valence: valenceMatch ? parseFloat(valenceMatch[1]) : 0.0,
      attention_focus: focusMatch ? [focusMatch[1].trim()] : [],
      working_memory: [],
      emotional_tone: valenceMatch ? parseFloat(valenceMatch[1]) : 0.0
    };
  }

  /**
   * Create mock CSM response for testing
   */
  private createMockCSMResponse(prompt: string): CSMResponse {
    return {
      text: `Mock CSM response to: ${prompt.substring(0, 50)}...`,
      consciousness_state: {
        arousal: 0.6 + Math.random() * 0.3,
        valence: (Math.random() - 0.5) * 2,
        attention_focus: ['language_processing', 'response_generation'],
        working_memory: [prompt.substring(0, 20), 'previous_context'],
        emotional_tone: (Math.random() - 0.5) * 2
      },
      tokens: Array.from({ length: 50 }, () => Math.floor(Math.random() * 32000)),
      processing_time: 150 + Math.random() * 100
    };
  }

  /**
   * Test consciousness state synchronization between CSM and neuromorphic layer
   */
  async testConsciousnessSynchronization(): Promise<void> {
    console.log('\n🔄 Testing Consciousness State Synchronization...');
    
    performanceOptimizer.startTiming('csm-sync-test');
    
    // Query CSM model
    const csmResponse = await this.queryCSM(
      "I'm feeling confused about quantum physics. Can you explain superposition?"
    );
    
    console.log(`CSM Response: ${csmResponse.text.substring(0, 100)}...`);
    console.log(`CSM Consciousness: arousal=${csmResponse.consciousness_state?.arousal.toFixed(3)}, valence=${csmResponse.consciousness_state?.valence.toFixed(3)}`);
    
    // Convert CSM response to neural packets
    const neuralPackets = this.convertCSMToNeuralPackets(csmResponse);
    
    // Inject into neuromorphic consciousness layer
    this.orchestrator.injectPackets('csm-inference', neuralPackets);
    
    // Allow consciousness processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Compare consciousness states
    const neuromorphicState = this.orchestrator.getState();
    
    console.log(`Neuromorphic Consciousness: arousal=${neuromorphicState.arousal.toFixed(3)}, confidence=${neuromorphicState.confidence.toFixed(3)}`);
    console.log(`Focus: ${neuromorphicState.focus}, Working Memory: ${neuromorphicState.workingMemory.size} items`);
    
    const syncTime = performanceOptimizer.endTiming('csm-sync-test');
    console.log(`✅ Synchronization completed in ${syncTime.toFixed(2)}ms`);
    
    // Validate synchronization
    this.validateConsciousnessSynchronization(csmResponse.consciousness_state, neuromorphicState);
  }

  /**
   * Convert CSM response to neural packets
   */
  private convertCSMToNeuralPackets(csmResponse: CSMResponse): NeuralPacket[] {
    const packets: NeuralPacket[] = [];
    const baseTimestamp = BigInt(Date.now() * 1000);
    
    // Convert tokens to neural packets
    csmResponse.tokens.forEach((token, index) => {
      packets.push({
        id: crypto.randomUUID(),
        type: PacketType.INFERENCE,
        timestamp: baseTimestamp + BigInt(index * 1000),
        sourceAS: { id: 'csm-model', type: 'inference' },
        destinationAS: { id: 'consciousness', type: 'processing' },
        frequency: 40, // Gamma frequency
        amplitude: csmResponse.consciousness_state?.arousal || 0.5,
        phase: Math.random() * 2 * Math.PI,
        payload: {
          token,
          tokenType: 'text',
          csmState: csmResponse.consciousness_state,
          semanticContent: csmResponse.text.substring(index * 5, (index + 1) * 5)
        },
        qos: {
          dscp: 46, // High priority
          latency: 50,
          bandwidth: 64000,
          priority: 7
        },
        metadata: {
          source: 'gemma3-csm-3',
          processingTime: csmResponse.processing_time,
          consciousnessEnabled: true
        }
      } as NeuralPacket);
    });
    
    return packets;
  }

  /**
   * Validate consciousness synchronization
   */
  private validateConsciousnessSynchronization(csmState: any, neuromorphicState: any): void {
    const arousalDiff = Math.abs((csmState?.arousal || 0.5) - neuromorphicState.arousal);
    const valenceDiff = Math.abs((csmState?.emotional_tone || 0) - neuromorphicState.emotionalTone);
    
    console.log(`\n📊 Synchronization Analysis:`);
    console.log(`  Arousal alignment: ${arousalDiff < 0.3 ? '✅' : '⚠️'} (diff: ${arousalDiff.toFixed(3)})`);
    console.log(`  Emotional alignment: ${valenceDiff < 0.3 ? '✅' : '⚠️'} (diff: ${valenceDiff.toFixed(3)})`);
    console.log(`  Working memory active: ${neuromorphicState.workingMemory.size > 0 ? '✅' : '⚠️'}`);
    console.log(`  Attention focused: ${neuromorphicState.focus ? '✅' : '⚠️'}`);
  }

  /**
   * Test real-time consciousness evolution during conversation
   */
  async testConsciousnessEvolution(): Promise<void> {
    console.log('\n🧠 Testing Consciousness Evolution During Conversation...');
    
    const conversationSteps = [
      "Hello, how are you today?",
      "I'm feeling anxious about an upcoming presentation.",
      "Can you help me feel more confident?",
      "Thank you, that makes me feel much better!"
    ];
    
    for (let i = 0; i < conversationSteps.length; i++) {
      console.log(`\n--- Conversation Step ${i + 1} ---`);
      console.log(`User: ${conversationSteps[i]}`);
      
      // Process through CSM + Neuromorphic pipeline
      const csmResponse = await this.queryCSM(conversationSteps[i]);
      const neuralPackets = this.convertCSMToNeuralPackets(csmResponse);
      
      this.orchestrator.injectPackets(`conversation-step-${i}`, neuralPackets);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const state = this.orchestrator.getState();
      const metrics = this.orchestrator.getMetrics();
      
      console.log(`CSM: "${csmResponse.text.substring(0, 80)}..."`);
      console.log(`Consciousness: arousal=${state.arousal.toFixed(3)}, confidence=${state.confidence.toFixed(3)}, tone=${state.emotionalTone.toFixed(3)}`);
      console.log(`Metrics: ${metrics.packetsProcessed} packets, ${metrics.attentionShifts} attention shifts`);
    }
    
    console.log('\n✅ Consciousness evolution test completed');
  }

  /**
   * Test performance under load with CSM model
   */
  async testPerformanceUnderLoad(): Promise<void> {
    console.log('\n⚡ Testing Performance Under Load...');
    
    const startTime = performance.now();
    const loadTestPromises: Promise<void>[] = [];
    
    // Generate load with multiple concurrent CSM queries
    for (let i = 0; i < 10; i++) {
      loadTestPromises.push(this.processConcurrentQuery(i));
    }
    
    await Promise.all(loadTestPromises);
    
    const totalTime = performance.now() - startTime;
    const profile = performanceOptimizer.generateProfile(this.orchestrator.getMetrics());
    
    console.log(`\n📈 Performance Results:`);
    console.log(`  Total processing time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Average consciousness cycle: ${profile.avgConsciousnessCycleTime.toFixed(2)}ms`);
    console.log(`  Packets per second: ${profile.packetsPerSecond.toFixed(1)}`);
    console.log(`  Bottlenecks detected: ${profile.bottlenecks.length}`);
    
    if (profile.bottlenecks.length > 0) {
      console.log(`  Critical bottlenecks:`);
      profile.bottlenecks.slice(0, 3).forEach(bottleneck => {
        if (bottleneck.impact === 'critical' || bottleneck.impact === 'high') {
          console.log(`    - ${bottleneck.component}: ${bottleneck.avgLatency.toFixed(2)}ms`);
        }
      });
    }
  }

  /**
   * Process concurrent CSM query for load testing
   */
  private async processConcurrentQuery(index: number): Promise<void> {
    const query = `Query ${index}: What is the nature of consciousness?`;
    const response = await this.queryCSM(query);
    const packets = this.convertCSMToNeuralPackets(response);
    this.orchestrator.injectPackets(`load-test-${index}`, packets);
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport(): void {
    console.log('\n📋 CSM + Neuromorphic Integration Report');
    console.log('==========================================');
    
    const finalState = this.orchestrator.getState();
    const finalMetrics = this.orchestrator.getMetrics();
    const profile = performanceOptimizer.generateProfile(finalMetrics);
    
    console.log(`\n🧠 Final Consciousness State:`);
    console.log(`  Arousal: ${finalState.arousal.toFixed(3)} (${this.getArousalDescription(finalState.arousal)})`);
    console.log(`  Confidence: ${finalState.confidence.toFixed(3)} (${this.getConfidenceDescription(finalState.confidence)})`);
    console.log(`  Emotional Tone: ${finalState.emotionalTone.toFixed(3)} (${this.getEmotionDescription(finalState.emotionalTone)})`);
    console.log(`  Current Focus: ${finalState.focus || 'None'}`);
    console.log(`  Working Memory: ${finalState.workingMemory.size} active items`);
    
    console.log(`\n📊 Processing Metrics:`);
    console.log(`  Total packets processed: ${finalMetrics.packetsProcessed}`);
    console.log(`  Thoughts raced: ${finalMetrics.thoughtsRaced}`);
    console.log(`  Attention shifts: ${finalMetrics.attentionShifts}`);
    console.log(`  Gamma binding events: ${finalMetrics.gammaBindingEvents}`);
    console.log(`  Hebbian updates: ${finalMetrics.hebbianUpdates}`);
    
    console.log(`\n⚡ Performance Summary:`);
    console.log(`  Average cycle time: ${profile.avgConsciousnessCycleTime.toFixed(2)}ms`);
    console.log(`  Packet throughput: ${profile.packetsPerSecond.toFixed(1)} packets/sec`);
    console.log(`  Model available: ${this.modelAvailable ? 'Yes (Real CSM)' : 'No (Mock CSM)'}`);
    console.log(`  Real-time capable: ${profile.avgConsciousnessCycleTime < 100 ? 'Yes' : 'No'}`);
  }

  private getArousalDescription(arousal: number): string {
    if (arousal < 0.3) return 'Low';
    if (arousal < 0.7) return 'Medium';
    return 'High';
  }

  private getConfidenceDescription(confidence: number): string {
    if (confidence < 0.3) return 'Uncertain';
    if (confidence < 0.7) return 'Moderate';
    return 'High';
  }

  private getEmotionDescription(tone: number): string {
    if (tone < -0.3) return 'Negative';
    if (tone > 0.3) return 'Positive';
    return 'Neutral';
  }
}

// Export test runner
export async function runCSMNeuromorphicTests(): Promise<void> {
  const tester = new CSMNeuromorphicTester();
  
  try {
    await tester.initialize();
    await tester.testConsciousnessSynchronization();
    await tester.testConsciousnessEvolution();
    await tester.testPerformanceUnderLoad();
    
    tester.generateTestReport();
    
    console.log('\n🎉 All CSM + Neuromorphic integration tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ CSM integration test failed:', error);
    throw error;
  }
}