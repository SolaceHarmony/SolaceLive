import mlx from '@frost-beta/mlx';
import { LmModel } from './lm';

const { core: mx } = mlx;

export interface FrameInputs {
  /**
   * (batch, sequence, audio_codebooks + 1)
   * Layout matches Sesame pipelines: first N columns are Mimi codebooks, last column is text token id.
   */
  tokens: mx.array;
  /** Optional binary mask aligned with tokens (same shape). */
  mask?: mx.array;
  /** Optional absolute positions (batch, sequence); retained for future RoPE alignment. */
  positions?: mx.array;
}

export interface FrameSamplingConfig {
  temperature?: number;
  topk?: number;
}

export interface FrameSample {
  /** Sampled audio tokens per codebook, shape (batch, audio_codebooks). */
  audio: mx.array;
  /** Convenience view: per-codebook tensors shaped (batch, 1). */
  audioPerCodebook: mx.array[];
}

/**
 * Lightweight generator that mirrors Sesame's CSM frame sampling pipeline while reusing the MLX LmModel.
 * It expects the caller to manage prompt accumulation and cache resets just like the Python reference.
 */
export class MlxCsmGenerator {
  private audioCodebooks: number;
  private textVocab: number;
  private ready = false;

  constructor(private lm: LmModel, opts: { audioCodebooks: number; textVocab: number }) {
    this.audioCodebooks = opts.audioCodebooks;
    this.textVocab = opts.textVocab;
  }

  /** Prime internal caches for a new conversation. */
  setupCaches(maxBatchSize = 1): void {
    this.lm.setupCaches(maxBatchSize);
    this.ready = true;
  }

  /** Reset caches between conversations (backbone + delay counters). */
  resetCaches(): void {
    this.lm.resetCaches();
  }

  /**
   * Feed a prompt segment (context) without sampling so downstream steps can piggy-back on cached states.
   */
  prime(inputs: FrameInputs): void {
    this.ensureReady();
    const masked = this.applyMask(inputs.tokens, inputs.mask);
    const { text, audio } = this.splitChannels(masked);
    this.lm.forward(text, audio);
  }

  /** Sample a single 80 ms audio frame (all codebooks) given packed tokens + mask. */
  generateFrame(inputs: FrameInputs, sampling: FrameSamplingConfig = {}): FrameSample {
    this.ensureReady();
    const masked = this.applyMask(inputs.tokens, inputs.mask);
    const { text, audio } = this.splitChannels(masked);
    const { audio_logits } = this.lm.forward(text, audio);

    const perCodebook: mx.array[] = [];
    const collected: number[][] = [];

    for (let codebook = 0; codebook < audio_logits.length; codebook++) {
      const logits = audio_logits[codebook].index([null, -1, null]);
      const samples = this.sampleBatch(logits, sampling.temperature ?? 0.9, sampling.topk ?? 50);
      for (let b = 0; b < samples.length; b++) {
        if (!collected[b]) collected[b] = [];
        collected[b][codebook] = samples[b];
      }
    }

    const batch = collected.length > 0 ? collected.length : (audio_logits[0]?.shape?.[0] ?? 0);
    const perCodebookArrays: mx.array[] = [];
    for (let i = 0; i < this.audioCodebooks; i++) {
      const column: number[] = [];
      for (let b = 0; b < batch; b++) {
        const row = collected[b] ?? [];
        column.push(row[i] ?? 0);
      }
      const arr = mx.reshape(mx.array(column, 'int32'), [batch, 1]);
      perCodebookArrays.push(arr);
    }

    const flat = mx.array(collected.map(row => row ?? []), 'int32');
    return { audio: flat, audioPerCodebook: perCodebookArrays };
  }

  private ensureReady(): void {
    if (!this.ready) {
      throw new Error('MlxCsmGenerator: call setupCaches() before generating frames');
    }
  }

  private applyMask(tokens: mx.array, mask?: mx.array): mx.array {
    if (!mask) return tokens;
    const cast = typeof (mx as any).astype === 'function' ? (mx as any).astype(mask, 'int32') : mask;
    return mx.multiply(tokens, cast);
  }

  private splitChannels(tokens: mx.array): { text: mx.array; audio: mx.array[] } {
    const shape = (tokens as any).shape as number[];
    const B = shape[0];
    const S = shape[1];
    const C = shape[2];
    const textSlice = tokens.slice([null, null, [C - 1, C]]);
    const text = mx.reshape(textSlice, [B, S]);
    const audio: mx.array[] = [];
    const codebooks = Math.min(this.audioCodebooks, C - 1);
    for (let i = 0; i < codebooks; i++) {
      const a = tokens.slice([null, null, [i, i + 1]]);
      audio.push(mx.reshape(a, [B, S]));
    }
    return { text, audio };
  }

  private sampleBatch(logits: mx.array, temperature: number, topk: number): number[] {
    const rows = this.arrayTo2d(logits);
    const samples: number[] = [];
    const k = Math.max(1, Math.min(topk | 0, rows[0]?.length ?? 1));
    const temp = Math.max(temperature, 1e-5);
    for (const row of rows) {
      const scaled = row.map(v => v / temp);
      const id = this.sampleTopK(scaled, k);
      samples.push(id);
    }
    return samples;
  }

  private sampleTopK(logits: number[], k: number): number {
    const NEG_INF = -1e9;
    const indices = logits.map((_, idx) => idx).sort((a, b) => logits[b] - logits[a]);
    const keep = indices.slice(0, k);
    const filtered = logits.map(() => NEG_INF);
    for (const idx of keep) filtered[idx] = logits[idx];
    const probs = this.softmax(filtered);
    return this.multinomial(probs);
  }

  private softmax(values: number[]): number[] {
    let m = -Infinity;
    for (const v of values) if (v > m) m = v;
    const exps = values.map(v => Math.exp(v - m));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map(v => v / sum);
  }

  private multinomial(probs: number[]): number {
    let r = Math.random();
    for (let i = 0; i < probs.length; i++) {
      const p = probs[i];
      if (r <= p) return i;
      r -= p;
    }
    return probs.length - 1;
  }

  private arrayTo2d(arr: mx.array): number[][] {
    const raw = (arr as any).tolist?.();
    if (!Array.isArray(raw)) {
      throw new Error('MlxCsmGenerator: unable to convert logits to list');
    }
    return raw.map((row: unknown) => {
      if (Array.isArray(row)) return row.map(Number);
      return [Number(row)];
    });
  }
}
