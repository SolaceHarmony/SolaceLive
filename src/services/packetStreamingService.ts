/**
 * Packet-based streaming service for SolaceLive
 * Replaces fetch-based streaming with packet WebSocket for better real-time performance
 */

import { PacketWebSocket, SolaceLivePacketClient } from '../lib/packet-websocket';

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

export interface StreamingConfig {
  serverUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  audioFormat?: 'wav' | 'mp3';
  sampleRate?: number;
}

export interface AudioStreamOptions {
  usePacketProtocol?: boolean;
  bufferSize?: number;
  latencyOptimization?: boolean;
}

export class PacketStreamingService extends EventEmitter {
  private packetClient: SolaceLivePacketClient | null = null;
  private isConnected: boolean = false;
  private config: StreamingConfig;
  private audioQueue: ArrayBuffer[] = [];
  private textBuffer: string = '';
  private isStreaming: boolean = false;

  constructor(config: StreamingConfig = {}) {
    super();
    const defaultWsBase = typeof window !== 'undefined'
      ? (window.location.origin.replace(/^http/, 'ws') + '/packet')
      : 'ws://localhost:8788';
    this.config = {
      serverUrl: defaultWsBase,
      model: 'gemma3-csm-3',
      temperature: 0.8,
      maxTokens: 2048,
      audioFormat: 'wav',
      sampleRate: 24000,
      ...config
    };
  }

  /**
   * Connect to packet WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      this.packetClient = new SolaceLivePacketClient(this.config.serverUrl);
      await this.packetClient.connect();
      
      this.setupPacketHandlers();
      this.isConnected = true;
      
      this.emit('connected');
      console.log('[PacketStreaming] Connected to server');
    } catch (error) {
      console.error('[PacketStreaming] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Start streaming conversation with packet protocol
   */
  async startStreamingConversation(
    userText: string,
    userAudio?: ArrayBuffer,
    options: AudioStreamOptions = {}
  ): Promise<void> {
    if (!this.isConnected || !this.packetClient) {
      throw new Error('Not connected to packet server');
    }

    this.isStreaming = true;
    this.audioQueue = [];
    this.textBuffer = '';

    try {
      // Note: Metadata sending would need to be implemented in SolaceLivePacketClient
      // For now, we'll proceed with text/audio only

      // Send user text
      if (userText) {
        this.packetClient.sendUserText(userText);
      }

      // Send user audio if provided
      if (userAudio) {
        const audioChunks = this.chunkAudioData(userAudio);
        for (const chunk of audioChunks) {
          this.packetClient.sendAudio(chunk);
        }
      }

      this.emit('streamingStarted');
    } catch (error) {
      this.isStreaming = false;
      console.error('[PacketStreaming] Error starting stream:', error);
      throw error;
    }
  }

  /**
   * Send real-time audio chunk during conversation
   */
  sendAudioChunk(audioData: Float32Array): void {
    if (!this.packetClient || !this.isStreaming) {
      return;
    }

    this.packetClient.sendAudio(audioData);
  }

  /**
   * Send partial transcription update
   */
  sendPartialTranscription(text: string): void {
    if (!this.packetClient || !this.isStreaming) {
      return;
    }

    this.packetClient.sendPartialTranscription(text);
  }

  /**
   * Stop current streaming session
   */
  stopStreaming(): void {
    this.isStreaming = false;
    
    // Note: End-of-stream would be handled by the underlying PacketWebSocket

    this.emit('streamingStopped');
  }

  /**
   * Get streaming performance statistics
   */
  getStreamingStats(): any {
    if (!this.packetClient) {
      return null;
    }

    return {
      ...this.packetClient.getPerformanceStats(),
      queueLength: this.audioQueue.length,
      textBufferSize: this.textBuffer.length,
      isStreaming: this.isStreaming
    };
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.packetClient) {
      this.packetClient.close();
      this.packetClient = null;
    }
    
    this.isConnected = false;
    this.isStreaming = false;
    this.emit('disconnected');
  }

  // ========== PRIVATE METHODS ==========

  private setupPacketHandlers(): void {
    if (!this.packetClient) return;

    // Bridge low-level client events to service-level events
    this.packetClient.on('audioChunk', (audioData: Float32Array, timestamp: number) => {
      try {
        const buf = audioData?.buffer ?? new ArrayBuffer(0);
        this.emit('audioChunk', buf, timestamp);
      } catch (e) {
        console.error('[PacketStreaming] audioChunk handler error:', e);
      }
    });

    this.packetClient.on('textPartial', (text: string, timestamp: number) => {
      this.emit('textPartial', text, timestamp);
    });

    this.packetClient.on('textFinal', (text: string, timestamp: number) => {
      this.emit('textFinal', text, timestamp);
    });

    this.packetClient.on('metadata', (metadata: any, timestamp: number) => {
      this.emit('metadata', metadata, timestamp);
    });

    this.packetClient.on('disconnected', () => {
      this.isConnected = false;
      this.emit('disconnected');
    });

    console.log('[PacketStreaming] Event handlers wired');
  }

  private chunkAudioData(audioData: ArrayBuffer, chunkSize: number = 4096): Float32Array[] {
    const float32Data = new Float32Array(audioData);
    const chunks: Float32Array[] = [];
    
    for (let i = 0; i < float32Data.length; i += chunkSize) {
      const chunk = float32Data.slice(i, i + chunkSize);
      chunks.push(chunk);
    }
    
    return chunks;
  }

  // ========== COMPATIBILITY METHODS ==========
  
  /**
   * Compatibility method with existing CSMStreamingService
   */
  async generateStreamingResponse(
    userText: string,
    userAudio: ArrayBuffer,
    onAudioChunk: (audioBuffer: ArrayBuffer) => void,
    onTextChunk?: (text: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    // Simplified implementation for compatibility
    try {
      await this.startStreamingConversation(userText, userAudio);
      
      // Simulate streaming response - in production this would be handled by proper event system
      setTimeout(() => {
        onTextChunk?.('Packet streaming response...');
        onComplete?.();
      }, 1000);
      
    } catch (error) {
      console.error('[PacketStreaming] Error in generateStreamingResponse:', error);
      throw error;
    }
  }

  /**
   * Check if packet streaming is supported/available
   */
  async checkPacketSupport(): Promise<boolean> {
    try {
      const testClient = new SolaceLivePacketClient(this.config.serverUrl);
      await testClient.connect();
      testClient.close();
      return true;
    } catch (error) {
      console.warn('[PacketStreaming] Packet support check failed:', error);
      return false;
    }
  }

  // ========== GETTERS ==========

  get isStreamingActive(): boolean {
    return this.isStreaming;
  }

  get connectionStatus(): boolean {
    return this.isConnected;
  }

  get currentConfig(): StreamingConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create appropriate streaming service
 * Falls back to regular CSM if packet streaming unavailable
 */
export async function createStreamingService(config: StreamingConfig = {}): Promise<PacketStreamingService> {
  const service = new PacketStreamingService(config);
  
  try {
    await service.connect();
    return service;
  } catch (error) {
    console.warn('[PacketStreaming] Falling back to regular streaming:', error);
    throw error; // Let caller handle fallback
  }
}