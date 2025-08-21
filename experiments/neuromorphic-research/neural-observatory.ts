/**
 * Neural Observatory - Real-time visualization and monitoring
 * 
 * WebSocket-based observability for the neuromorphic packet network,
 * streaming live data for visualization dashboards.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import {
  NeuralPacket,
  CognitiveAS,
  DSCP,
  OscillationBand,
  InterferencePattern,
  RaceResult,
  SynapticWeight
} from './neural-packet-types';

// ============================================================================
// TELEMETRY TYPES
// ============================================================================

export interface TelemetryPacket {
  type: TelemetryType;
  timestamp: number;
  data: any;
}

export enum TelemetryType {
  // Packet events
  PACKET_SENT = 'packet_sent',
  PACKET_RECEIVED = 'packet_received',
  PACKET_DROPPED = 'packet_dropped',
  PACKET_RACED = 'packet_raced',
  
  // Neural events
  SPIKE = 'spike',
  BURST = 'burst',
  BINDING = 'binding',
  INTERFERENCE = 'interference',
  
  // Learning events
  SYNAPSE_STRENGTHENED = 'synapse_strengthened',
  SYNAPSE_WEAKENED = 'synapse_weakened',
  ROUTE_LEARNED = 'route_learned',
  
  // System metrics
  METRICS = 'metrics',
  BRAIN_ACTIVITY = 'brain_activity',
  QOS_UPDATE = 'qos_update',
  OSCILLATION = 'oscillation'
}

export interface BrainActivityData {
  regions: Map<CognitiveAS, number>; // Activity level 0-1
  connections: Array<{
    from: CognitiveAS;
    to: CognitiveAS;
    strength: number;
    active: boolean;
  }>;
  dominantFrequency: number;
  phase: number;
}

export interface MetricsData {
  packetsPerSecond: number;
  averageLatency: number;
  winRate: Map<string, number>;
  qosDistribution: Map<DSCP, number>;
  totalSynapses: number;
  averageSynapticStrength: number;
  gammaCoherence: number;
  attentionFocus: string;
}

export interface OscillationData {
  band: OscillationBand;
  frequency: number;
  amplitude: number;
  phase: number;
  coherence: number;
  samples: number[]; // Waveform samples
}

// ============================================================================
// NEURAL OBSERVATORY
// ============================================================================

export class NeuralObservatory extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private metricsInterval: NodeJS.Timeout | null = null;
  private telemetryBuffer: TelemetryPacket[] = [];
  private readonly BUFFER_SIZE = 10000;
  private readonly METRICS_INTERVAL = 100; // ms
  
  // Aggregated metrics
  private packetCount = 0;
  private spikeCount = 0;
  private totalLatency = 0;
  private brainActivity: Map<CognitiveAS, number> = new Map();
  private oscillationSamples: Map<OscillationBand, number[]> = new Map();
  
  constructor(private port: number = 8888) {
    super();
    this.initializeBrainRegions();
  }
  
  /**
   * Start the observatory WebSocket server
   */
  async start(): Promise<void> {
    this.wss = new WebSocketServer({ port: this.port });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log(`[Observatory] New client connected. Total: ${this.clients.size + 1}`);
      this.clients.add(ws);
      
      // Send initial state
      this.sendInitialState(ws);
      
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[Observatory] Client disconnected. Total: ${this.clients.size}`);
      });
      
      ws.on('error', (err) => {
        console.error('[Observatory] WebSocket error:', err);
        this.clients.delete(ws);
      });
      
      // Handle client commands
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientCommand(message, ws);
        } catch (err) {
          console.error('[Observatory] Invalid message:', err);
        }
      });
    });
    
    // Start metrics collection
    this.startMetricsCollection();
    
    console.log(`[Observatory] Started on ws://localhost:${this.port}`);
  }
  
  /**
   * Stop the observatory
   */
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    this.clients.forEach(ws => ws.close());
    this.clients.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
  
  // ========== TELEMETRY RECORDING ==========
  
  /**
   * Record a packet event
   */
  recordPacket(packet: NeuralPacket, event: 'sent' | 'received' | 'dropped'): void {
    this.packetCount++;
    
    const telemetry: TelemetryPacket = {
      type: event === 'sent' ? TelemetryType.PACKET_SENT :
            event === 'received' ? TelemetryType.PACKET_RECEIVED :
            TelemetryType.PACKET_DROPPED,
      timestamp: Date.now(),
      data: {
        id: packet.id,
        streamId: packet.streamId,
        amplitude: packet.amplitude,
        frequency: packet.frequency,
        phase: packet.phase,
        qos: packet.qos,
        path: packet.path
      }
    };
    
    this.bufferTelemetry(telemetry);
    this.broadcast(telemetry);
    
    // Update brain activity
    if (packet.path) {
      packet.path.intermediates.forEach(region => {
        const as = parseInt(region) as CognitiveAS;
        const current = this.brainActivity.get(as) || 0;
        this.brainActivity.set(as, Math.min(1, current + 0.1));
      });
    }
  }
  
  /**
   * Record a spike event
   */
  recordSpike(neuronId: string, amplitude: number, frequency: number): void {
    this.spikeCount++;
    
    const telemetry: TelemetryPacket = {
      type: TelemetryType.SPIKE,
      timestamp: Date.now(),
      data: {
        neuronId,
        amplitude,
        frequency,
        time: Date.now()
      }
    };
    
    this.bufferTelemetry(telemetry);
    this.broadcast(telemetry);
  }
  
  /**
   * Record a race result
   */
  recordRace(winner: RaceResult, participants: RaceResult[]): void {
    const telemetry: TelemetryPacket = {
      type: TelemetryType.PACKET_RACED,
      timestamp: Date.now(),
      data: {
        winnerId: winner.thought.id,
        winnerTime: winner.raceTime,
        winnerPath: winner.path,
        participants: participants.map(p => ({
          id: p.thought.id,
          time: p.raceTime,
          qos: p.thought.qos.dscp
        }))
      }
    };
    
    this.bufferTelemetry(telemetry);
    this.broadcast(telemetry);
    
    this.totalLatency += winner.raceTime;
  }
  
  /**
   * Record gamma burst
   */
  recordBurst(packets: NeuralPacket[]): void {
    const telemetry: TelemetryPacket = {
      type: TelemetryType.BURST,
      timestamp: Date.now(),
      data: {
        size: packets.length,
        frequency: 40, // Gamma
        coherence: this.calculateCoherence(packets),
        amplitude: packets.reduce((sum, p) => sum + p.amplitude, 0) / packets.length
      }
    };
    
    this.bufferTelemetry(telemetry);
    this.broadcast(telemetry);
  }
  
  /**
   * Record interference pattern
   */
  recordInterference(pattern: InterferencePattern): void {
    const telemetry: TelemetryPacket = {
      type: TelemetryType.INTERFERENCE,
      timestamp: Date.now(),
      data: pattern
    };
    
    this.bufferTelemetry(telemetry);
    this.broadcast(telemetry);
  }
  
  /**
   * Record synaptic change
   */
  recordSynapticChange(
    path: string,
    oldWeight: number,
    newWeight: number
  ): void {
    const telemetry: TelemetryPacket = {
      type: newWeight > oldWeight 
        ? TelemetryType.SYNAPSE_STRENGTHENED 
        : TelemetryType.SYNAPSE_WEAKENED,
      timestamp: Date.now(),
      data: {
        path,
        oldWeight,
        newWeight,
        change: newWeight - oldWeight
      }
    };
    
    this.bufferTelemetry(telemetry);
    this.broadcast(telemetry);
  }
  
  /**
   * Record oscillation samples
   */
  recordOscillation(band: OscillationBand, samples: number[]): void {
    // Store samples for visualization
    let stored = this.oscillationSamples.get(band) || [];
    stored.push(...samples);
    
    // Keep only recent samples (1 second worth at 1000Hz)
    if (stored.length > 1000) {
      stored = stored.slice(-1000);
    }
    
    this.oscillationSamples.set(band, stored);
    
    // Calculate oscillation metrics
    const amplitude = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
    const frequency = this.estimateFrequency(samples);
    
    const telemetry: TelemetryPacket = {
      type: TelemetryType.OSCILLATION,
      timestamp: Date.now(),
      data: {
        band,
        frequency,
        amplitude,
        phase: 0, // Would need phase extraction
        coherence: 0, // Would need coherence calculation
        samples: samples.slice(-100) // Last 100 samples for waveform
      } as OscillationData
    };
    
    this.broadcast(telemetry);
  }
  
  // ========== METRICS COLLECTION ==========
  
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectAndBroadcastMetrics();
      this.updateBrainActivity();
    }, this.METRICS_INTERVAL);
  }
  
  private collectAndBroadcastMetrics(): void {
    const metrics: MetricsData = {
      packetsPerSecond: (this.packetCount * 1000) / this.METRICS_INTERVAL,
      averageLatency: this.packetCount > 0 ? this.totalLatency / this.packetCount : 0,
      winRate: new Map(), // Would be populated from race results
      qosDistribution: this.getQoSDistribution(),
      totalSynapses: 0, // Would come from Hebbian module
      averageSynapticStrength: 0, // Would come from Hebbian module
      gammaCoherence: this.calculateGammaCoherence(),
      attentionFocus: this.getCurrentFocus()
    };
    
    const telemetry: TelemetryPacket = {
      type: TelemetryType.METRICS,
      timestamp: Date.now(),
      data: metrics
    };
    
    this.broadcast(telemetry);
    
    // Reset counters
    this.packetCount = 0;
    this.spikeCount = 0;
    this.totalLatency = 0;
  }
  
  private updateBrainActivity(): void {
    // Decay brain activity over time
    this.brainActivity.forEach((activity, region) => {
      this.brainActivity.set(region, activity * 0.95);
    });
    
    // Create connections based on activity
    const connections: any[] = [];
    const regions = Array.from(this.brainActivity.keys());
    
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const activity1 = this.brainActivity.get(regions[i]) || 0;
        const activity2 = this.brainActivity.get(regions[j]) || 0;
        
        if (activity1 > 0.1 && activity2 > 0.1) {
          connections.push({
            from: regions[i],
            to: regions[j],
            strength: (activity1 + activity2) / 2,
            active: true
          });
        }
      }
    }
    
    const brainData: BrainActivityData = {
      regions: this.brainActivity,
      connections,
      dominantFrequency: 40, // Would calculate from oscillations
      phase: 0
    };
    
    const telemetry: TelemetryPacket = {
      type: TelemetryType.BRAIN_ACTIVITY,
      timestamp: Date.now(),
      data: brainData
    };
    
    this.broadcast(telemetry);
  }
  
  // ========== HELPER METHODS ==========
  
  private initializeBrainRegions(): void {
    // Initialize all brain regions with baseline activity
    Object.values(CognitiveAS).forEach(as => {
      if (typeof as === 'number') {
        this.brainActivity.set(as, 0.1);
      }
    });
  }
  
  private bufferTelemetry(packet: TelemetryPacket): void {
    this.telemetryBuffer.push(packet);
    if (this.telemetryBuffer.length > this.BUFFER_SIZE) {
      this.telemetryBuffer.shift();
    }
  }
  
  private broadcast(packet: TelemetryPacket): void {
    const message = JSON.stringify(packet);
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
  
  private sendInitialState(ws: WebSocket): void {
    // Send recent telemetry buffer
    const recentData = {
      type: 'initial_state',
      telemetry: this.telemetryBuffer.slice(-100),
      brainRegions: Array.from(this.brainActivity.keys()),
      timestamp: Date.now()
    };
    
    ws.send(JSON.stringify(recentData));
  }
  
  private handleClientCommand(message: any, ws: WebSocket): void {
    switch (message.command) {
      case 'get_history':
        ws.send(JSON.stringify({
          type: 'history',
          data: this.telemetryBuffer
        }));
        break;
        
      case 'clear_history':
        this.telemetryBuffer = [];
        break;
        
      case 'get_oscillations':
        ws.send(JSON.stringify({
          type: 'oscillations',
          data: Object.fromEntries(this.oscillationSamples)
        }));
        break;
    }
  }
  
  private calculateCoherence(packets: NeuralPacket[]): number {
    if (packets.length < 2) return 1;
    
    let sumCos = 0;
    let sumSin = 0;
    
    packets.forEach(p => {
      sumCos += Math.cos(p.phase);
      sumSin += Math.sin(p.phase);
    });
    
    const avgCos = sumCos / packets.length;
    const avgSin = sumSin / packets.length;
    
    return Math.sqrt(avgCos * avgCos + avgSin * avgSin);
  }
  
  private estimateFrequency(samples: number[]): number {
    // Simple zero-crossing frequency estimation
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        crossings++;
      }
    }
    
    const duration = samples.length / 1000; // Assuming 1kHz sampling
    return (crossings / 2) / duration;
  }
  
  private getQoSDistribution(): Map<DSCP, number> {
    // Would be populated from actual packet data
    const distribution = new Map<DSCP, number>();
    distribution.set(DSCP.CONSCIOUS_THOUGHT, 5);
    distribution.set(DSCP.ATTENTION_FOCUS, 15);
    distribution.set(DSCP.WORKING_MEMORY, 25);
    distribution.set(DSCP.BACKGROUND_PROCESS, 30);
    distribution.set(DSCP.SUBCONSCIOUS, 20);
    distribution.set(DSCP.DEFAULT, 5);
    return distribution;
  }
  
  private calculateGammaCoherence(): number {
    const gammaSamples = this.oscillationSamples.get(OscillationBand.GAMMA) || [];
    if (gammaSamples.length < 100) return 0;
    
    // Simple coherence estimate based on amplitude consistency
    const mean = gammaSamples.reduce((a, b) => a + b, 0) / gammaSamples.length;
    const variance = gammaSamples.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / gammaSamples.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower variance = higher coherence
    return Math.max(0, 1 - (stdDev / (Math.abs(mean) + 0.001)));
  }
  
  private getCurrentFocus(): string {
    // Find brain region with highest activity
    let maxActivity = 0;
    let focusRegion = 'none';
    
    this.brainActivity.forEach((activity, region) => {
      if (activity > maxActivity) {
        maxActivity = activity;
        focusRegion = CognitiveAS[region] || region.toString();
      }
    });
    
    return focusRegion;
  }
  
  /**
   * Get current statistics
   */
  getStatistics(): any {
    return {
      connectedClients: this.clients.size,
      telemetryBufferSize: this.telemetryBuffer.length,
      totalSpikes: this.spikeCount,
      brainRegions: this.brainActivity.size,
      oscillationBands: this.oscillationSamples.size
    };
  }
}