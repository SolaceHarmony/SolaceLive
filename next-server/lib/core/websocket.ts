#!/usr/bin/env node
/**
 * Unified WebSocket implementation with packet protocol support
 * Combines functionality from packet-websocket, moshi-ws-client, and protocol implementations
 */

import { EventEmitter } from 'events';

// ============================================================================
// PACKET TYPES & ENUMS
// ============================================================================

export enum PacketType {
  // Control packets
  HANDSHAKE = 0x00,
  HEARTBEAT = 0x01,
  ACKNOWLEDGE = 0x02,
  SYNC = 0x04,
  
  // Audio packets  
  AUDIO_OPUS = 0x10,
  AUDIO_PCM = 0x11,
  AUDIO_FEATURES = 0x12,
  
  // Text packets
  TEXT_PARTIAL = 0x20,
  TEXT_FINAL = 0x21,
  TEXT_METADATA = 0x23,
  
  // Moshi-specific
  MOSHI_AUDIO_CODES = 0x30,
  MOSHI_TEXT_TOKENS = 0x31,
  MOSHI_STATE = 0x32,
}

export enum Priority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

export interface Packet<T = any> {
  type: PacketType;
  priority: Priority;
  sequenceNumber: number;
  timestamp: number;
  data: T;
  requiresAck?: boolean;
}

// ============================================================================
// PACKET CODEC
// ============================================================================

export class PacketCodec {
  static encode(packet: Packet): Uint8Array {
    const payload = typeof packet.data === 'string' 
      ? new TextEncoder().encode(packet.data)
      : packet.data instanceof Uint8Array 
        ? packet.data
        : new Uint8Array(packet.data.buffer || packet.data);
    
    const header = new ArrayBuffer(17);
    const view = new DataView(header);
    view.setUint8(0, packet.type);
    view.setUint8(1, packet.priority);
    view.setUint32(2, packet.sequenceNumber, true);
    view.setFloat64(6, packet.timestamp, true);
    view.setUint16(14, payload.length, true);
    view.setUint8(16, packet.requiresAck ? 1 : 0);
    
    const buffer = new Uint8Array(17 + payload.length);
    buffer.set(new Uint8Array(header), 0);
    buffer.set(payload, 17);
    return buffer;
  }

  static decode(data: Uint8Array): Packet {
    const view = new DataView(data.buffer, data.byteOffset, 17);
    const payload = data.slice(17);
    
    return {
      type: view.getUint8(0),
      priority: view.getUint8(1),
      sequenceNumber: view.getUint32(2, true),
      timestamp: view.getFloat64(6, true),
      data: payload,
      requiresAck: view.getUint8(16) === 1,
    };
  }
}

// ============================================================================
// PRIORITY QUEUE
// ============================================================================

class PriorityQueue<T> {
  private queues = new Map<Priority, T[]>([
    [Priority.CRITICAL, []],
    [Priority.HIGH, []],
    [Priority.NORMAL, []],
    [Priority.LOW, []],
  ]);

  enqueue(item: T, priority: Priority): void {
    this.queues.get(priority)!.push(item);
  }

  dequeue(): T | null {
    for (const priority of [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  get size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
  }
}

// ============================================================================
// UNIFIED WEBSOCKET CLIENT
// ============================================================================

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  processingInterval?: number;
  maxQueueSize?: number;
}

export interface WebSocketStats {
  packetsSent: number;
  packetsReceived: number;
  packetsDropped: number;
  bytessSent: number;
  bytesReceived: number;
  latency: number;
  connected: boolean;
}

export class UnifiedWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private sendQueue = new PriorityQueue<Packet>();
  private recvQueue = new PriorityQueue<Packet>();
  private sequenceNumber = 0;
  private expectedSequence = 0;
  private stats: WebSocketStats = {
    packetsSent: 0,
    packetsReceived: 0,
    packetsDropped: 0,
    bytessSent: 0,
    bytesReceived: 0,
    latency: 0,
    connected: false,
  };
  private timers = {
    heartbeat: null as any,
    processing: null as any,
    reconnect: null as any,
  };

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnect: config.reconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 3000,
      heartbeatInterval: config.heartbeatInterval ?? 5000,
      processingInterval: config.processingInterval ?? 10,
      maxQueueSize: config.maxQueueSize ?? 1000,
    };
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this.stats.connected = true;
          this.startTimers();
          this.emit('connected');
          resolve();
        };

        this.ws.onclose = (event) => {
          this.stats.connected = false;
          this.stopTimers();
          this.emit('disconnected', event.code, event.reason);
          
          if (this.config.reconnect && event.code !== 1000) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          if (!this.stats.connected) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.config.reconnect = false;
    this.stopTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.sendQueue.clear();
    this.recvQueue.clear();
    this.stats.connected = false;
  }

  private scheduleReconnect(): void {
    if (this.timers.reconnect) return;
    
    this.timers.reconnect = setTimeout(() => {
      this.timers.reconnect = null;
      this.connect().catch(err => {
        this.emit('error', err);
        this.scheduleReconnect();
      });
    }, this.config.reconnectDelay);
  }

  // ============================================================================
  // PACKET SENDING
  // ============================================================================

  send(type: PacketType, data: any, priority = Priority.NORMAL, requiresAck = false): void {
    const packet: Packet = {
      type,
      priority,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data,
      requiresAck,
    };

    if (this.sendQueue.size >= this.config.maxQueueSize) {
      this.stats.packetsDropped++;
      this.emit('queueFull', 'send');
      return;
    }

    this.sendQueue.enqueue(packet, priority);
  }

  sendAudio(audio: Float32Array | Uint8Array, format: 'pcm' | 'opus' = 'pcm'): void {
    const type = format === 'opus' ? PacketType.AUDIO_OPUS : PacketType.AUDIO_PCM;
    this.send(type, audio, Priority.CRITICAL);
  }

  sendText(text: string, isFinal = false): void {
    const type = isFinal ? PacketType.TEXT_FINAL : PacketType.TEXT_PARTIAL;
    this.send(type, text, isFinal ? Priority.HIGH : Priority.NORMAL, isFinal);
  }

  sendMoshiAudioCodes(codes: number[]): void {
    const buffer = new Uint32Array(codes);
    this.send(PacketType.MOSHI_AUDIO_CODES, buffer, Priority.HIGH);
  }

  sendMoshiTextTokens(tokens: number[]): void {
    const buffer = new Uint32Array(tokens);
    this.send(PacketType.MOSHI_TEXT_TOKENS, buffer, Priority.HIGH);
  }

  // ============================================================================
  // PACKET RECEIVING
  // ============================================================================

  private handleMessage(event: MessageEvent): void {
    if (!(event.data instanceof ArrayBuffer)) {
      this.emit('error', new Error('Unexpected message format'));
      return;
    }

    try {
      const data = new Uint8Array(event.data);
      const packet = PacketCodec.decode(data);
      
      this.stats.packetsReceived++;
      this.stats.bytesReceived += data.length;
      
      // Update latency
      const latency = Date.now() - packet.timestamp;
      this.stats.latency = this.stats.latency * 0.9 + latency * 0.1;
      
      // Handle out-of-order packets
      if (packet.sequenceNumber < this.expectedSequence) {
        this.emit('outOfOrder', packet);
      } else if (packet.sequenceNumber === this.expectedSequence) {
        this.expectedSequence++;
      }
      
      // Queue for processing
      if (this.recvQueue.size >= this.config.maxQueueSize) {
        this.stats.packetsDropped++;
        this.emit('queueFull', 'receive');
        return;
      }
      
      this.recvQueue.enqueue(packet, packet.priority);
      
      // Send ACK if required
      if (packet.requiresAck) {
        this.sendAck(packet.sequenceNumber);
      }
    } catch (error) {
      this.stats.packetsDropped++;
      this.emit('error', error);
    }
  }

  private sendAck(sequenceNumber: number): void {
    const buffer = new Uint32Array([sequenceNumber]);
    this.send(PacketType.ACKNOWLEDGE, buffer, Priority.HIGH);
  }

  // ============================================================================
  // PROCESSING LOOPS
  // ============================================================================

  private startTimers(): void {
    // Processing timer
    this.timers.processing = setInterval(() => {
      this.processSendQueue();
      this.processRecvQueue();
    }, this.config.processingInterval);

    // Heartbeat timer
    this.timers.heartbeat = setInterval(() => {
      this.send(PacketType.HEARTBEAT, new Uint8Array(0), Priority.LOW);
    }, this.config.heartbeatInterval);
  }

  private stopTimers(): void {
    if (this.timers.processing) {
      clearInterval(this.timers.processing);
      this.timers.processing = null;
    }
    
    if (this.timers.heartbeat) {
      clearInterval(this.timers.heartbeat);
      this.timers.heartbeat = null;
    }
    
    if (this.timers.reconnect) {
      clearTimeout(this.timers.reconnect);
      this.timers.reconnect = null;
    }
  }

  private processSendQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const maxBatch = 10;
    let processed = 0;

    while (processed < maxBatch && this.sendQueue.size > 0) {
      const packet = this.sendQueue.dequeue();
      if (!packet) break;

      try {
        const encoded = PacketCodec.encode(packet);
        this.ws.send(encoded);
        this.stats.packetsSent++;
        this.stats.bytessSent += encoded.length;
        this.emit('packetSent', packet);
      } catch (error) {
        this.stats.packetsDropped++;
        this.emit('error', error);
      }

      processed++;
    }
  }

  private processRecvQueue(): void {
    const maxBatch = 10;
    let processed = 0;

    while (processed < maxBatch && this.recvQueue.size > 0) {
      const packet = this.recvQueue.dequeue();
      if (!packet) break;

      this.dispatchPacket(packet);
      processed++;
    }
  }

  private dispatchPacket(packet: Packet): void {
    switch (packet.type) {
      case PacketType.HANDSHAKE:
        this.emit('handshake', packet.data);
        break;
        
      case PacketType.HEARTBEAT:
        this.emit('heartbeat', packet.timestamp);
        break;
        
      case PacketType.AUDIO_PCM:
        this.emit('audio', new Float32Array(packet.data.buffer), 'pcm');
        break;
        
      case PacketType.AUDIO_OPUS:
        this.emit('audio', packet.data, 'opus');
        break;
        
      case PacketType.TEXT_PARTIAL:
        this.emit('textPartial', new TextDecoder().decode(packet.data));
        break;
        
      case PacketType.TEXT_FINAL:
        this.emit('textFinal', new TextDecoder().decode(packet.data));
        break;
        
      case PacketType.MOSHI_AUDIO_CODES: {
        const codes = Array.from(new Uint32Array(packet.data.buffer));
        this.emit('moshiAudioCodes', codes);
        break;
      }
        
      case PacketType.MOSHI_TEXT_TOKENS: {
        const tokens = Array.from(new Uint32Array(packet.data.buffer));
        this.emit('moshiTextTokens', tokens);
        break;
      }
        
      default:
        this.emit('packet', packet);
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  getStats(): WebSocketStats {
    return { ...this.stats };
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getQueueSizes(): { send: number; receive: number } {
    return {
      send: this.sendQueue.size,
      receive: this.recvQueue.size,
    };
  }
}