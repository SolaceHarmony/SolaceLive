/**
 * Packet WebSocket Server (MLX-backed)
 * Always uses MLX + TypeScript Moshi/Mimi components (no simulation).
 */

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';

// MLX + Moshi/Mimi (TypeScript)
import mlx from '@frost-beta/mlx';
import { Mimi, createMimiConfig } from '../../models/moshi-mlx/mimi';
import { LmModel, createLmConfigFromDict } from '../../models/moshi-mlx/lm';

// ===== Packet Protocol (same layout as client) =====
enum PacketType {
  AUDIO_CHUNK = 0x10,
  TEXT_PARTIAL = 0x20,
  TEXT_FINAL = 0x21,
  METADATA = 0x30,
  HEARTBEAT = 0x01,
  ACK = 0x02,
}

enum Priority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

type Packet = {
  type: PacketType;
  priority: Priority;
  sequenceNumber: number;
  timestamp: number;
  data: Uint8Array;
  requiresAck?: boolean;
};

class PacketCodec {
  static encode(packet: Packet): Buffer {
    const header = Buffer.alloc(17);
    header.writeUInt8(packet.type, 0);
    header.writeUInt8(packet.priority, 1);
    header.writeUInt32LE(packet.sequenceNumber, 2);
    header.writeDoubleLE(packet.timestamp, 6);
    header.writeUInt16LE(packet.data.length, 14);
    header.writeUInt8(packet.requiresAck ? 1 : 0, 16);
    return Buffer.concat([header, Buffer.from(packet.data.buffer, packet.data.byteOffset, packet.data.byteLength)]);
  }
  static decode(data: Buffer): Packet {
    const v = new DataView(data.buffer, data.byteOffset, 17);
    const pkt: Packet = {
      type: v.getUint8(0),
      priority: v.getUint8(1),
      sequenceNumber: v.getUint32(2, true),
      timestamp: v.getFloat64(6, true),
      data: new Uint8Array(data.buffer, data.byteOffset + 17, data.length - 17),
      requiresAck: v.getUint8(16) === 1,
    } as Packet;
    return pkt;
  }
}

// ===== MLX-backed engine =====
const SAMPLE_RATE = 24000;

type ClientState = {
  id: string;
  seq: number;
  lastHeartbeat: number;
  // Accumulated conversation state
  textTokens: number[]; // running text token ids
  audioCodes: number[][]; // [codebook][time]
  generatedAudio: number[][]; // generated audio tokens per codebook
  prevAudioLengths: number[]; // track new steps per codebook
  padTextId: number; // from config
  lmCache: Map<string, any>;
};

class PacketWebSocketServer {
  private port: number;
  private app = express();
  private server = createServer(this.app);
  private wss = new WebSocketServer({ server: this.server });
  private clients = new Map<string, { ws: any; state: ClientState }>();
  private sequenceNumber = 0;

  // MLX models
  private mimi: Mimi;
  private lm: LmModel;
  private textVocab: number;
  private audioCodebooks: number;
  private metrics = {
    encodeCount: 0,
    encodeTotalMs: 0,
    stepCount: 0,
    stepTotalMs: 0,
    decodeCount: 0,
    decodeTotalMs: 0,
    overBudgetCount: 0,
    lastEncodeMs: 0,
    lastStepMs: 0,
    lastDecodeMs: 0,
  };
  private readonly STEP_BUDGET_MS = 80;

  constructor(port = 8788) {
    this.port = port;

    // Setup HTTP
    this.app.use(cors());
    this.app.use(express.json());
    this.app.get('/health', (req, res) => res.json({
      status: 'healthy',
      clients: this.clients.size,
      uptime: process.uptime(),
      metrics: this.getMetrics()
    }));

    // Initialize MLX-backed components synchronously on startup
    const cfgPath = path.join(process.cwd(), 'lib/unified/configs/moshi_mlx_2b.json');
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const cfgDict = JSON.parse(raw);
    const lmCfg = createLmConfigFromDict(cfgDict);
    this.textVocab = lmCfg.text_in_vocab_size;
    this.audioCodebooks = lmCfg.audio_codebooks;

    this.mimi = new Mimi(createMimiConfig());
    this.lm = new LmModel(lmCfg);

    // Initialize model weights (random if none provided)
    this.lm.init().then(() => {
      console.log('[PacketServer] MLX LmModel initialized');
    }).catch((e) => {
      console.error('[PacketServer] Failed to initialize LmModel:', e);
    });

    // Setup WebSocket
    this.setupWS();
  }

  private setupWS() {
    this.wss.on('connection', (ws, req) => {
      const id = 'client_' + Math.random().toString(36).slice(2, 9);
      console.log(`[PacketServer] Client ${id} connected`);

      const padId: number = (cfgDict.existing_text_padding_id ?? 0);
      const state: ClientState = {
        id,
        seq: 0,
        lastHeartbeat: Date.now(),
        textTokens: [],
        audioCodes: Array.from({ length: this.audioCodebooks }, () => []),
        generatedAudio: Array.from({ length: this.audioCodebooks }, () => []),
        prevAudioLengths: Array.from({ length: this.audioCodebooks }, () => 0),
        padTextId: padId,
        lmCache: new Map<string, any>(),
      };
      this.clients.set(id, { ws, state });

      try {
        this.mimi.setNumCodebooks(this.audioCodebooks);
        this.mimi.streaming(1);
      } catch (e) {
        console.warn('[PacketServer] Mimi streaming init warning:', e);
      }

      // Send connection metadata
      this.sendMetadata(ws, {
        type: 'connection_established',
        serverTime: Date.now(),
        sampleRate: SAMPLE_RATE,
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const pkt = PacketCodec.decode(data);
          await this.handlePacket(id, ws, pkt);
          if (pkt.requiresAck) this.sendAck(ws, pkt.sequenceNumber);
        } catch (e) {
          console.error('[PacketServer] message error', e);
        }
      });

      ws.on('close', () => {
        console.log(`[PacketServer] Client ${id} disconnected`);
        this.clients.delete(id);
      });
    });
  }

  private async handlePacket(id: string, ws: any, pkt: Packet) {
    const client = this.clients.get(id);
    if (!client) return;
    const { state } = client;

    switch (pkt.type) {
      case PacketType.AUDIO_CHUNK: {
        // Incoming Float32Array samples
        const f32 = new Float32Array(pkt.data.buffer, pkt.data.byteOffset, Math.floor(pkt.data.byteLength / 4));
        // Encode to Mimi tokens (if weights loaded)
        try {
          const t0 = Date.now();
          const tokens = await this.mimi.encode(f32);
          const dt = Date.now() - t0;
          this.metrics.encodeCount++;
          this.metrics.encodeTotalMs += dt;
          this.metrics.lastEncodeMs = dt;
          for (let cb = 0; cb < tokens.length; cb++) {
            state.audioCodes[cb].push(...tokens[cb]);
          }
        } catch (e) {
          // No simulation: if encode not available, skip audio update
          console.warn('[PacketServer] Mimi.encode unavailable:', (e as Error).message);
        }
        // Drive MLX generation step
        await this.stepGenerate(ws, state);
        break;
      }
      case PacketType.TEXT_FINAL: {
        // Audio model focus: ignore free-form text by default.
        break;
      }
      case PacketType.TEXT_PARTIAL: {
        // ignore partials for now
        break;
      }
      case PacketType.METADATA: {
        // acknowledge metadata with server capabilities
        this.sendMetadata(ws, { type: 'conversation_acknowledged', capabilities: { mlx: true, moshi: true, mimi: true } });
        break;
      }
      case PacketType.HEARTBEAT: {
        this.sendHeartbeat(ws);
        break;
      }
    }
  }

  private async stepGenerate(ws: any, state: ClientState) {
    const newSteps = this.computeNewSteps(state);
    if (newSteps <= 0) return;
    const mx = mlx.core;
    for (let s = 0; s < newSteps; s++) {
      const textToken = mx.array([[state.padTextId]]);
      const audioStep: any[] = [];
      for (let cb = 0; cb < this.audioCodebooks; cb++) {
        const idx = (state.prevAudioLengths[cb] ?? 0) + s;
        const tok = state.audioCodes[cb][idx] ?? 0;
        audioStep.push(mx.array([[tok]]));
      }
      try {
        const tStep0 = Date.now();
        const { next_text, next_audio } = this.lm.step(textToken, audioStep, state.lmCache);
        const stepMs = Date.now() - tStep0;
        this.metrics.stepCount++;
        this.metrics.stepTotalMs += stepMs;
        this.metrics.lastStepMs = stepMs;
        if (stepMs > this.STEP_BUDGET_MS) this.metrics.overBudgetCount++;
        // Append generated tokens
        for (let cb = 0; cb < next_audio.length; cb++) {
          const v = (next_audio[cb].tolist() as number[][])[0][0];
          state.generatedAudio[cb].push(v);
        }
        // Optional: stream text id
        const textId = (next_text.tolist() as number[][])[0][0];
        this.sendTextPartial(ws, String(textId));

        // Decode and stream a single audio frame
        try {
          const perCb = state.generatedAudio.map(arr => [arr[arr.length - 1]]);
          const tDec0 = Date.now();
          const audioFrame = await this.mimi.decode(perCb);
          const decMs = Date.now() - tDec0;
          this.metrics.decodeCount++;
          this.metrics.decodeTotalMs += decMs;
          this.metrics.lastDecodeMs = decMs;
          if (audioFrame && audioFrame.length) this.sendAudio(ws, audioFrame);
        } catch {}
      } catch {
        break;
      }
    }
    for (let cb = 0; cb < this.audioCodebooks; cb++) {
      state.prevAudioLengths[cb] = (state.prevAudioLengths[cb] ?? 0) + newSteps;
    }
  }

  private getMetrics() {
    const avg = (sum: number, n: number) => (n > 0 ? sum / n : 0);
    return {
      encode: {
        count: this.metrics.encodeCount,
        avgMs: avg(this.metrics.encodeTotalMs, this.metrics.encodeCount),
        lastMs: this.metrics.lastEncodeMs,
      },
      step: {
        count: this.metrics.stepCount,
        avgMs: avg(this.metrics.stepTotalMs, this.metrics.stepCount),
        lastMs: this.metrics.lastStepMs,
        overBudget: this.metrics.overBudgetCount,
        budgetMs: this.STEP_BUDGET_MS,
      },
      decode: {
        count: this.metrics.decodeCount,
        avgMs: avg(this.metrics.decodeTotalMs, this.metrics.decodeCount),
        lastMs: this.metrics.lastDecodeMs,
      }
    };
  }
  private computeNewSteps(state: ClientState): number {
    let minNew = Infinity;
    for (let cb = 0; cb < this.audioCodebooks; cb++) {
      const cur = state.audioCodes[cb].length;
      const prev = state.prevAudioLengths[cb] ?? 0;
      const delta = cur - prev;
      if (delta < minNew) minNew = delta;
    }
    return Number.isFinite(minNew) && minNew > 0 ? minNew : 0;
  }

  private mxTail(arr: any, prevLen: number): number[] {
    const total = arr.shape[1];
    const slice = arr.slice([0, [prevLen, total]]); // [1, n]
    const list = (slice.tolist() as number[][])[0] || [];
    return list;
  }

  // No text mapping: audio-first server.

  // ===== Packet send helpers =====
  private sendAudio(ws: any, f32: Float32Array) {
    const pkt: Packet = {
      type: PacketType.AUDIO_CHUNK,
      priority: Priority.CRITICAL,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: new Uint8Array(f32.buffer),
      requiresAck: false,
    };
    ws.send(PacketCodec.encode(pkt));
  }

  private sendTextPartial(ws: any, text: string) {
    const data = new TextEncoder().encode(text);
    const pkt: Packet = {
      type: PacketType.TEXT_PARTIAL,
      priority: Priority.NORMAL,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data,
      requiresAck: false,
    };
    ws.send(PacketCodec.encode(pkt));
  }

  private sendMetadata(ws: any, obj: Record<string, unknown>) {
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const pkt: Packet = {
      type: PacketType.METADATA,
      priority: Priority.LOW,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data,
      requiresAck: false,
    };
    ws.send(PacketCodec.encode(pkt));
  }

  private sendHeartbeat(ws: any) {
    const pkt: Packet = {
      type: PacketType.HEARTBEAT,
      priority: Priority.LOW,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: new Uint8Array(0),
      requiresAck: false,
    };
    ws.send(PacketCodec.encode(pkt));
  }

  private sendAck(ws: any, seq: number) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, seq, true);
    const pkt: Packet = {
      type: PacketType.ACK,
      priority: Priority.HIGH,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: new Uint8Array(buf),
      requiresAck: false,
    };
    ws.send(PacketCodec.encode(pkt));
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`[PacketServer] MLX Packet Server running on :${this.port}`);
    });
  }
}

// Bootstrap
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8788;
  const server = new PacketWebSocketServer(port);
  server.start();
}
