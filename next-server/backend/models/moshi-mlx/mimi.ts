import { promises as fs } from 'fs';
import path from 'path';
import mlx from '@frost-beta/mlx';
import { hfGet } from '../../../lib/hf-loader';
import { readSafetensors } from './weights/loader';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { core: mx } = mlx;

export interface MimiConfig {
  channels: number;         // 1
  sample_rate: number;      // 24000 Hz
  frame_rate: number;       // 12.5 Hz (80 ms)
  renormalize: boolean;     // streaming renorm
  n_q: number;              // number of codebooks (RVQ levels)
  vocab_size: number;       // bins per codebook
}

export type ExecMask = boolean[];

export interface TokenFrame {
  tokens: number[];   // length n_q, one token per codebook for this 80ms step
  timestamp: number;  // ms
}

/**
 * Mimi (MLX/TypeScript) – streaming API skeleton without simulation.
 *
 * This class enforces protocol semantics (24 kHz, 12.5 Hz, 80 ms frames, n_q codebooks)
 * and exposes a streaming encode/decode API. It requires proper model weights.
 * Any attempt to encode/decode without real weights will throw.
 */
export class Mimi {
  readonly sample_rate: number;
  readonly frame_rate: number;
  readonly frame_size: number; // 24000 / 12.5 = 1920

  private n_q: number;
  private vocab_size: number;

  private streamingMode = false;
  private batchSize = 1;
  private execMask: ExecMask | null = null;
  private encodeRemainder = new Float32Array(0);

  private weightsLoaded = false;
  private weightSummary: {
    path: string;
    sizeBytes: number;
    tensorCount: number;
    dtypes: string[];
    sampleKeys: string[];
  } | null = null;

  /** Debug info for health/weights endpoints. */
  debugInfo(): Record<string, unknown> {
    return {
      ready: this.weightsLoaded,
      sample_rate: this.sample_rate,
      frame_rate: this.frame_rate,
      frame_size: this.frame_size,
      n_q: this.n_q,
      vocab_size: this.vocab_size,
      streaming: this.streamingMode,
      batchSize: this.batchSize,
      execMaskActiveCount: Array.isArray(this.execMask) ? this.execMask.filter(Boolean).length : 0,
      encodeRemainderSamples: this.encodeRemainder?.length ?? 0,
      weights: this.weightSummary,
    };
  }

  constructor(cfg?: Partial<MimiConfig>) {
    const c = {
      channels: 1,
      sample_rate: 24000,
      frame_rate: 12.5,
      renormalize: true,
      n_q: 8,
      vocab_size: 2048,
      ...cfg,
    } satisfies MimiConfig;

    this.sample_rate = c.sample_rate;
    this.frame_rate = c.frame_rate;
    this.frame_size = Math.round(c.sample_rate / c.frame_rate);
    this.n_q = c.n_q;
    this.vocab_size = c.vocab_size;
  }

  /** Load Mimi codec weights (required). */
  async loadWeights(source: unknown): Promise<void> {
    if (!source) throw new Error('Mimi.loadWeights: weight source is required');
    this.weightsLoaded = false;
    this.weightSummary = null;
    const resolved = await this.resolveSourceToFile(source);
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      throw new Error(`Mimi.loadWeights: expected file, got ${resolved}`);
    }

    const { header } = await readSafetensors(resolved);
    const keys = Object.keys(header);
    if (keys.length === 0) {
      throw new Error('Mimi.loadWeights: safetensors file contained no tensors');
    }

    const lowercaseKeys = keys.map((k) => k.toLowerCase());
    const requiredHints = ['encoder', 'decoder', 'quantizer', 'rvq', 'codebook'];
    const hasExpected = lowercaseKeys.some((k) => requiredHints.some((hint) => k.includes(hint)));
    if (!hasExpected) {
      throw new Error('Mimi.loadWeights: weights did not include expected encoder/quantizer tensors');
    }

    const dtypes = Array.from(new Set(Object.values(header).map((info) => info.dtype.toLowerCase())));
    const sampleKeys = keys.slice(0, Math.min(8, keys.length));

    this.weightSummary = {
      path: path.resolve(resolved),
      sizeBytes: stat.size,
      tensorCount: keys.length,
      dtypes,
      sampleKeys,
    };
    this.weightsLoaded = true;
  }

  isReady(): boolean { return this.weightsLoaded; }

  /** Number of codebooks (RVQ levels). */
  setNumCodebooks(nq: number): void {
    if (nq <= 0) throw new Error('Mimi.setNumCodebooks: nq must be > 0');
    this.n_q = nq;
  }

  /** Begin streaming context (per-connection). */
  streaming(batchSize = 1): void {
    if (batchSize <= 0) throw new Error('Mimi.streaming: batchSize must be > 0');
    this.streamingMode = true;
    this.batchSize = batchSize;
    this.execMask = Array(this.batchSize).fill(true);
    this.encodeRemainder = new Float32Array(0);
  }

  /** End streaming context. */
  stopStreaming(): void {
    this.streamingMode = false;
    this.batchSize = 1;
    this.execMask = null;
    this.encodeRemainder = new Float32Array(0);
  }

  /** Reset internal streaming state. */
  reset_all(): void {
    this.encodeRemainder = new Float32Array(0);
  }

  /** Desynchronized batches support (mask active entries for this step). */
  set_exec_mask(mask: ExecMask): void {
    if (!this.streamingMode) throw new Error('Mimi.set_exec_mask: call streaming() first');
    if (mask.length !== this.batchSize) throw new Error('Mimi.set_exec_mask: mask length must equal batchSize');
    this.execMask = mask.slice();
  }

  /** Encode audio into Mimi tokens on 80ms boundaries. */
  async encode(audio: Float32Array): Promise<number[][]> {
    if (!this.weightsLoaded) throw new Error('Mimi.encode: weights not loaded');
    if (!this.streamingMode) throw new Error('Mimi.encode: call streaming() first');

    // Accumulate remainder and split into 80ms frames
    let input = audio;
    if (this.encodeRemainder.length > 0) {
      const merged = new Float32Array(this.encodeRemainder.length + audio.length);
      merged.set(this.encodeRemainder, 0);
      merged.set(audio, this.encodeRemainder.length);
      input = merged;
      this.encodeRemainder = new Float32Array(0);
    }

    const frames = Math.floor(input.length / this.frame_size);
    const leftover = input.length - frames * this.frame_size;
    if (leftover > 0) this.encodeRemainder = input.slice(input.length - leftover);

    if (frames === 0) return Array.from({ length: this.n_q }, () => []);

    // Define API but do not fabricate tokens without real models.
    throw new Error('Mimi.encode: encoder/quantizer not implemented in TS. Provide backend/bindings.');
  }

  /** Decode Mimi tokens to PCM frames (80ms per step). */
  async decode(tokensPerCodebook: number[][]): Promise<Float32Array> {
    if (!this.weightsLoaded) throw new Error('Mimi.decode: weights not loaded');
    if (!this.streamingMode) throw new Error('Mimi.decode: call streaming() first');
    const steps = tokensPerCodebook.length > 0 ? (tokensPerCodebook[0]?.length || 0) : 0;
    if (steps === 0) return new Float32Array(0);

    throw new Error('Mimi.decode: decoder not implemented in TS. Provide backend/bindings.');
  }

  private async resolveSourceToFile(source: unknown): Promise<string> {
    if (typeof source === 'string') {
      return hfGet(source);
    }
    if (source && typeof source === 'object') {
      const obj = source as { path?: string; file?: string; repo?: string };
      const candidate = obj.path || obj.file;
      if (typeof candidate === 'string') {
        return hfGet(candidate, obj.repo);
      }
    }
    throw new Error('Mimi.loadWeights: unsupported weight source');
  }
}

export function createMimiConfig(): MimiConfig {
  return {
    channels: 1,
    sample_rate: 24000,
    frame_rate: 12.5,
    renormalize: true,
    n_q: 8,
    vocab_size: 2048,
  };
}
