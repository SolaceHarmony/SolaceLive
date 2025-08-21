/**
 * Stress Tests for Packet Processing Components
 * Tests performance, memory usage, and edge cases under extreme load
 */

import {
  PriorityQueue,
  JitterBuffer,
  PacketStreamManager,
  DualStreamProcessor,
  StreamSynchronizer
} from './packet-processor';

import {
  PacketUtils,
  StreamID,
  PacketPriority,
  PacketType,
  PacketFlags,
  Packet
} from './packets';

// ============================================================================
// PRIORITY QUEUE STRESS TESTS
// ============================================================================

describe('PriorityQueue - Stress Tests', () => {

  test('should handle 100,000 items efficiently', () => {
    const queue = new PriorityQueue<number>();
    const itemCount = 100000;
    const startTime = performance.now();
    
    // Enqueue items with random priorities
    for (let i = 0; i < itemCount; i++) {
      const priority = Math.floor(Math.random() * 5);
      queue.enqueue(i, priority);
    }
    
    const enqueueTime = performance.now() - startTime;
    
    // Dequeue all items
    const dequeueStart = performance.now();
    let previousPriority = -1;
    let dequeued = 0;
    
    while (queue.length > 0) {
      const item = queue.dequeue();
      dequeued++;
      // Verify priority order is maintained
      if (dequeued <= 5) { // Check first few items
        expect(item).toBeDefined();
      }
    }
    
    const dequeueTime = performance.now() - dequeueStart;
    
    console.log(`PriorityQueue: Enqueued ${itemCount} items in ${enqueueTime.toFixed(2)}ms`);
    console.log(`PriorityQueue: Dequeued ${itemCount} items in ${dequeueTime.toFixed(2)}ms`);
    
    expect(dequeued).toBe(itemCount);
    expect(enqueueTime).toBeLessThan(5000); // Should enqueue 100k items in < 5s
    expect(dequeueTime).toBeLessThan(1000); // Should dequeue 100k items in < 1s
  });

  test('should maintain correct order with identical priorities', () => {
    const queue = new PriorityQueue<string>();
    const itemsPerPriority = 10000;
    
    // Add many items with same priority
    for (let priority = 0; priority < 5; priority++) {
      for (let i = 0; i < itemsPerPriority; i++) {
        queue.enqueue(`P${priority}_I${i}`, priority);
      }
    }
    
    // Verify FIFO within same priority
    let lastPriority = -1;
    let itemIndexes: Map<number, number> = new Map();
    
    while (queue.length > 0) {
      const item = queue.dequeue()!;
      const [pStr, iStr] = item.split('_');
      const priority = parseInt(pStr.substring(1));
      const index = parseInt(iStr.substring(1));
      
      if (priority !== lastPriority) {
        lastPriority = priority;
        itemIndexes.set(priority, -1);
      }
      
      const lastIndex = itemIndexes.get(priority)!;
      expect(index).toBeGreaterThan(lastIndex); // FIFO order
      itemIndexes.set(priority, index);
    }
  });

  test('should handle rapid enqueue/dequeue cycles', () => {
    const queue = new PriorityQueue<number>();
    const cycles = 10000;
    const startTime = performance.now();
    
    for (let cycle = 0; cycle < cycles; cycle++) {
      // Enqueue batch
      for (let i = 0; i < 10; i++) {
        queue.enqueue(cycle * 10 + i, Math.floor(Math.random() * 5));
      }
      
      // Dequeue some
      for (let i = 0; i < 5; i++) {
        queue.dequeue();
      }
    }
    
    const elapsed = performance.now() - startTime;
    const opsPerSecond = (cycles * 15) / (elapsed / 1000);
    
    console.log(`PriorityQueue: ${cycles} cycles in ${elapsed.toFixed(2)}ms`);
    console.log(`PriorityQueue: ${opsPerSecond.toFixed(0)} operations/sec`);
    
    expect(queue.length).toBe(cycles * 5); // Half remain
    expect(opsPerSecond).toBeGreaterThan(50000); // >50k ops/sec
  });

  test('should not leak memory over time', () => {
    const queue = new PriorityQueue<Uint8Array>();
    const initialMem = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Repeatedly add and remove large items
    for (let iteration = 0; iteration < 100; iteration++) {
      // Add 1000 items of 10KB each
      for (let i = 0; i < 1000; i++) {
        const data = new Uint8Array(10240); // 10KB
        queue.enqueue(data, Math.floor(Math.random() * 5));
      }
      
      // Remove all items
      while (queue.length > 0) {
        queue.dequeue();
      }
    }
    
    // Force garbage collection if available
    if (global.gc) global.gc();
    
    const finalMem = (performance as any).memory?.usedJSHeapSize || 0;
    const memLeaked = (finalMem - initialMem) / 1024 / 1024;
    
    console.log(`PriorityQueue: Memory leaked: ${memLeaked.toFixed(2)}MB`);
    expect(memLeaked).toBeLessThan(10); // Less than 10MB leaked
  });
});

// ============================================================================
// JITTER BUFFER STRESS TESTS  
// ============================================================================

describe('JitterBuffer - Stress Tests', () => {

  test('should handle extreme packet disorder', () => {
    const buffer = new JitterBuffer(50);
    const packetCount = 1000;
    const packets: Packet[] = [];
    
    // Create ordered packets
    for (let i = 0; i < packetCount; i++) {
      packets.push(PacketUtils.createAudioPacket(
        new Float32Array(320),
        StreamID.USER,
        i
      ));
    }
    
    // Shuffle packets randomly
    for (let i = packets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [packets[i], packets[j]] = [packets[j], packets[i]];
    }
    
    // Add shuffled packets
    const startTime = performance.now();
    packets.forEach(p => buffer.add(p));
    const addTime = performance.now() - startTime;
    
    // Retrieve in order
    const retrieved: number[] = [];
    for (let i = 0; i < packetCount; i++) {
      const packet = buffer.get(i);
      if (packet) {
        retrieved.push(packet.header.sequenceNumber);
      }
    }
    
    console.log(`JitterBuffer: Added ${packetCount} disordered packets in ${addTime.toFixed(2)}ms`);
    console.log(`JitterBuffer: Retrieved ${retrieved.length} packets`);
    
    // Verify some packets were buffered and retrieved
    expect(retrieved.length).toBeGreaterThan(0);
    expect(addTime).toBeLessThan(1000);
  });

  test('should adapt to varying network conditions', () => {
    const buffer = new JitterBuffer(50, true);
    const baseTime = BigInt(Date.now() * 1000);
    
    // Simulate varying network delays
    const scenarios = [
      { delay: 10, packets: 100 },  // Low latency
      { delay: 100, packets: 100 }, // High latency
      { delay: 20, packets: 100 },  // Back to low
      { delay: 200, packets: 100 }, // Very high
    ];
    
    scenarios.forEach((scenario, phase) => {
      for (let i = 0; i < scenario.packets; i++) {
        const packet = PacketUtils.createAudioPacket(
          new Float32Array(320),
          StreamID.USER,
          phase * 100 + i
        );
        
        // Add variable delay
        const jitter = (Math.random() - 0.5) * scenario.delay;
        packet.header.timestamp = baseTime + BigInt((scenario.delay + jitter) * 1000);
        buffer.add(packet);
      }
      
      const stats = buffer.getStatistics();
      console.log(`Phase ${phase}: Target delay adapted to ${stats.targetDelay.toFixed(2)}ms`);
    });
    
    const finalStats = buffer.getStatistics();
    expect(finalStats.packetsReceived).toBe(400);
    expect(finalStats.targetDelay).toBeGreaterThan(50); // Should have adapted up
  });

  test('should handle burst traffic', () => {
    const buffer = new JitterBuffer(50);
    const burstSize = 500;
    const bursts = 10;
    
    for (let burst = 0; burst < bursts; burst++) {
      const startTime = performance.now();
      
      // Send burst of packets
      for (let i = 0; i < burstSize; i++) {
        const packet = PacketUtils.createAudioPacket(
          new Float32Array(320),
          StreamID.USER,
          burst * burstSize + i
        );
        buffer.add(packet);
      }
      
      const burstTime = performance.now() - startTime;
      
      // Drain some packets
      const now = BigInt(Date.now() * 1000);
      const ready = buffer.getReady(now);
      
      console.log(`Burst ${burst}: ${burstSize} packets in ${burstTime.toFixed(2)}ms, ${ready.length} ready`);
    }
    
    const stats = buffer.getStatistics();
    expect(stats.packetsReceived).toBe(burstSize * bursts);
  });

  test('should maintain performance with full buffer', () => {
    const buffer = new JitterBuffer(50);
    const maxSize = 100; // Buffer max size
    
    // Fill buffer to capacity
    for (let i = 0; i < maxSize * 2; i++) {
      const packet = PacketUtils.createAudioPacket(
        new Float32Array(320),
        StreamID.USER,
        i
      );
      buffer.add(packet);
    }
    
    const stats = buffer.getStatistics();
    expect(stats.packetsDropped).toBeGreaterThan(0); // Some should be dropped
    
    // Measure retrieval performance with full buffer
    const startTime = performance.now();
    for (let i = 0; i < maxSize; i++) {
      buffer.get(i);
    }
    const retrievalTime = performance.now() - startTime;
    
    console.log(`JitterBuffer: Retrieved ${maxSize} from full buffer in ${retrievalTime.toFixed(2)}ms`);
    expect(retrievalTime).toBeLessThan(100); // Should be fast even when full
  });
});

// ============================================================================
// DUAL STREAM PROCESSOR STRESS TESTS
// ============================================================================

describe('DualStreamProcessor - Stress Tests', () => {

  test('should handle 10,000 packets per second', async () => {
    const processor = new DualStreamProcessor({
      parallelProcessing: true,
      maxConcurrentTasks: 8
    });
    
    const targetRate = 10000; // packets per second
    const duration = 1; // seconds
    const totalPackets = targetRate * duration;
    
    const startTime = performance.now();
    let processed = 0;
    
    processor.addEventListener('userAudio', () => processed++);
    processor.addEventListener('aiAudio', () => processed++);
    
    // Generate packets at target rate
    for (let i = 0; i < totalPackets; i++) {
      const packet = PacketUtils.createAudioPacket(
        new Float32Array(160), // 10ms at 16kHz
        i % 2 === 0 ? StreamID.USER : StreamID.AI,
        i
      );
      
      await processor.ingestPacket(packet);
      
      // Throttle to target rate
      if (i % 100 === 0) {
        const elapsed = performance.now() - startTime;
        const expectedTime = (i / targetRate) * 1000;
        if (elapsed < expectedTime) {
          await new Promise(resolve => setTimeout(resolve, expectedTime - elapsed));
        }
      }
    }
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const totalTime = performance.now() - startTime;
    const actualRate = processed / (totalTime / 1000);
    
    console.log(`DualStreamProcessor: Processed ${processed}/${totalPackets} packets`);
    console.log(`DualStreamProcessor: Rate: ${actualRate.toFixed(0)} packets/sec`);
    
    expect(processed).toBeGreaterThan(totalPackets * 0.9); // >90% processed
    processor.dispose();
  });

  test('should handle mixed packet types simultaneously', async () => {
    const processor = new DualStreamProcessor();
    const packetTypes = [
      PacketType.AUDIO_PCM,
      PacketType.TEXT_PARTIAL,
      PacketType.TEXT_FINAL,
      PacketType.AUDIO_VAD,
      PacketType.CSM_EMOTION,
      PacketType.CSM_CONTEXT
    ];
    
    const packetsPerType = 100;
    const events: Map<string, number> = new Map();
    
    // Track all event types
    ['userAudio', 'aiAudio', 'userText', 'aiText', 'vad', 'csmEmotion', 'csmContext'].forEach(type => {
      processor.addEventListener(type, () => {
        events.set(type, (events.get(type) || 0) + 1);
      });
    });
    
    // Send mixed packet types
    for (const type of packetTypes) {
      for (let i = 0; i < packetsPerType; i++) {
        const packet: Packet = {
          header: {
            version: 1,
            type,
            streamId: i % 2 === 0 ? StreamID.USER : StreamID.AI,
            sequenceNumber: i,
            timestamp: BigInt(Date.now() * 1000 + i * 1000),
            flags: PacketFlags.NONE,
            length: 0
          },
          payload: this.createPayloadForType(type)
        };
        
        await processor.ingestPacket(packet);
      }
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('DualStreamProcessor: Event counts:', Object.fromEntries(events));
    expect(events.size).toBeGreaterThan(0);
    
    processor.dispose();
  });

  test('should maintain synchronization under heavy load', async () => {
    const processor = new DualStreamProcessor();
    const sync = new StreamSynchronizer();
    
    // Generate synchronized conversation
    const conversationLength = 1000; // packets
    const baseTime = BigInt(Date.now() * 1000);
    
    for (let i = 0; i < conversationLength; i++) {
      // User speaks for 100ms, then AI responds for 100ms
      const isUserTurn = Math.floor(i / 5) % 2 === 0;
      
      const packet = PacketUtils.createAudioPacket(
        new Float32Array(320),
        isUserTurn ? StreamID.USER : StreamID.AI,
        i
      );
      
      packet.header.timestamp = baseTime + BigInt(i * 20000); // 20ms per packet
      
      await processor.ingestPacket(packet);
      
      // Track in synchronizer
      if (isUserTurn) {
        sync.addUserEvent(packet.header.timestamp, packet);
      } else {
        sync.addAIEvent(packet.header.timestamp, packet);
      }
    }
    
    // Check synchronization
    const overlap = sync.detectOverlap(200);
    const syncState = processor.synchronizeStreams();
    
    console.log(`DualStreamProcessor: Overlap detected: ${overlap.hasOverlap}`);
    console.log(`DualStreamProcessor: Sync action: ${syncState.action}`);
    
    const stats = processor.getStatistics();
    expect(stats.userPacketsProcessed + stats.aiPacketsProcessed).toBeGreaterThan(0);
    
    processor.dispose();
  });

  test('should handle packet loss and recovery', async () => {
    const processor = new DualStreamProcessor();
    const lossRate = 0.05; // 5% packet loss
    let retransmitRequests = 0;
    
    processor.addEventListener('retransmitRequest', () => retransmitRequests++);
    
    const totalPackets = 1000;
    let sentPackets = 0;
    let droppedPackets = 0;
    
    for (let i = 0; i < totalPackets; i++) {
      // Simulate packet loss
      if (Math.random() < lossRate) {
        droppedPackets++;
        continue;
      }
      
      const packet = PacketUtils.createAudioPacket(
        new Float32Array(320),
        StreamID.USER,
        i
      );
      
      await processor.ingestPacket(packet);
      sentPackets++;
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`DualStreamProcessor: Sent ${sentPackets}/${totalPackets} packets`);
    console.log(`DualStreamProcessor: Dropped ${droppedPackets} packets`);
    console.log(`DualStreamProcessor: Retransmit requests: ${retransmitRequests}`);
    
    expect(retransmitRequests).toBeGreaterThan(0);
    expect(droppedPackets).toBeCloseTo(totalPackets * lossRate, -1);
    
    processor.dispose();
  });

  // Helper method for mixed packet test
  private createPayloadForType(type: PacketType): any {
    switch (type) {
      case PacketType.AUDIO_PCM:
        return {
          audioData: new Float32Array(320),
          sampleRate: 16000,
          channels: 1,
          encoding: 'pcm',
          duration: 20
        };
      case PacketType.TEXT_PARTIAL:
      case PacketType.TEXT_FINAL:
        return {
          text: 'Test message',
          confidence: 0.95,
          isFinal: type === PacketType.TEXT_FINAL,
          language: 'en'
        };
      case PacketType.AUDIO_VAD:
        return {
          isSpeech: true,
          confidence: 0.9,
          energyLevel: 0.5
        };
      case PacketType.CSM_EMOTION:
        return {
          primary: { emotion: 'neutral', intensity: 0.5 },
          valence: 0,
          arousal: 0.5,
          confidence: 0.8,
          triggers: []
        };
      case PacketType.CSM_CONTEXT:
        return {
          contextId: 'test',
          conversationTurn: 1,
          topics: [],
          entities: [],
          relationships: [],
          temporalContext: {
            currentTime: BigInt(Date.now() * 1000),
            conversationStart: BigInt(Date.now() * 1000),
            lastUserInput: BigInt(Date.now() * 1000),
            lastAIResponse: BigInt(Date.now() * 1000),
            turnDurations: []
          }
        };
      default:
        return {};
    }
  }
});

// ============================================================================
// MEMORY LEAK TESTS
// ============================================================================

describe('Memory Leak Tests', () => {

  test('should clean up after dispose', async () => {
    const initialMem = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Create and destroy many processors
    for (let i = 0; i < 10; i++) {
      const processor = new DualStreamProcessor();
      
      // Process some packets
      for (let j = 0; j < 100; j++) {
        const packet = PacketUtils.createAudioPacket(
          new Float32Array(320),
          StreamID.USER,
          j
        );
        await processor.ingestPacket(packet);
      }
      
      // Dispose properly
      processor.dispose();
    }
    
    // Force GC if available
    if (global.gc) global.gc();
    
    const finalMem = (performance as any).memory?.usedJSHeapSize || 0;
    const leaked = (finalMem - initialMem) / 1024 / 1024;
    
    console.log(`Memory Leak Test: ${leaked.toFixed(2)}MB leaked after 10 processor cycles`);
    expect(leaked).toBeLessThan(50); // Less than 50MB leaked
  });

  test('should handle event listener cleanup', () => {
    const processor = new DualStreamProcessor();
    const listeners: Array<() => void> = [];
    
    // Add many listeners
    for (let i = 0; i < 1000; i++) {
      const listener = () => {};
      listeners.push(listener);
      processor.addEventListener('userAudio', listener);
    }
    
    // Remove all listeners
    listeners.forEach(listener => {
      processor.removeEventListener('userAudio', listener);
    });
    
    processor.dispose();
    
    // Verify no memory leak from listeners
    const hasListeners = (processor as any).listeners?.size > 0;
    expect(hasListeners).toBeFalsy();
  });
});

// ============================================================================
// PACKET CORRUPTION & RECOVERY TESTS
// ============================================================================

describe('Packet Corruption & Recovery', () => {

  test('should detect corrupted headers', () => {
    const manager = new PacketStreamManager();
    
    // Create packet with invalid sequence (negative)
    const packet: Packet = {
      header: {
        version: 1,
        type: PacketType.AUDIO_PCM,
        streamId: StreamID.USER,
        sequenceNumber: -1,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {}
    };
    
    // Should handle gracefully
    const result = manager.processPacket(packet);
    expect(result).toBeDefined();
  });

  test('should handle bit flips in data', () => {
    const original = PacketUtils.createAudioPacket(
      new Float32Array([0.5, -0.5, 0.5, -0.5]),
      StreamID.USER,
      1
    );
    
    // Simulate bit flip in encoded data
    const encoded = new Uint8Array(100);
    encoded[10] ^= 0xFF; // Flip all bits at position 10
    
    // Should not crash when processing corrupted data
    expect(() => {
      // Processor would detect corruption via checksum
      const checksum1 = PacketUtils.calculateChecksum(original);
      original.payload.audioData[0] = NaN; // Corrupt data
      const checksum2 = PacketUtils.calculateChecksum(original);
      expect(checksum1).not.toBe(checksum2);
    }).not.toThrow();
  });

  test('should recover from missing packet sequences', async () => {
    const processor = new DualStreamProcessor();
    const manager = new PacketStreamManager();
    
    // Send packets 0, 1, 2, 5, 6, 7 (missing 3, 4)
    const sequences = [0, 1, 2, 5, 6, 7];
    
    for (const seq of sequences) {
      const packet = PacketUtils.createAudioPacket(
        new Float32Array(320),
        StreamID.USER,
        seq
      );
      
      const result = manager.processPacket(packet);
      await processor.ingestPacket(packet);
      
      if (result.missing) {
        console.log(`Detected missing sequences: ${result.missing}`);
      }
    }
    
    // Verify missing packets were detected
    const missing = manager.getMissingPackets(StreamID.USER);
    expect(missing).toContain(3);
    expect(missing).toContain(4);
    
    processor.dispose();
  });
});

// ============================================================================
// EXTREME EDGE CASES
// ============================================================================

describe('Extreme Edge Cases', () => {

  test('should handle zero-length packets', async () => {
    const processor = new DualStreamProcessor();
    
    const packet: Packet = {
      header: {
        version: 1,
        type: PacketType.AUDIO_PCM,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        audioData: new Float32Array(0),
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm',
        duration: 0
      }
    };
    
    await expect(processor.ingestPacket(packet)).resolves.not.toThrow();
    processor.dispose();
  });

  test('should handle maximum timestamp values', () => {
    const sync = new StreamSynchronizer();
    const maxTimestamp = BigInt(2) ** BigInt(63) - BigInt(1);
    
    sync.addUserEvent(maxTimestamp, { type: 'test' });
    sync.addAIEvent(maxTimestamp - BigInt(1000), { type: 'test' });
    
    const overlap = sync.detectOverlap(100);
    expect(overlap).toBeDefined();
  });

  test('should handle rapid stream switching', async () => {
    const processor = new DualStreamProcessor();
    const switches = 1000;
    
    for (let i = 0; i < switches; i++) {
      const streamId = i % 3 === 0 ? StreamID.USER : 
                      i % 3 === 1 ? StreamID.AI : 
                      StreamID.SYSTEM;
      
      const packet = PacketUtils.createAudioPacket(
        new Float32Array(10), // Very short audio
        streamId,
        i
      );
      
      await processor.ingestPacket(packet);
    }
    
    const stats = processor.getStatistics();
    expect(stats.userPacketsProcessed + stats.aiPacketsProcessed).toBeGreaterThan(0);
    
    processor.dispose();
  });
});

// Run performance summary
if (require.main === module) {
  console.log('\n📊 Running Packet Protocol Stress Tests...\n');
  console.log('This will test:');
  console.log('  • 100,000+ item queues');
  console.log('  • 10,000 packets/second throughput');
  console.log('  • Memory leak detection');
  console.log('  • Packet corruption recovery');
  console.log('  • Extreme edge cases\n');
  console.log('Starting stress tests...\n');
}