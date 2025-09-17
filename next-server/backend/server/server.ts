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
import { Buffer } from 'buffer';
import { TextEncoder } from 'util';
import { setInterval as setNodeInterval, clearInterval as clearNodeInterval } from 'node:timers';

// MLX + Moshi/Mimi (TypeScript)
import mlx from '@frost-beta/mlx';
import { Mimi, createMimiConfig } from '../models/moshi-mlx/mimi';
import { LmModel, createLmConfigFromDict } from '../models/moshi-mlx/lm';
import { validateFromConfig, loadAllLmWeights, resolveMimiWeights } from '../models/moshi-mlx/weights/loader';
import { loadLmFromGGUF, createTextOnlyLmConfigFromGGUF } from '../models/gguf/gguf';
import { sampleNextToken } from '../models/sampling';

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
const FRAME_RATE = 12.5;
const FRAME_SIZE = Math.round(SAMPLE_RATE / FRAME_RATE);

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

export class PacketWebSocketServer {
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
  private padTextId: number = 0;
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
    underrunCount: 0,
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
      readiness: {
        lm: this.lm?.isReady?.() ?? false,
        mimi: this.mimi?.isReady?.() ?? false,
      },
      metrics: this.getMetrics()
    }));
    this.app.get('/weights', (req, res) => {
      const lm = (this.lm as any);
      const info = typeof lm?.debugInfo === 'function' ? lm.debugInfo() : { ready: this.lm?.isReady?.() ?? false };
      const mimiAny = (this.mimi as any);
      const mimiInfo = typeof mimiAny?.debugInfo === 'function' ? mimiAny.debugInfo() : { ready: this.mimi?.isReady?.() ?? false };
      res.json({ lm: info, mimi: mimiInfo });
    });


    // LM profiling endpoint: measures per-step latency for text generation
    this.app.get('/profile/lm', async (req, res) => {
      try {
        if (!(this.lm?.isReady?.())) {
          return res.status(503).json({ ok: false, error: 'LM not ready' });
        }
        const steps = Math.max(1, Math.min(1000, parseInt(String(req.query.steps ?? '16'), 10) || 16));
        const warmup = Math.max(0, Math.min(100, parseInt(String(req.query.warmup ?? '2'), 10) || 2));
        const returnPerStep = String(req.query.timer ?? req.query.debug ?? '1') !== '0';

        const mx = mlx.core;
        const tokens: number[] = [];
        const perStepMs: number[] = [];
        const cache = new Map<string, any>();
        cache.set('transformer', new Map<number, Map<string, any>>());

        // Prepare static audio tokens per codebook (zeros) if any codebooks exist
        const audioTokens: any[] = [];
        for (let cb = 0; cb < this.audioCodebooks; cb++) {
          audioTokens.push(mx.array([[0]], 'int32'));
        }
        // Initial text token: padTextId
        let text = mx.array([[this.padTextId | 0]], 'int32');

        // Warmup iterations (don’t time)
        for (let i = 0; i < warmup; i++) {
          const { next_text } = this.lm.step(text, audioTokens, cache);
          text = mx.expand_dims(next_text, 1);
        }

        const tAll0 = Date.now();
        for (let i = 0; i < steps; i++) {
          const t0 = Date.now();
          const { next_text } = this.lm.step(text, audioTokens, cache);
          const dt = Date.now() - t0;
          if (returnPerStep) perStepMs.push(dt);
          const id = (next_text.tolist() as number[][])[0][0];
          tokens.push(id);
          text = mx.expand_dims(next_text, 1);
        }
        const totalMs = Date.now() - tAll0;
        const avgMs = returnPerStep && perStepMs.length > 0 ? perStepMs.reduce((a, b) => a + b, 0) / perStepMs.length : (steps ? totalMs / steps : 0);

        return res.json({ ok: true, steps, warmup, totalMs, avgMs, perStepMs: returnPerStep ? perStepMs : undefined, tokens });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ ok: false, error: message });
      }
    });

    // Initialize MLX-backed components synchronously on startup
    const cfgPath = path.join(process.cwd(), 'backend/configs/moshi_mlx_2b.json');
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const cfgDict = JSON.parse(raw);
    // Default LM config from moshi file; may be overridden by GGUF path
    let lmCfg = createLmConfigFromDict(cfgDict);
    this.textVocab = lmCfg.text_in_vocab_size;
    this.audioCodebooks = lmCfg.audio_codebooks;
    this.padTextId = (cfgDict.existing_text_padding_id ?? 0) as number;

    this.mimi = new Mimi(createMimiConfig());
    this.lm = new LmModel(lmCfg);

    // Validate and optionally load LM weights subset from HF if configured
    const lmRepo = process.env.LM_REPO;
    const mimiRepo = process.env.MIMI_REPO;
    const mimiLocal = process.env.MIMI_LOCAL; // optional local Mimi/codec path (e.g., GGUF or safetensors)
    (async () => {
      try {
        const ggufPath = process.env.LM_GGUF;
        if (ggufPath) {
          console.log('[PacketServer] Using GGUF LM at', ggufPath);
          const { weights, meta } = await loadLmFromGGUF(ggufPath);
          console.log('[PacketServer] GGUF meta:', {
            n_layer: (meta as any).n_layer,
            n_head: (meta as any).n_head,
            n_kv_head: (meta as any).n_kv_head,
            d_model: (meta as any).d_model,
            n_vocab: (meta as any).n_vocab,
            rope_base: (meta as any).rope_base,
            context_length: (meta as any).context_length,
          });
          lmCfg = createTextOnlyLmConfigFromGGUF(meta);
          this.lm = new LmModel(lmCfg);
          this.textVocab = lmCfg.text_in_vocab_size;
          this.audioCodebooks = 0; // text-only mode
          await this.lm.loadWeights(weights);
          console.log('[PacketServer] GGUF LM loaded (text-only mode)');
        } else if (lmRepo) {
          if (mimiRepo) {
            await validateFromConfig(lmRepo, mimiRepo, cfgPath);
            try {
              const mimiPath = await resolveMimiWeights(mimiRepo);
              console.log('[PacketServer] Resolved Mimi weights from HF:', mimiPath);
              try {
                await this.mimi.loadWeights(mimiPath);
                console.log('[PacketServer] Mimi weights loaded');
              } catch (err) {
                console.warn('[PacketServer] Mimi.loadWeights failed:', (err as Error).message);
              }
            } catch (e) {
              console.warn('[PacketServer] Failed to resolve Mimi weights from HF:', (e as Error).message);
            }
          } else if (mimiLocal) {
            // Local Mimi file present; validation/loading is a separate path
            if (!fs.existsSync(mimiLocal)) {
              throw new Error(`MIMI_LOCAL not found at ${mimiLocal}`);
            }
            try {
              const mimiPath = await resolveMimiWeights(mimiLocal);
              console.log('[PacketServer] Using local Mimi file:', mimiPath);
              try {
                await this.mimi.loadWeights(mimiPath);
                console.log('[PacketServer] Mimi weights loaded from local path');
              } catch (err) {
                console.warn('[PacketServer] Mimi.loadWeights (local) failed:', (err as Error).message);
              }
            } catch (e) {
              console.warn('[PacketServer] Failed to resolve local Mimi weights:', (e as Error).message);
            }
          } else {
            console.warn('[PacketServer] MIMI_REPO/MIMI_LOCAL not set; Mimi not loaded (encode/decode will be unavailable)');
          }
          if (!ggufPath) {
            console.log('[PacketServer] Weights validation OK for repos', { lmRepo, mimiRepo });
            const all = await loadAllLmWeights(lmRepo);
            await this.lm.loadWeights(all);
            console.log('[PacketServer] Loaded full LM weights');
          }
        } else {
          console.warn('[PacketServer] LM_REPO not set and no LM_GGUF; starting in degraded mode (models not ready).');
          // Server will run; model calls will throw until weights are loaded.
        }
      } catch (e) {
        console.warn('[PacketServer] Weight validation/loading failed; continuing in degraded mode:', e);
        // Do not exit; health endpoint will report readiness=false.
      }
    })();

    // Setup WebSocket
    this.setupWS();
  }

  private setupWS() {
    this.wss.on('connection', (ws) => {
      const id = 'client_' + Math.random().toString(36).slice(2, 9);
      console.log(`[PacketServer] Client ${id} connected`);

      const state: ClientState = {
        id,
        seq: 0,
        lastHeartbeat: Date.now(),
        textTokens: [],
        audioCodes: Array.from({ length: this.audioCodebooks }, () => []),
        generatedAudio: Array.from({ length: this.audioCodebooks }, () => []),
        prevAudioLengths: Array.from({ length: this.audioCodebooks }, () => 0),
        padTextId: this.padTextId,
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

      // Periodic heartbeat (every 5s)
      const hb = setNodeInterval(() => {
        try { this.sendHeartbeat(ws); } catch (err) {
          console.warn('[PacketServer] Heartbeat send failed:', (err as Error).message);
        }
      }, 5000);

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
        clearNodeInterval(hb);
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
        const sampleCount = Math.floor(pkt.data.byteLength / 4);
        if (sampleCount % FRAME_SIZE !== 0) {
          console.warn(`[PacketServer] AUDIO_CHUNK not aligned to 80ms: ${sampleCount} samples (frame=${FRAME_SIZE})`);
        }
        const f32 = new Float32Array(pkt.data.buffer, pkt.data.byteOffset, sampleCount);
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
          this.metrics.underrunCount++;
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
      try {
        const tStep0 = Date.now();
          const textToken = mx.array([[state.padTextId]], 'int32');
          const audioStep: any[] = [];
          for (let cb = 0; cb < this.audioCodebooks; cb++) {
            const idx = (state.prevAudioLengths[cb] ?? 0) + s;
            const tok = state.audioCodes[cb][idx] ?? 0;
            audioStep.push(mx.array([[tok]], 'int32'));
          }
          const { next_text, next_audio } = this.lm.step(textToken, audioStep, state.lmCache);
          const stepMs = Date.now() - tStep0;
          this.metrics.stepCount++;
          this.metrics.stepTotalMs += stepMs;
          this.metrics.lastStepMs = stepMs;
          if (stepMs > this.STEP_BUDGET_MS) this.metrics.overBudgetCount++;
          for (let cb = 0; cb < next_audio.length; cb++) {
            const v = (next_audio[cb].tolist() as number[][])[0][0];
            state.generatedAudio[cb].push(v);
          }
          const textId = (next_text.tolist() as number[][])[0][0];
          this.sendTextPartial(ws, String(textId));
          try {
            const perCb = state.generatedAudio.map(arr => [arr[arr.length - 1]]);
            const tDec0 = Date.now();
            const audioFrame = await this.mimi.decode(perCb);
            const decMs = Date.now() - tDec0;
            this.metrics.decodeCount++;
            this.metrics.decodeTotalMs += decMs;
            this.metrics.lastDecodeMs = decMs;
            if (audioFrame && audioFrame.length) {
              this.sendAudio(ws, audioFrame);
            } else {
              this.metrics.underrunCount++;
            }
          } catch (err) {
            console.warn('[PacketServer] Mimi.decode unavailable:', (err as Error).message);
            this.metrics.underrunCount++;
          }
      } catch (e) {
        console.error('[PacketServer] stepGenerate error:', e);
        break;
      }
    }
    for (let cb = 0; cb < this.audioCodebooks; cb++) {
      state.prevAudioLengths[cb] = (state.prevAudioLengths[cb] ?? 0) + newSteps;
    }
  }

  private getMetrics() {
    const avg = (sum: number, n: number) => (n > 0 ? sum / n : 0);
    // Compute backlog (available steps) across all clients
    const backlogs: number[] = [];
    this.clients.forEach(({ state }) => {
      try {
        const v = this.computeNewSteps(state);
        if (typeof v === 'number' && isFinite(v)) backlogs.push(v);
      } catch {
        // ignore per-client backlog compute errors
      }
    });
    const backlogAvg = backlogs.length ? backlogs.reduce((a, b) => a + b, 0) / backlogs.length : 0;
    const backlogMin = backlogs.length ? Math.min(...backlogs) : 0;
    const backlogMax = backlogs.length ? Math.max(...backlogs) : 0;

    return {
      __lm: (this.lm?.isReady?.() ?? false),
      __mimi: (this.mimi?.isReady?.() ?? false),
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
        underruns: this.metrics.underrunCount,
      },
      decode: {
        count: this.metrics.decodeCount,
        avgMs: avg(this.metrics.decodeTotalMs, this.metrics.decodeCount),
        lastMs: this.metrics.lastDecodeMs,
      },
      queue: {
        clients: backlogs.length,
        backlogStepsAvg: backlogAvg,
        backlogStepsMin: backlogMin,
        backlogStepsMax: backlogMax,
      }
    };
  }
  private computeNewSteps(state: ClientState): number {
    if (this.audioCodebooks === 0) {
      // Text-only mode: advance one step per tick
      return 1;
    }
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

// ===== Next.js-first Transformer interfaces & helpers =====
export type AttentionConfig = {
  type?: 'sdpa' | 'mha' | 'gqa' | 'mqa';
  kvCache?: boolean;
  ropeScaling?: { type: 'linear' | 'yarn' | 'dynamic'; factor?: number } | null;
  slidingWindow?: number | null;
};

export type GenerationConfig = {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop_tokens?: number[];
};

export interface TransformerEngine {
  isReady(): boolean;
  vocabSize(): number;
  step(textId: number, audioIds?: number[]): Promise<{ nextText: number; nextAudio?: number[] }>;
  generateText(
    startId: number,
    cfg?: GenerationConfig
  ): AsyncGenerator<{ token: number }, void, unknown>;
}

export class MlxTransformerEngine implements TransformerEngine {
  private cache = new Map<string, any>();
  private mx = mlx.core;
  constructor(
    private lm: LmModel,
    private audioCodebooks: number,
    private padTextId: number
  ) {
    this.cache.set('transformer', new Map<number, Map<string, any>>());
  }
  isReady(): boolean { return this.lm?.isReady?.() ?? false; }
  vocabSize(): number {
    // try text_out first, fallback to text_in
    try { return (this as any).lm?.config?.text_out_vocab_size ?? 0; } catch { /* noop */ }
    return 0;
  }
  async step(textId: number, audioIds: number[] = []): Promise<{ nextText: number; nextAudio?: number[] }> {
    const mx = this.mx;
    const text = mx.array([[textId | 0]], 'int32');
    const audio: any[] = [];
    for (let cb = 0; cb < this.audioCodebooks; cb++) {
      const tok = audioIds[cb] ?? 0;
      audio.push(mx.array([[tok | 0]], 'int32'));
    }
    const { next_text, next_audio } = this.lm.step(text, audio, this.cache);
    const t = (next_text.tolist() as number[][])[0][0] | 0;
    const a: number[] = [];
    for (let cb = 0; cb < next_audio.length; cb++) {
      a.push(((next_audio[cb].tolist() as number[][])[0][0]) | 0);
    }
    return { nextText: t, nextAudio: a.length ? a : undefined };
  }
  async *generateText(startId: number, cfg: GenerationConfig = {}): AsyncGenerator<{ token: number }, void, unknown> {
    const max = Math.max(1, cfg.max_tokens ?? 32);
    const history: number[] = [];
    let cur = startId | 0;
    history.push(cur);
    for (let i = 0; i < max; i++) {
      const mx = this.mx;
      const text = mx.array([[cur | 0]], 'int32');
      const audio: any[] = [];
      for (let cb = 0; cb < this.audioCodebooks; cb++) {
        audio.push(mx.array([[0]], 'int32'));
      }
      const { text_logits } = (this.lm as any).stepWithLogits(text, audio, this.cache);
      const logits = (text_logits.tolist() as number[][])[0];
      const nextId = sampleNextToken(logits, history, {
        temperature: cfg.temperature,
        top_p: cfg.top_p,
        top_k: cfg.top_k,
        repetition_penalty: cfg.repetition_penalty,
        frequency_penalty: cfg.frequency_penalty,
        presence_penalty: cfg.presence_penalty,
        stop_tokens: cfg.stop_tokens,
      });
      cur = nextId | 0;
      history.push(cur);
      yield { token: cur };
      if (cfg.stop_tokens && cfg.stop_tokens.includes(cur)) break;
    }
  }
}

/**
 * Create a ready-to-use MLX transformer engine by reading env vars similarly to PacketWebSocketServer.
 * This focuses on text LM; audio is passed-through but not required.
 */
export async function createMlxEngineFromEnv(): Promise<MlxTransformerEngine> {
  // Load base config
  const cfgPath = path.join(process.cwd(), 'backend/configs/moshi_mlx_2b.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  const cfgDict = JSON.parse(raw);
  let lmCfg = createLmConfigFromDict(cfgDict);
  let audioCodebooks = lmCfg.audio_codebooks;
  const padTextId = (cfgDict.existing_text_padding_id ?? 0) as number;
  let lm = new LmModel(lmCfg);

  const lmRepo = process.env.LM_REPO;
  const mimiRepo = process.env.MIMI_REPO; // not required here
  try {
    const ggufPath = process.env.LM_GGUF;
    if (ggufPath) {
      const { weights, meta } = await loadLmFromGGUF(ggufPath);
      lmCfg = createTextOnlyLmConfigFromGGUF(meta);
      lm = new LmModel(lmCfg);
      audioCodebooks = 0;
      await lm.loadWeights(weights);
    } else if (lmRepo) {
      if (mimiRepo) {
        await validateFromConfig(lmRepo, mimiRepo, cfgPath).catch(() => {});
      }
      const all = await loadAllLmWeights(lmRepo);
      await lm.loadWeights(all);
    } else {
      // No weights configured; engine will not be ready
    }
  } catch {
    // run degraded: engine will report not ready
  }
  return new MlxTransformerEngine(lm, audioCodebooks, padTextId);
}

/**
 * Next.js API handler factory for simple text token generation.
 * POST body: { startId?: number; steps?: number; stream?: boolean }
 * If stream=true, responds with text/event-stream streaming tokens.
 */
export function createNextTextGenerateHandler(engine: TransformerEngine) {
  return async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    if (!engine.isReady()) {
      return res.status(503).json({ ok: false, error: 'Engine not ready' });
    }
    const body = (req.body ?? {}) as {
      startId?: number; steps?: number; stream?: boolean;
      temperature?: number; top_p?: number; top_k?: number;
      repetition_penalty?: number; frequency_penalty?: number; presence_penalty?: number;
      stop_tokens?: number[];
    };
    const startId = (body.startId ?? 0) | 0;
    const steps = Math.max(1, Math.min(2048, body.steps ?? 32));
    const stream = !!body.stream;
    const genCfg = {
      max_tokens: steps,
      stream,
      temperature: body.temperature,
      top_p: body.top_p,
      top_k: body.top_k,
      repetition_penalty: body.repetition_penalty,
      frequency_penalty: body.frequency_penalty,
      presence_penalty: body.presence_penalty,
      stop_tokens: body.stop_tokens,
    } as GenerationConfig;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      try {
        let i = 0;
        for await (const { token } of engine.generateText(startId, genCfg)) {
          res.write(`data: ${JSON.stringify({ token, i })}\n\n`);
          i++;
        }
        res.end();
      } catch (err) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
        res.end();
      }
      return;
    }

    const out: number[] = [];
    for await (const { token } of engine.generateText(startId, genCfg)) {
      out.push(token);
    }
    return res.status(200).json({ ok: true, tokens: out, count: out.length });
  }
}

// Bootstrap
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8788;
  const server = new PacketWebSocketServer(port);
  server.start();
}
