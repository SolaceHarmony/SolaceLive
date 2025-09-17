import { promises as fs } from 'fs';
import path from 'path';
import { hfGet } from '../../../../lib/hf-loader';
import mlx from '@frost-beta/mlx';
const { core: mx } = mlx;
import type { LmConfig } from '../lm';

/**
 * Lightweight safetensors index validation for LM/Mimi.
 * No tensor loading here (no simulation) — this only checks presence of expected keys
 * so we can fail fast on obviously incompatible repos.
 */

async function readJson(p: string): Promise<any> {
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt);
}

export async function loadLmIndex(repo: string): Promise<{ weight_map: Record<string, string> } | null> {
  try {
    const local = await hfGet('model.safetensors.index.json', repo);
    const j = await readJson(local);
    if (j && typeof j === 'object' && j.weight_map) return j as { weight_map: Record<string, string> };
    return null;
  } catch {
    return null;
  }
}

export async function validateLmWeightsFromHF(repo: string, cfg: LmConfig): Promise<void> {
  const idx = await loadLmIndex(repo);
  if (!idx) throw new Error(`Missing model.safetensors.index.json in ${repo}`);
  const keys = Object.keys(idx.weight_map);

  const must = [
    'text_emb.weight',
    'text_out_head.weight',
  ];
  for (const k of must) {
    if (!keys.includes(k)) throw new Error(`Weights missing required key: ${k}`);
  }
  // Audio embeddings/heads per codebook
  for (let i = 0; i < cfg.audio_codebooks; i++) {
    if (!keys.includes(`audio_emb.${i}.weight`)) throw new Error(`Missing audio_emb.${i}.weight`);
    if (!keys.includes(`audio_out_heads.${i}.weight`)) throw new Error(`Missing audio_out_heads.${i}.weight`);
  }
  // Transformer layers should have at least one param per layer
  for (let i = 0; i < cfg.transformer.num_layers; i++) {
    const prefix = `transformer.${i}.`;
    const has = keys.some((k) => k.startsWith(prefix));
    if (!has) throw new Error(`Missing transformer layer params for layer ${i}`);
  }
}

export async function validateMimiWeightsFromHF(repo: string): Promise<void> {
  // Mimi may be packaged differently; look for a tokenizer/codec checkpoint
  const candidates = [
    'tokenizer.safetensors',
    'mimi.safetensors',
    'tokenizer-e351c8d8-checkpoint125.safetensors',
  ];
  let found = false;
  for (const f of candidates) {
    try {
      const p = await hfGet(f, repo);
      if (p && (await fs.stat(p)).size > 0) { found = true; break; }
    } catch {
      // continue
    }
  }
  if (!found) throw new Error(`No Mimi/tokenizer safetensors found in ${repo}`);
}

/**
 * Resolve a Mimi/tokenizer safetensors file either from a local path or HF repo.
 * Returns the local filesystem path to the selected file. Does not parse or load tensors.
 */
export async function resolveMimiWeights(repoOrLocal: string): Promise<string> {
  // Direct local path
  try {
    const st = await fs.stat(repoOrLocal);
    if (st.isFile()) return repoOrLocal;
  } catch {}
  // Probe common filenames in HF repo
  const candidates = [
    'tokenizer.safetensors',
    'mimi.safetensors',
    'tokenizer-e351c8d8-checkpoint125.safetensors',
  ];
  for (const f of candidates) {
    try {
      const p = await hfGet(f, repoOrLocal);
      const st = await fs.stat(p);
      if (st.isFile() && st.size > 0) return p;
    } catch {
      // try next
    }
  }
  throw new Error(`resolveMimiWeights: no safetensors found for ${repoOrLocal}`);
}

export async function validateFromConfig(lmRepo: string, mimiRepo: string, cfgPath: string): Promise<void> {
  const cfg = await readJson(cfgPath) as any;
  // Construct LmConfig subset used by validator
  const lmCfg: LmConfig = {
    transformer: {
      d_model: cfg.dim,
      num_heads: cfg.num_heads,
      num_layers: cfg.num_layers,
      dim_feedforward: 4 * cfg.dim,
      causal: cfg.causal,
      norm_first: true,
      bias_ff: false,
      bias_attn: false,
      layer_scale: cfg.layer_scale,
      context: cfg.context,
      max_period: cfg.max_period,
      use_conv_block: false,
      use_conv_bias: true,
      cross_attention: cfg.cross_attention || false,
      gating: true,
      norm: 'rms_norm',
      positional_embedding: cfg.positional_embedding,
      conv_layout: false,
      conv_kernel_size: 3,
      kv_repeat: 1,
      max_seq_len: 4096,
    },
    depformer: {
      transformer: {
        d_model: cfg.depformer_dim,
        num_heads: cfg.depformer_num_heads,
        num_layers: cfg.depformer_num_layers,
        dim_feedforward: cfg.depformer_dim_feedforward,
        causal: cfg.depformer_causal ?? true,
        norm_first: true,
        bias_ff: false,
        bias_attn: cfg.depformer_layer_scale ?? false,
        layer_scale: null,
        context: cfg.depformer_context ?? cfg.dep_q,
        max_period: cfg.depformer_max_period ?? 8,
        use_conv_block: false,
        use_conv_bias: true,
        cross_attention: false,
        gating: true,
        norm: 'rms_norm',
        positional_embedding: cfg.depformer_pos_emb,
        conv_layout: false,
        conv_kernel_size: 3,
        kv_repeat: 1,
        max_seq_len: 4096,
      },
      num_slices: cfg.dep_q,
      weights_per_step_schedule: cfg.depformer_weights_per_step_schedule || null,
      low_rank_embeddings: cfg.depformer_low_rank_embeddings || null,
    },
    text_in_vocab_size: cfg.text_card + 1,
    text_out_vocab_size: cfg.text_card,
    audio_vocab_size: cfg.card + 1,
    audio_delays: cfg.delays.slice(1),
    audio_codebooks: cfg.n_q,
    demux_second_stream: cfg.demux_second_stream || false,
    conditioners: cfg.conditioners || {},
    extra_heads_dim: cfg.extra_heads_dim || 6,
    extra_heads_num_heads: cfg.extra_heads_num_heads || 0,
  };
  await validateLmWeightsFromHF(lmRepo, lmCfg);
  await validateMimiWeightsFromHF(mimiRepo);
}

// ========== Low-level safetensors reading (subset) ==========
export type TensorInfo = { dtype: string; shape: number[]; data_offsets: [number, number] };

export async function readSafetensors(filePath: string): Promise<{ header: Record<string, TensorInfo>; headerSize: number; buf: Buffer }>{
  const fd = await fs.open(filePath, 'r');
  try {
    const head = Buffer.alloc(8);
    await fd.read(head, 0, 8, 0);
    const headerSize = Number(head.readBigUInt64LE(0));
    const headerBuf = Buffer.alloc(headerSize);
    await fd.read(headerBuf, 0, headerSize, 8);
    const json = JSON.parse(headerBuf.toString('utf8'));
    const buf = await fs.readFile(filePath);
    return { header: json.tensors as Record<string, TensorInfo>, headerSize, buf };
  } finally {
    await fd.close();
  }
}

function dtypeToArray(buf: Buffer, dtype: string, offset: number, lengthBytes: number): Float32Array {
  const dt = dtype.toUpperCase();
  if (dt === 'F32' || dt === 'FLOAT32') {
    const slice = buf.subarray(offset, offset + lengthBytes);
    const f32 = new Float32Array(slice.buffer, slice.byteOffset, Math.floor(lengthBytes / 4));
    return new Float32Array(f32);
  }
  if (dt === 'F16' || dt === 'FLOAT16') {
    const view = new DataView(buf.buffer, buf.byteOffset + offset, lengthBytes);
    const out = new Float32Array(lengthBytes / 2);
    for (let i = 0; i < out.length; i++) {
      const h = view.getUint16(i * 2, true);
      out[i] = halfToFloat(h);
    }
    return out;
  }
  if (dt === 'BF16' || dt === 'BFloat16') {
    const view = new DataView(buf.buffer, buf.byteOffset + offset, lengthBytes);
    const out = new Float32Array(lengthBytes / 2);
    for (let i = 0; i < out.length; i++) {
      const b = view.getUint16(i * 2, true);
      // bfloat16: use as high 16 bits of float32
      const u32 = b << 16;
      const fView = new DataView(new ArrayBuffer(4));
      fView.setUint32(0, u32, true);
      out[i] = fView.getFloat32(0, true);
    }
    return out;
  }
  throw new Error(`Unsupported dtype for loader: ${dtype}`);
}

function halfToFloat(h: number): number {
  // IEEE 754 half-precision to float32
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7C00) >> 10;
  const f = h & 0x03FF;
  if (e === 0) {
    // subnormal
    const val = (f / Math.pow(2, 10)) * Math.pow(2, -14);
    return (s ? -1 : 1) * val;
  } else if (e === 0x1F) {
    // Inf/NaN
    return f ? NaN : (s ? -Infinity : Infinity);
  } else {
    const val = (1 + f / Math.pow(2, 10)) * Math.pow(2, e - 15);
    return (s ? -1 : 1) * val;
  }
}

export async function loadLmWeightsSubset(lmRepo: string, names: string[]): Promise<Map<string, any>> {
  const idx = await loadLmIndex(lmRepo);
  if (!idx) throw new Error(`Missing model.safetensors.index.json in ${lmRepo}`);
  // Group names by file
  const byFile: Record<string, string[]> = {};
  for (const key of names) {
    const file = idx.weight_map[key];
    if (!file) throw new Error(`Weight key not found in index: ${key}`);
    (byFile[file] ||= []).push(key);
  }
  const out = new Map<string, any>();
  for (const [file, keys] of Object.entries(byFile)) {
    const local = await hfGet(file, lmRepo);
    const { header, headerSize, buf } = await readSafetensors(local);
    for (const key of keys) {
      const info = header[key];
      if (!info) throw new Error(`Tensor ${key} not found in ${file}`);
      const [start, end] = info.data_offsets;
      const dataStart = 8 + headerSize + start;
      const byteLen = end - start;
      const f32 = dtypeToArray(buf, info.dtype, dataStart, byteLen);
      const expectedLen = info.shape.reduce((a, b) => a * b, 1);
      if (f32.length !== expectedLen) {
        throw new Error(`Tensor ${key} length mismatch: got ${f32.length}, expected ${expectedLen}`);
      }
      const arr = mx.array(Array.from(f32)).reshape([ ...info.shape ]);
      out.set(key, arr);
    }
  }
  return out;
}

export async function loadAllLmWeights(lmRepo: string): Promise<Map<string, any>> {
  const idx = await loadLmIndex(lmRepo);
  if (!idx) throw new Error(`Missing model.safetensors.index.json in ${lmRepo}`);
  const byFile: Record<string, string[]> = {};
  for (const [key, file] of Object.entries(idx.weight_map)) {
    (byFile[file] ||= []).push(key);
  }
  const out = new Map<string, any>();
  for (const [file, keys] of Object.entries(byFile)) {
    const local = await hfGet(file, lmRepo);
    const { header, headerSize, buf } = await readSafetensors(local);
    for (const key of keys) {
      const info = header[key];
      if (!info) continue; // ignore unexpected keys
      const [start, end] = info.data_offsets;
      const dataStart = 8 + headerSize + start;
      const byteLen = end - start;
      const f32 = dtypeToArray(buf, info.dtype, dataStart, byteLen);
      const expectedLen = info.shape.reduce((a, b) => a * b, 1);
      if (f32.length !== expectedLen) {
        throw new Error(`Tensor ${key} length mismatch: got ${f32.length}, expected ${expectedLen}`);
      }
      const arr = mx.array(Array.from(f32)).reshape([ ...info.shape ]);
      out.set(key, arr);
    }
  }
  return out;
}
