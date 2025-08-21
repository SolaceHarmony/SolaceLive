/**
 * Packet-Backed WebSocket Implementation
 * 
 * A practical enhancement to SolaceLive's WebSocket system using packet concepts
 * for better real-time performance without the full neuromorphic complexity.
 */

// Simple EventEmitter implementation for browser compatibility
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener: Function): this {
    if (!this.events[event]) return this;
    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;
    this.events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
    return true;
  }
}

// ============================================================================
// PRACTICAL PACKET TYPES (No Neural Complexity)
// ============================================================================

export enum PacketType {
  // Basic packet types for real-time audio/text
  AUDIO_CHUNK = 0x10,
  TEXT_PARTIAL = 0x20,
  TEXT_FINAL = 0x21,
  METADATA = 0x30,
  HEARTBEAT = 0x01,
  ACK = 0x02
}

export enum Priority {
  CRITICAL = 0,    // Must arrive (audio)
  HIGH = 1,        // Important (final text)
  NORMAL = 2,      // Standard (partial text)
  LOW = 3          // Can drop (metadata)
}

export interface Packet {
  type: PacketType;
  priority: Priority;
  sequenceNumber: number;
  timestamp: number;
  data: Uint8Array;
  requiresAck?: boolean;
}

export interface PacketHeader {
  type: number;           // 1 byte
  priority: number;       // 1 byte  
  sequence: number;       // 4 bytes
  timestamp: number;      // 8 bytes (double)
  length: number;         // 2 bytes
  flags: number;          // 1 byte
  // Total: 17 bytes
}

// ============================================================================
// PACKET ENCODER/DECODER
// ============================================================================

export class PacketCodec {
  static encode(packet: Packet): Uint8Array {
    const header = new ArrayBuffer(17);
    const headerView = new DataView(header);
    
    headerView.setUint8(0, packet.type);
    headerView.setUint8(1, packet.priority);
    headerView.setUint32(2, packet.sequenceNumber, true);
    headerView.setFloat64(6, packet.timestamp, true);
    headerView.setUint16(14, packet.data.length, true);
    headerView.setUint8(16, packet.requiresAck ? 1 : 0);
    
    // Combine header + data
    const result = new Uint8Array(17 + packet.data.length);
    result.set(new Uint8Array(header), 0);
    result.set(packet.data, 17);
    
    return result;
  }
  
  static decode(data: Uint8Array): Packet {
    const headerView = new DataView(data.buffer, data.byteOffset, 17);
    
    return {
      type: headerView.getUint8(0),
      priority: headerView.getUint8(1),
      sequenceNumber: headerView.getUint32(2, true),
      timestamp: headerView.getFloat64(6, true),
      data: data.slice(17),
      requiresAck: headerView.getUint8(16) === 1
    };
  }
}

// ============================================================================
// PRIORITY QUEUE FOR PACKET ORDERING
// ============================================================================

export class PriorityPacketQueue {
  private queues: Map<Priority, Packet[]> = new Map();
  
  constructor() {
    // Initialize priority queues
    Object.values(Priority).forEach(priority => {
      if (typeof priority === 'number') {
        this.queues.set(priority, []);
      }
    });
  }
  
  enqueue(packet: Packet): void {
    const queue = this.queues.get(packet.priority)!;
    queue.push(packet);
    
    // Sort by sequence number within priority
    queue.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }
  
  dequeue(): Packet | null {
    // Check priorities in order: CRITICAL, HIGH, NORMAL, LOW
    for (const priority of [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }
  
  peek(): Packet | null {
    for (const priority of [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue[0];
      }
    }
    return null;
  }
  
  get length(): number {
    return Array.from(this.queues.values()).reduce((sum, queue) => sum + queue.length, 0);
  }
}

// ============================================================================
// PACKET-BACKED WEBSOCKET
// ============================================================================

export class PacketWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private sendQueue: PriorityPacketQueue = new PriorityPacketQueue();
  private receiveQueue: PriorityPacketQueue = new PriorityPacketQueue();
  private sequenceNumber: number = 0;
  private expectedSequence: number = 0;
  private processingInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly PROCESS_INTERVAL = 10; // 10ms - process packets frequently
  private readonly MAX_QUEUE_SIZE = 1000;
  
  // Statistics
  private stats = {
    packetsSent: 0,
    packetsReceived: 0,
    packetsDropped: 0,
    averageLatency: 0,
    totalLatency: 0
  };
  
  constructor(private url: string) {
    super();
  }
  
  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';
        
        this.ws.onopen = () => {
          console.log('[PacketWS] Connected to', this.url);
          this.startProcessing();
          resolve();
        };
        
        this.ws.onclose = () => {
          console.log('[PacketWS] Disconnected');
          this.stopProcessing();
          this.emit('disconnect');
        };
        
        this.ws.onerror = (error) => {
          console.error('[PacketWS] Error:', error);
          reject(error);
        };
        
        this.ws.onmessage = (event) => {
          this.handleIncomingMessage(event);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Send audio chunk with high priority
   */
  sendAudio(audioData: Float32Array): void {
    const packet: Packet = {
      type: PacketType.AUDIO_CHUNK,
      priority: Priority.CRITICAL,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: new Uint8Array(audioData.buffer),
      requiresAck: false // Audio is real-time, don't wait for acks
    };
    
    this.sendQueue.enqueue(packet);
  }
  
  /**
   * Send text with appropriate priority
   */
  sendText(text: string, isFinal: boolean = false): void {
    const textData = new TextEncoder().encode(text);
    
    const packet: Packet = {
      type: isFinal ? PacketType.TEXT_FINAL : PacketType.TEXT_PARTIAL,
      priority: isFinal ? Priority.HIGH : Priority.NORMAL,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: textData,
      requiresAck: isFinal // Only final text needs ack
    };
    
    this.sendQueue.enqueue(packet);
  }
  
  /**
   * Send metadata with low priority
   */
  sendMetadata(metadata: any): void {
    const metadataData = new TextEncoder().encode(JSON.stringify(metadata));
    
    const packet: Packet = {
      type: PacketType.METADATA,
      priority: Priority.LOW,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: metadataData
    };
    
    this.sendQueue.enqueue(packet);
  }
  
  /**
   * Close connection
   */
  close(): void {
    this.stopProcessing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  // ========== PRIVATE METHODS ==========
  
  private startProcessing(): void {
    // Start packet processing loop
    this.processingInterval = setInterval(() => {
      this.processOutgoingPackets();
      this.processIncomingPackets();
    }, this.PROCESS_INTERVAL);
    
    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }
  
  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  private processOutgoingPackets(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Send packets based on priority
    let processed = 0;
    const maxPerCycle = 10; // Limit packets per cycle
    
    while (processed < maxPerCycle && this.sendQueue.length > 0) {
      const packet = this.sendQueue.dequeue();
      if (!packet) break;
      
      try {
        const encoded = PacketCodec.encode(packet);
        this.ws.send(encoded);
        
        this.stats.packetsSent++;
        processed++;
        
        this.emit('packetSent', packet);
        
      } catch (error) {
        console.error('[PacketWS] Send error:', error);
        this.stats.packetsDropped++;
      }
    }
  }
  
  private processIncomingPackets(): void {
    // Process received packets in priority order
    let processed = 0;
    const maxPerCycle = 10;
    
    while (processed < maxPerCycle && this.receiveQueue.length > 0) {
      const packet = this.receiveQueue.dequeue();
      if (!packet) break;
      
      this.handlePacket(packet);
      processed++;
    }
  }
  
  private handleIncomingMessage(event: MessageEvent): void {
    try {
      const data = new Uint8Array(event.data);
      const packet = PacketCodec.decode(data);
      
      // Calculate latency
      const latency = Date.now() - packet.timestamp;
      this.stats.totalLatency += latency;
      this.stats.averageLatency = this.stats.totalLatency / (this.stats.packetsReceived + 1);
      
      // Check sequence number
      if (packet.sequenceNumber < this.expectedSequence) {
        // Late packet - might still be useful for audio
        if (packet.type === PacketType.AUDIO_CHUNK) {
          this.receiveQueue.enqueue(packet);
        }
        // Drop late text packets
        return;
      }
      
      if (packet.sequenceNumber > this.expectedSequence) {
        // Future packet - queue it
        this.receiveQueue.enqueue(packet);
      } else {
        // Perfect sequence
        this.receiveQueue.enqueue(packet);
        this.expectedSequence++;
      }
      
      this.stats.packetsReceived++;
      
      // Send ACK if required
      if (packet.requiresAck) {
        this.sendAck(packet.sequenceNumber);
      }
      
    } catch (error) {
      console.error('[PacketWS] Decode error:', error);
      this.stats.packetsDropped++;
    }
  }
  
  private handlePacket(packet: Packet): void {
    switch (packet.type) {
      case PacketType.AUDIO_CHUNK:
        const audioData = new Float32Array(packet.data.buffer);
        this.emit('audio', audioData, packet.timestamp);
        break;
        
      case PacketType.TEXT_PARTIAL:
        const partialText = new TextDecoder().decode(packet.data);
        this.emit('textPartial', partialText, packet.timestamp);
        break;
        
      case PacketType.TEXT_FINAL:
        const finalText = new TextDecoder().decode(packet.data);
        this.emit('textFinal', finalText, packet.timestamp);
        break;
        
      case PacketType.METADATA:
        const metadata = JSON.parse(new TextDecoder().decode(packet.data));
        this.emit('metadata', metadata, packet.timestamp);
        break;
        
      case PacketType.HEARTBEAT:
        this.emit('heartbeat', packet.timestamp);
        break;
        
      case PacketType.ACK:
        const ackedSeq = new DataView(packet.data.buffer).getUint32(0, true);
        this.emit('ack', ackedSeq);
        break;
    }
  }
  
  private sendHeartbeat(): void {
    const packet: Packet = {
      type: PacketType.HEARTBEAT,
      priority: Priority.LOW,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: new Uint8Array(0)
    };
    
    this.sendQueue.enqueue(packet);
  }
  
  private sendAck(sequenceNumber: number): void {
    const ackData = new ArrayBuffer(4);
    new DataView(ackData).setUint32(0, sequenceNumber, true);
    
    const packet: Packet = {
      type: PacketType.ACK,
      priority: Priority.HIGH,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: new Uint8Array(ackData)
    };
    
    this.sendQueue.enqueue(packet);
  }
  
  /**
   * Get connection statistics
   */
  getStats(): any {
    return {
      ...this.stats,
      queueSizes: {
        send: this.sendQueue.length,
        receive: this.receiveQueue.length
      }
    };
  }
}

// ============================================================================
// USAGE EXAMPLE FOR SALACELIVE
// ============================================================================

 export class SolaceLivePacketClient extends EventEmitter {
  private packetWS: PacketWebSocket;
  
  constructor(serverUrl: string = 'ws://localhost:8788') {
    super();
    this.packetWS = new PacketWebSocket(serverUrl);
    this.setupEventHandlers();
  }
  
  async connect(): Promise<void> {
    await this.packetWS.connect();
  }
  
  private setupEventHandlers(): void {
    // Re-emit incoming audio
    this.packetWS.on('audio', (audioData: Float32Array, timestamp: number) => {
      this.emit('audioChunk', audioData, timestamp);
    });
    
    // Re-emit partial transcriptions
    this.packetWS.on('textPartial', (text: string, timestamp: number) => {
      this.emit('textPartial', text, timestamp);
    });
    
    // Re-emit final transcriptions
    this.packetWS.on('textFinal', (text: string, timestamp: number) => {
      this.emit('textFinal', text, timestamp);
    });
    
    // Re-emit metadata
    this.packetWS.on('metadata', (data: any, timestamp: number) => {
      this.emit('metadata', data, timestamp);
    });

    // Connection lifecycle
    this.packetWS.on('disconnect', () => this.emit('disconnected'));
  }
  
  /**
   * Send audio chunk (e.g., from microphone)
   */
  sendAudio(audioChunk: Float32Array): void {
    this.packetWS.sendAudio(audioChunk);
  }
  
  /**
   * Send user text input
   */
  sendUserText(text: string): void {
    this.packetWS.sendText(text, true); // User text is always final
  }
  
  /**
   * Send processing update
   */
  sendPartialTranscription(text: string): void {
    this.packetWS.sendText(text, false);
  }
  
  /**
   * Get performance stats
   */
  getPerformanceStats(): any {
    return this.packetWS.getStats();
  }
  
  close(): void {
    this.packetWS.close();
  }
}

// Example usage:
// const client = new SolaceLivePacketClient();
// await client.connect();
// client.sendAudio(audioChunk);
// client.sendUserText("Hello, how are you?");