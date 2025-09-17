/**
 * Enhanced Packet Protocol for SolaceLive CSM Integration
 * Extends Moshi's base protocol with advanced packet features
 */

// ============================================================================
// PACKET TYPES & CONSTANTS
// ============================================================================

export enum PacketType {
  // Control packets (0x00-0x0F)
  HANDSHAKE = 0x00,
  HEARTBEAT = 0x01,
  ACKNOWLEDGE = 0x02,
  RETRANSMIT = 0x03,
  SYNC = 0x04,
  
  // Audio packets (0x10-0x1F)
  AUDIO_OPUS = 0x10,
  AUDIO_PCM = 0x11,
  AUDIO_FEATURES = 0x12,
  AUDIO_VAD = 0x13,
  
  // Text packets (0x20-0x2F)
  TEXT_PARTIAL = 0x20,
  TEXT_FINAL = 0x21,
  TEXT_CORRECTION = 0x22,
  TEXT_METADATA = 0x23,
  
  // CSM packets (0x30-0x3F)
  CSM_CONTEXT = 0x30,
  CSM_EMOTION = 0x31,
  CSM_INTENT = 0x32,
  CSM_MEMORY = 0x33,
  CSM_PLANNING = 0x34,
  
  // Response packets (0x40-0x4F)
  RESPONSE_AUDIO = 0x40,
  RESPONSE_TEXT = 0x41,
  RESPONSE_ACTION = 0x42,
  RESPONSE_EMOTION = 0x43,
  
  // Stream control (0x50-0x5F)
  STREAM_START = 0x50,
  STREAM_END = 0x51,
  STREAM_PAUSE = 0x52,
  STREAM_RESUME = 0x53,
  STREAM_SWITCH = 0x54,
}

export enum StreamID {
  USER = 0x0001,
  AI = 0x0002,
  SYSTEM = 0x0003,
  BROADCAST = 0xFFFF,
}

export enum PacketPriority {
  CRITICAL = 0,  // Must be processed immediately
  HIGH = 1,      // Process as soon as possible
  NORMAL = 2,    // Standard processing
  LOW = 3,       // Can be delayed
  BULK = 4,      // Process when idle
}

export enum PacketFlags {
  NONE = 0x0000,
  ENCRYPTED = 0x0001,
  COMPRESSED = 0x0002,
  FRAGMENTED = 0x0004,
  REQUIRES_ACK = 0x0008,
  RETRANSMITTED = 0x0010,
  FINAL_FRAGMENT = 0x0020,
  PRIORITY_OVERRIDE = 0x0040,
  TIMESTAMP_SYNC = 0x0080,
}

// ============================================================================
// BASE PACKET INTERFACES
// ============================================================================

export interface PacketHeader {
  version: number;           // Protocol version (uint8)
  type: PacketType;         // Packet type (uint8)
  streamId: StreamID;       // Stream identifier (uint16)
  sequenceNumber: number;   // Packet sequence (uint32)
  timestamp: bigint;        // Microsecond timestamp (uint64)
  flags: PacketFlags;       // Status flags (uint16)
  length: number;          // Payload length (uint16)
  checksum?: number;       // Optional CRC32 (uint32)
}

export interface Packet<T = any> {
  header: PacketHeader;
  payload: T;
  metadata?: PacketMetadata;
}

export interface PacketMetadata {
  priority: PacketPriority;
  ttl: number;              // Time to live in ms
  retryCount: number;       // Number of retransmission attempts
  correlationId?: string;   // For request-response correlation
  fragmentInfo?: FragmentInfo;
}

export interface FragmentInfo {
  fragmentId: number;       // Fragment number
  totalFragments: number;   // Total number of fragments
  originalLength: number;   // Original payload length
}

// ============================================================================
// AUDIO PACKET TYPES
// ============================================================================

export interface AudioPacketPayload {
  audioData: Float32Array | Uint8Array;  // PCM or compressed audio
  sampleRate: number;
  channels: number;
  encoding: 'pcm' | 'opus' | 'aac';
  duration: number;         // Duration in ms
}

export interface AudioFeaturesPayload {
  energy: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  mfcc: Float32Array;       // Mel-frequency cepstral coefficients
  pitch?: number;
  formants?: number[];
}

export interface VADPayload {
  isSpeech: boolean;
  confidence: number;
  energyLevel: number;
  startTime?: bigint;
  endTime?: bigint;
}

export type AudioPacket = Packet<AudioPacketPayload>;
export type AudioFeaturesPacket = Packet<AudioFeaturesPayload>;
export type VADPacket = Packet<VADPayload>;

// ============================================================================
// TEXT PACKET TYPES
// ============================================================================

export interface TextPacketPayload {
  text: string;
  confidence: number;
  isFinal: boolean;
  language: string;
  speakerId?: number;
  tokens?: TokenInfo[];
}

export interface TokenInfo {
  text: string;
  start: number;            // Start time in ms
  end: number;              // End time in ms
  confidence: number;
  phonemes?: string[];
}

export interface TextCorrectionPayload {
  originalSequence: number; // Sequence number of packet to correct
  correction: string;
  reason: 'misrecognition' | 'context' | 'grammar';
}

export type TextPacket = Packet<TextPacketPayload>;
export type TextCorrectionPacket = Packet<TextCorrectionPayload>;

// ============================================================================
// CSM (COGNITIVE SYNTHESIS MODEL) PACKET TYPES
// ============================================================================

export interface CSMContextPayload {
  contextId: string;
  conversationTurn: number;
  topics: string[];
  entities: Entity[];
  relationships: Relationship[];
  temporalContext: TemporalContext;
}

export interface Entity {
  id: string;
  type: string;
  value: string;
  confidence: number;
  mentions: number[];       // Token indices where mentioned
}

export interface Relationship {
  subject: string;          // Entity ID
  predicate: string;
  object: string;           // Entity ID
  confidence: number;
}

export interface TemporalContext {
  currentTime: bigint;
  conversationStart: bigint;
  lastUserInput: bigint;
  lastAIResponse: bigint;
  turnDurations: number[];
}

export interface CSMEmotionPayload {
  primary: EmotionState;
  secondary?: EmotionState;
  valence: number;          // -1 to 1 (negative to positive)
  arousal: number;          // 0 to 1 (calm to excited)
  confidence: number;
  triggers: string[];       // What triggered this emotion
}

export interface EmotionState {
  emotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'neutral';
  intensity: number;        // 0 to 1
}

export interface CSMIntentPayload {
  intent: string;
  confidence: number;
  parameters: Map<string, any>;
  requiresResponse: boolean;
  urgency: 'immediate' | 'normal' | 'low';
}

export interface CSMMemoryPayload {
  memoryType: 'working' | 'episodic' | 'semantic';
  content: any;
  importance: number;
  decay: number;            // How fast this memory fades
  associations: string[];   // Related memory IDs
}

export interface CSMPlanningPayload {
  planId: string;
  goal: string;
  steps: PlanStep[];
  currentStep: number;
  adaptations: Adaptation[];
}

export interface PlanStep {
  action: string;
  parameters: Map<string, any>;
  expectedOutcome: string;
  completed: boolean;
}

export interface Adaptation {
  trigger: string;
  adjustment: string;
  timestamp: bigint;
}

export type CSMContextPacket = Packet<CSMContextPayload>;
export type CSMEmotionPacket = Packet<CSMEmotionPayload>;
export type CSMIntentPacket = Packet<CSMIntentPayload>;
export type CSMMemoryPacket = Packet<CSMMemoryPayload>;
export type CSMPlanningPacket = Packet<CSMPlanningPayload>;

// ============================================================================
// PACKET ENCODER/DECODER
// ============================================================================

export class PacketEncoder {
  private static readonly HEADER_SIZE = 24; // bytes
  
  static encode(packet: Packet): Uint8Array {
    const header = this.encodeHeader(packet.header);
    const payload = this.encodePayload(packet.payload, packet.header.type);
    const metadata = packet.metadata ? this.encodeMetadata(packet.metadata) : new Uint8Array(0);
    
    const totalLength = header.length + payload.length + metadata.length;
    const buffer = new Uint8Array(totalLength);
    
    let offset = 0;
    buffer.set(header, offset);
    offset += header.length;
    buffer.set(payload, offset);
    offset += payload.length;
    buffer.set(metadata, offset);
    
    return buffer;
  }
  
  private static encodeHeader(header: PacketHeader): Uint8Array {
    const buffer = new ArrayBuffer(this.HEADER_SIZE);
    const view = new DataView(buffer);
    
    view.setUint8(0, header.version);
    view.setUint8(1, header.type);
    view.setUint16(2, header.streamId, true);
    view.setUint32(4, header.sequenceNumber, true);
    view.setBigUint64(8, header.timestamp, true);
    view.setUint16(16, header.flags, true);
    view.setUint16(18, header.length, true);
    
    if (header.checksum !== undefined) {
      view.setUint32(20, header.checksum, true);
    }
    
    return new Uint8Array(buffer);
  }
  
  private static encodePayload(payload: any, type: PacketType): Uint8Array {
    // Type-specific encoding logic
    switch (type) {
      case PacketType.AUDIO_PCM:
        return this.encodeAudioPayload(payload as AudioPacketPayload);
      case PacketType.TEXT_PARTIAL:
      case PacketType.TEXT_FINAL:
        return this.encodeTextPayload(payload as TextPacketPayload);
      case PacketType.CSM_CONTEXT:
        return this.encodeCSMContextPayload(payload as CSMContextPayload);
      default:
        return new TextEncoder().encode(JSON.stringify(payload));
    }
  }
  
  private static encodeAudioPayload(payload: AudioPacketPayload): Uint8Array {
    const audioBytes = payload.audioData instanceof Float32Array
      ? new Uint8Array(payload.audioData.buffer)
      : payload.audioData;
    
    const metaStr = JSON.stringify({
      sampleRate: payload.sampleRate,
      channels: payload.channels,
      encoding: payload.encoding,
      duration: payload.duration
    });
    const metaBytes = new TextEncoder().encode(metaStr);
    
    const buffer = new Uint8Array(4 + metaBytes.length + audioBytes.length);
    const view = new DataView(buffer.buffer);
    
    view.setUint32(0, metaBytes.length, true);
    buffer.set(metaBytes, 4);
    buffer.set(audioBytes, 4 + metaBytes.length);
    
    return buffer;
  }
  
  private static encodeTextPayload(payload: TextPacketPayload): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(payload));
  }
  
  private static encodeCSMContextPayload(payload: CSMContextPayload): Uint8Array {
    // Efficient binary encoding for CSM context
    return new TextEncoder().encode(JSON.stringify(payload));
  }
  
  private static encodeMetadata(metadata: PacketMetadata): Uint8Array {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    
    view.setUint8(0, metadata.priority);
    view.setUint16(1, metadata.ttl, true);
    view.setUint8(3, metadata.retryCount);
    
    // Additional metadata encoded as needed
    return new Uint8Array(buffer);
  }
}

export class PacketDecoder {
  private static readonly HEADER_SIZE = 24; // bytes
  
  static decode(data: Uint8Array): Packet {
    const header = this.decodeHeader(data.slice(0, this.HEADER_SIZE));
    const payloadEnd = this.HEADER_SIZE + header.length;
    const payload = this.decodePayload(
      data.slice(this.HEADER_SIZE, payloadEnd),
      header.type
    );
    
    let metadata: PacketMetadata | undefined;
    if (data.length > payloadEnd) {
      metadata = this.decodeMetadata(data.slice(payloadEnd));
    }
    
    return { header, payload, metadata };
  }
  
  private static decodeHeader(data: Uint8Array): PacketHeader {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    
    return {
      version: view.getUint8(0),
      type: view.getUint8(1) as PacketType,
      streamId: view.getUint16(2, true) as StreamID,
      sequenceNumber: view.getUint32(4, true),
      timestamp: view.getBigUint64(8, true),
      flags: view.getUint16(16, true) as PacketFlags,
      length: view.getUint16(18, true),
      checksum: data.length >= 24 ? view.getUint32(20, true) : undefined
    };
  }
  
  private static decodePayload(data: Uint8Array, type: PacketType): any {
    switch (type) {
      case PacketType.AUDIO_PCM:
        return this.decodeAudioPayload(data);
      case PacketType.TEXT_PARTIAL:
      case PacketType.TEXT_FINAL:
        return this.decodeTextPayload(data);
      case PacketType.CSM_CONTEXT:
        return this.decodeCSMContextPayload(data);
      default:
        return JSON.parse(new TextDecoder().decode(data));
    }
  }
  
  private static decodeAudioPayload(data: Uint8Array): AudioPacketPayload {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const metaLength = view.getUint32(0, true);
    const metaBytes = data.slice(4, 4 + metaLength);
    const meta = JSON.parse(new TextDecoder().decode(metaBytes));
    const audioBytes = data.slice(4 + metaLength);
    
    return {
      audioData: meta.encoding === 'pcm' 
        ? new Float32Array(audioBytes.buffer, audioBytes.byteOffset, audioBytes.length / 4)
        : audioBytes,
      sampleRate: meta.sampleRate,
      channels: meta.channels,
      encoding: meta.encoding,
      duration: meta.duration
    };
  }
  
  private static decodeTextPayload(data: Uint8Array): TextPacketPayload {
    return JSON.parse(new TextDecoder().decode(data));
  }
  
  private static decodeCSMContextPayload(data: Uint8Array): CSMContextPayload {
    return JSON.parse(new TextDecoder().decode(data));
  }
  
  private static decodeMetadata(data: Uint8Array): PacketMetadata {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    
    return {
      priority: view.getUint8(0) as PacketPriority,
      ttl: view.getUint16(1, true),
      retryCount: view.getUint8(3)
    };
  }
}

// ============================================================================
// PACKET UTILITIES
// ============================================================================

export class PacketUtils {
  static createAudioPacket(
    audio: Float32Array,
    streamId: StreamID,
    sequenceNumber: number
  ): AudioPacket {
    return {
      header: {
        version: 1,
        type: PacketType.AUDIO_PCM,
        streamId,
        sequenceNumber,
        timestamp: BigInt(Date.now() * 1000), // microseconds
        flags: PacketFlags.NONE,
        length: audio.length * 4 // bytes
      },
      payload: {
        audioData: audio,
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm',
        duration: (audio.length / 16000) * 1000 // ms
      },
      metadata: {
        priority: PacketPriority.HIGH,
        ttl: 1000,
        retryCount: 0
      }
    };
  }
  
  static createTextPacket(
    text: string,
    isFinal: boolean,
    streamId: StreamID,
    sequenceNumber: number
  ): TextPacket {
    return {
      header: {
        version: 1,
        type: isFinal ? PacketType.TEXT_FINAL : PacketType.TEXT_PARTIAL,
        streamId,
        sequenceNumber,
        timestamp: BigInt(Date.now() * 1000),
        flags: PacketFlags.NONE,
        length: new TextEncoder().encode(text).length
      },
      payload: {
        text,
        confidence: 1.0,
        isFinal,
        language: 'en',
      },
      metadata: {
        priority: PacketPriority.NORMAL,
        ttl: 5000,
        retryCount: 0
      }
    };
  }
  
  static fragmentPacket(packet: Packet, maxSize: number): Packet[] {
    const encoded = PacketEncoder.encode(packet);
    
    if (encoded.length <= maxSize) {
      return [packet];
    }
    
    const fragments: Packet[] = [];
    const fragmentSize = maxSize - 100; // Reserve space for header
    const totalFragments = Math.ceil(encoded.length / fragmentSize);
    
    for (let i = 0; i < totalFragments; i++) {
      const start = i * fragmentSize;
      const end = Math.min(start + fragmentSize, encoded.length);
      const fragmentData = encoded.slice(start, end);
      
      fragments.push({
        header: {
          ...packet.header,
          flags: packet.header.flags | PacketFlags.FRAGMENTED |
                 (i === totalFragments - 1 ? PacketFlags.FINAL_FRAGMENT : 0),
          length: fragmentData.length
        },
        payload: fragmentData,
        metadata: {
          ...packet.metadata!,
          fragmentInfo: {
            fragmentId: i,
            totalFragments,
            originalLength: encoded.length
          }
        }
      });
    }
    
    return fragments;
  }
  
  static reassemblePackets(fragments: Packet[]): Packet {
    // Sort fragments by ID
    fragments.sort((a, b) => 
      a.metadata!.fragmentInfo!.fragmentId - b.metadata!.fragmentInfo!.fragmentId
    );
    
    // Combine payloads
    const totalLength = fragments[0].metadata!.fragmentInfo!.originalLength;
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const fragment of fragments) {
      const data = fragment.payload as Uint8Array;
      combined.set(data, offset);
      offset += data.length;
    }
    
    // Decode the reassembled packet
    return PacketDecoder.decode(combined);
  }
  
  static calculateChecksum(packet: Packet): number {
    // Simple CRC32 implementation
    const data = PacketEncoder.encode(packet);
    let crc = 0xFFFFFFFF;
    
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    
    return ~crc >>> 0;
  }
}