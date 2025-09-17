/**
 * Dual-Stream Packet Processor for SolaceLive CSM
 * Handles parallel processing of user and AI audio/text streams
 */

import {
  Packet,
  PacketType,
  StreamID,
  PacketPriority,
  AudioPacket,
  TextPacket,
  CSMContextPacket,
  CSMEmotionPacket,
  PacketFlags,
  VADPacket,
  AudioFeaturesPacket
} from './packets';

// ============================================================================
// PACKET QUEUE IMPLEMENTATION
// ============================================================================

export class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];
  
  enqueue(item: T, priority: number): void {
    const element = { item, priority };
    let added = false;
    
    for (let i = 0; i < this.items.length; i++) {
      if (element.priority < this.items[i].priority) {
        this.items.splice(i, 0, element);
        added = true;
        break;
      }
    }
    
    if (!added) {
      this.items.push(element);
    }
  }
  
  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }
  
  peek(): T | undefined {
    return this.items[0]?.item;
  }
  
  get length(): number {
    return this.items.length;
  }
  
  clear(): void {
    this.items = [];
  }
}

// ============================================================================
// JITTER BUFFER
// ============================================================================

export class JitterBuffer {
  private buffer: Map<number, Packet> = new Map();
  private targetDelay: number = 50; // ms
  private adaptiveDelay: boolean = true;
  private maxBufferSize: number = 100;
  private statistics = {
    packetsReceived: 0,
    packetsLate: 0,
    packetsDropped: 0,
    jitter: 0
  };
  
  constructor(targetDelay: number = 50, adaptive: boolean = true) {
    this.targetDelay = targetDelay;
    this.adaptiveDelay = adaptive;
  }
  
  add(packet: Packet): void {
    const seq = packet.header.sequenceNumber;
    
    // Drop if buffer is full
    if (this.buffer.size >= this.maxBufferSize) {
      this.statistics.packetsDropped++;
      return;
    }
    
    this.buffer.set(seq, packet);
    this.statistics.packetsReceived++;
    
    if (this.adaptiveDelay) {
      this.adjustDelay();
    }
  }
  
  get(sequenceNumber: number): Packet | undefined {
    const packet = this.buffer.get(sequenceNumber);
    if (packet) {
      this.buffer.delete(sequenceNumber);
    }
    return packet;
  }
  
  getReady(currentTime: bigint): Packet[] {
    const ready: Packet[] = [];
    const threshold = currentTime - BigInt(this.targetDelay * 1000);
    
    for (const [seq, packet] of this.buffer) {
      if (packet.header.timestamp <= threshold) {
        ready.push(packet);
        this.buffer.delete(seq);
      }
    }
    
    return ready.sort((a, b) => 
      Number(a.header.sequenceNumber - b.header.sequenceNumber)
    );
  }
  
  private adjustDelay(): void {
    // Simple adaptive algorithm
    const bufferOccupancy = this.buffer.size / this.maxBufferSize;
    
    if (bufferOccupancy > 0.8) {
      // Buffer is getting full, increase delay
      this.targetDelay = Math.min(this.targetDelay * 1.1, 200);
    } else if (bufferOccupancy < 0.2) {
      // Buffer is mostly empty, decrease delay
      this.targetDelay = Math.max(this.targetDelay * 0.9, 20);
    }
  }
  
  getStatistics() {
    return { ...this.statistics, targetDelay: this.targetDelay };
  }
}

// ============================================================================
// PACKET STREAM MANAGER
// ============================================================================

export class PacketStreamManager {
  private expectedSequence: Map<StreamID, number> = new Map();
  private lastTimestamp: Map<StreamID, bigint> = new Map();
  private missingPackets: Map<StreamID, Set<number>> = new Map();
  
  constructor() {
    this.expectedSequence.set(StreamID.USER, 0);
    this.expectedSequence.set(StreamID.AI, 0);
    this.expectedSequence.set(StreamID.SYSTEM, 0);
  }
  
  processPacket(packet: Packet): {
    status: 'ok' | 'duplicate' | 'late' | 'future';
    missing?: number[];
  } {
    const streamId = packet.header.streamId;
    const seq = packet.header.sequenceNumber;
    const expected = this.expectedSequence.get(streamId) || 0;
    
    if (seq === expected) {
      // Perfect sequence
      this.expectedSequence.set(streamId, seq + 1);
      this.lastTimestamp.set(streamId, packet.header.timestamp);
      return { status: 'ok' };
    } else if (seq < expected) {
      // Late or duplicate packet
      return { status: seq < expected - 10 ? 'late' : 'duplicate' };
    } else {
      // Future packet - we're missing some
      const missing: number[] = [];
      for (let i = expected; i < seq; i++) {
        missing.push(i);
      }
      
      // Update missing packets tracking
      const streamMissing = this.missingPackets.get(streamId) || new Set();
      missing.forEach(m => streamMissing.add(m));
      this.missingPackets.set(streamId, streamMissing);
      
      // Update expected sequence
      this.expectedSequence.set(streamId, seq + 1);
      this.lastTimestamp.set(streamId, packet.header.timestamp);
      
      return { status: 'future', missing };
    }
  }
  
  getMissingPackets(streamId: StreamID): number[] {
    return Array.from(this.missingPackets.get(streamId) || []);
  }
  
  clearMissingPacket(streamId: StreamID, sequenceNumber: number): void {
    this.missingPackets.get(streamId)?.delete(sequenceNumber);
  }
}

// ============================================================================
// DUAL STREAM PROCESSOR
// ============================================================================

export interface ProcessorConfig {
  enableVAD: boolean;
  enableFeatureExtraction: boolean;
  enableCSM: boolean;
  parallelProcessing: boolean;
  maxConcurrentTasks: number;
}

export class DualStreamProcessor extends EventTarget {
  private userQueue: PriorityQueue<Packet>;
  private aiQueue: PriorityQueue<Packet>;
  private jitterBuffer: JitterBuffer;
  private streamManager: PacketStreamManager;
  private config: ProcessorConfig;
  private processingActive: boolean = false;
  private workers: Map<string, Worker> = new Map();
  
  // Statistics
  private stats = {
    userPacketsProcessed: 0,
    aiPacketsProcessed: 0,
    totalLatency: 0,
    averageLatency: 0
  };
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    
    this.config = {
      enableVAD: true,
      enableFeatureExtraction: true,
      enableCSM: true,
      parallelProcessing: true,
      maxConcurrentTasks: 4,
      ...config
    };
    
    this.userQueue = new PriorityQueue<Packet>();
    this.aiQueue = new PriorityQueue<Packet>();
    this.jitterBuffer = new JitterBuffer(50, true);
    this.streamManager = new PacketStreamManager();
    
    this.initializeWorkers();
  }
  
  private initializeWorkers(): void {
    // Initialize Web Workers for parallel processing
    if (this.config.parallelProcessing && typeof Worker !== 'undefined') {
      // These workers would be implemented separately
      // this.workers.set('vad', new Worker('./workers/vad.worker.js'));
      // this.workers.set('features', new Worker('./workers/features.worker.js'));
      // this.workers.set('csm', new Worker('./workers/csm.worker.js'));
    }
  }
  
  // ========== PACKET INGESTION ==========
  
  async ingestPacket(packet: Packet): Promise<void> {
    const startTime = performance.now();
    
    // Validate and route packet
    const validation = this.streamManager.processPacket(packet);
    
    if (validation.status === 'duplicate') {
      return; // Ignore duplicates
    }
    
    if (validation.status === 'future' && validation.missing) {
      // Request retransmission of missing packets
      this.requestRetransmission(packet.header.streamId, validation.missing);
    }
    
    // Add to jitter buffer if needed
    if (packet.header.flags & PacketFlags.REQUIRES_ACK) {
      this.sendAcknowledgment(packet);
    }
    
    // Route to appropriate queue based on stream
    const queue = packet.header.streamId === StreamID.USER 
      ? this.userQueue 
      : this.aiQueue;
    
    // Enqueue with priority
    const priority = packet.metadata?.priority || PacketPriority.NORMAL;
    queue.enqueue(packet, priority);
    
    // Update statistics
    const latency = performance.now() - startTime;
    this.stats.totalLatency += latency;
    
    // Trigger processing if not already active
    if (!this.processingActive) {
      this.startProcessing();
    }
  }
  
  // ========== PARALLEL PROCESSING ==========
  
  private async startProcessing(): Promise<void> {
    this.processingActive = true;
    
    while (this.userQueue.length > 0 || this.aiQueue.length > 0) {
      await Promise.all([
        this.processUserStream(),
        this.processAIStream()
      ]);
    }
    
    this.processingActive = false;
  }
  
  private async processUserStream(): Promise<void> {
    const packet = this.userQueue.dequeue();
    if (!packet) return;
    
    this.stats.userPacketsProcessed++;
    
    try {
      // Process based on packet type
      switch (packet.header.type) {
        case PacketType.AUDIO_PCM:
        case PacketType.AUDIO_OPUS:
          await this.processUserAudio(packet as AudioPacket);
          break;
          
        case PacketType.TEXT_PARTIAL:
        case PacketType.TEXT_FINAL:
          await this.processUserText(packet as TextPacket);
          break;
          
        case PacketType.AUDIO_VAD:
          await this.processVAD(packet as VADPacket);
          break;
          
        case PacketType.AUDIO_FEATURES:
          await this.processAudioFeatures(packet as AudioFeaturesPacket);
          break;
      }
    } catch (error) {
      console.error('Error processing user packet:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    }
  }
  
  private async processAIStream(): Promise<void> {
    const packet = this.aiQueue.dequeue();
    if (!packet) return;
    
    this.stats.aiPacketsProcessed++;
    
    try {
      switch (packet.header.type) {
        case PacketType.RESPONSE_AUDIO:
          await this.processAIAudio(packet as AudioPacket);
          break;
          
        case PacketType.RESPONSE_TEXT:
          await this.processAIText(packet as TextPacket);
          break;
          
        case PacketType.CSM_CONTEXT:
          await this.processCSMContext(packet as CSMContextPacket);
          break;
          
        case PacketType.CSM_EMOTION:
          await this.processCSMEmotion(packet as CSMEmotionPacket);
          break;
      }
    } catch (error) {
      console.error('Error processing AI packet:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    }
  }
  
  // ========== AUDIO PROCESSING ==========
  
  private async processUserAudio(packet: AudioPacket): Promise<void> {
    const tasks: Promise<any>[] = [];
    
    // Parallel feature extraction
    if (this.config.enableFeatureExtraction) {
      tasks.push(this.extractAudioFeatures(packet));
    }
    
    // Parallel VAD
    if (this.config.enableVAD) {
      tasks.push(this.performVAD(packet));
    }
    
    // Parallel transcription (would integrate with Whisper)
    tasks.push(this.transcribeAudio(packet));
    
    const results = await Promise.all(tasks);
    
    // Emit processed audio event
    this.dispatchEvent(new CustomEvent('userAudio', {
      detail: {
        packet,
        features: results[0],
        vad: results[1],
        transcription: results[2]
      }
    }));
  }
  
  private async processAIAudio(packet: AudioPacket): Promise<void> {
    // Process AI-generated audio
    this.dispatchEvent(new CustomEvent('aiAudio', { detail: packet }));
  }
  
  // ========== TEXT PROCESSING ==========
  
  private async processUserText(packet: TextPacket): Promise<void> {
    // Process user text (transcription results)
    if (this.config.enableCSM) {
      await this.sendToCSM(packet);
    }
    
    this.dispatchEvent(new CustomEvent('userText', { detail: packet }));
  }
  
  private async processAIText(packet: TextPacket): Promise<void> {
    // Process AI-generated text
    this.dispatchEvent(new CustomEvent('aiText', { detail: packet }));
  }
  
  // ========== FEATURE EXTRACTION ==========
  
  private async extractAudioFeatures(packet: AudioPacket): Promise<any> {
    // Extract audio features (energy, pitch, etc.)
    const audio = packet.payload.audioData;
    
    if (audio instanceof Float32Array) {
      // Simple energy calculation
      let energy = 0;
      for (let i = 0; i < audio.length; i++) {
        energy += audio[i] * audio[i];
      }
      energy = Math.sqrt(energy / audio.length);
      
      // Zero-crossing rate
      let zcr = 0;
      for (let i = 1; i < audio.length; i++) {
        if ((audio[i] >= 0) !== (audio[i - 1] >= 0)) {
          zcr++;
        }
      }
      zcr = zcr / audio.length;
      
      return { energy, zcr };
    }
    
    return null;
  }
  
  private async performVAD(packet: AudioPacket): Promise<boolean> {
    // Simple energy-based VAD
    const features = await this.extractAudioFeatures(packet);
    return features?.energy > 0.01; // Threshold
  }
  
  private async transcribeAudio(packet: AudioPacket): Promise<string> {
    // Placeholder for Whisper integration
    return '';
  }
  
  // ========== CSM PROCESSING ==========
  
  private async processCSMContext(packet: CSMContextPacket): Promise<void> {
    // Process CSM context updates
    this.dispatchEvent(new CustomEvent('csmContext', { detail: packet }));
  }
  
  private async processCSMEmotion(packet: CSMEmotionPacket): Promise<void> {
    // Process emotion updates
    this.dispatchEvent(new CustomEvent('csmEmotion', { detail: packet }));
  }
  
  private async sendToCSM(packet: TextPacket): Promise<void> {
    // Send text to CSM for processing
    // This would integrate with the actual CSM engine
  }
  
  private async processVAD(packet: VADPacket): Promise<void> {
    // Process VAD results
    this.dispatchEvent(new CustomEvent('vad', { detail: packet }));
  }
  
  private async processAudioFeatures(packet: AudioFeaturesPacket): Promise<void> {
    // Process audio features
    this.dispatchEvent(new CustomEvent('audioFeatures', { detail: packet }));
  }
  
  // ========== PACKET MANAGEMENT ==========
  
  private requestRetransmission(streamId: StreamID, sequences: number[]): void {
    this.dispatchEvent(new CustomEvent('retransmitRequest', {
      detail: { streamId, sequences }
    }));
  }
  
  private sendAcknowledgment(packet: Packet): void {
    this.dispatchEvent(new CustomEvent('acknowledge', {
      detail: {
        streamId: packet.header.streamId,
        sequenceNumber: packet.header.sequenceNumber
      }
    }));
  }
  
  // ========== SYNCHRONIZATION ==========
  
  synchronizeStreams(): {
    userOffset: number;
    aiOffset: number;
    action: 'continue' | 'interrupt' | 'switch';
  } {
    // Calculate time alignment between streams
    const userPacket = this.userQueue.peek();
    const aiPacket = this.aiQueue.peek();
    
    if (!userPacket || !aiPacket) {
      return { userOffset: 0, aiOffset: 0, action: 'continue' };
    }
    
    const timeDiff = Number(userPacket.header.timestamp - aiPacket.header.timestamp) / 1000;
    
    // Detect overlapping speech
    if (Math.abs(timeDiff) < 100) { // Within 100ms
      return {
        userOffset: 0,
        aiOffset: 0,
        action: 'interrupt' // Handle interruption
      };
    }
    
    // Normal turn-taking
    return {
      userOffset: Math.max(0, timeDiff),
      aiOffset: Math.max(0, -timeDiff),
      action: 'continue'
    };
  }
  
  // ========== STATISTICS ==========
  
  getStatistics() {
    return {
      ...this.stats,
      averageLatency: this.stats.totalLatency / 
        (this.stats.userPacketsProcessed + this.stats.aiPacketsProcessed),
      jitterBuffer: this.jitterBuffer.getStatistics(),
      queueLengths: {
        user: this.userQueue.length,
        ai: this.aiQueue.length
      }
    };
  }
  
  // ========== CLEANUP ==========
  
  dispose(): void {
    this.processingActive = false;
    this.userQueue.clear();
    this.aiQueue.clear();
    
    // Terminate workers
    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
  }
}

// ============================================================================
// STREAM SYNCHRONIZER
// ============================================================================

export class StreamSynchronizer {
  private userTimeline: Array<{ timestamp: bigint; data: any }> = [];
  private aiTimeline: Array<{ timestamp: bigint; data: any }> = [];
  private maxTimelineLength: number = 1000;
  private syncWindow: number = 100; // ms
  
  addUserEvent(timestamp: bigint, data: any): void {
    this.userTimeline.push({ timestamp, data });
    this.pruneTimeline(this.userTimeline);
  }
  
  addAIEvent(timestamp: bigint, data: any): void {
    this.aiTimeline.push({ timestamp, data });
    this.pruneTimeline(this.aiTimeline);
  }
  
  private pruneTimeline(timeline: Array<{ timestamp: bigint; data: any }>): void {
    if (timeline.length > this.maxTimelineLength) {
      timeline.splice(0, timeline.length - this.maxTimelineLength);
    }
  }
  
  detectOverlap(windowMs: number = this.syncWindow): {
    hasOverlap: boolean;
    overlapDuration: number;
    dominantStream: 'user' | 'ai' | 'none';
  } {
    const now = BigInt(Date.now() * 1000);
    const windowStart = now - BigInt(windowMs * 1000);
    
    const recentUser = this.userTimeline.filter(e => e.timestamp >= windowStart);
    const recentAI = this.aiTimeline.filter(e => e.timestamp >= windowStart);
    
    if (recentUser.length === 0 || recentAI.length === 0) {
      return { hasOverlap: false, overlapDuration: 0, dominantStream: 'none' };
    }
    
    // Find overlapping periods
    const userStart = recentUser[0].timestamp;
    const userEnd = recentUser[recentUser.length - 1].timestamp;
    const aiStart = recentAI[0].timestamp;
    const aiEnd = recentAI[recentAI.length - 1].timestamp;
    
    const overlapStart = userStart > aiStart ? userStart : aiStart;
    const overlapEnd = userEnd < aiEnd ? userEnd : aiEnd;
    
    if (overlapStart < overlapEnd) {
      const overlapDuration = Number(overlapEnd - overlapStart) / 1000;
      const dominantStream = recentUser.length > recentAI.length ? 'user' : 'ai';
      
      return {
        hasOverlap: true,
        overlapDuration,
        dominantStream
      };
    }
    
    return { hasOverlap: false, overlapDuration: 0, dominantStream: 'none' };
  }
  
  getTurnBoundaries(thresholdMs: number = 500): Array<{
    timestamp: bigint;
    from: 'user' | 'ai';
    to: 'user' | 'ai';
  }> {
    const boundaries: Array<{
      timestamp: bigint;
      from: 'user' | 'ai';
      to: 'user' | 'ai';
    }> = [];
    
    // Analyze timeline for turn switches
    // Implementation would detect silence gaps and speaker changes
    
    return boundaries;
  }
}

// Classes are exported individually above; no additional exports required.
