// GGUF quantization dtype registry and decoder stubs
// This file will house efficient block decoders for GGML/GGUF quant types.

import { Buffer } from 'buffer';

export type QuantTarget = 'f32' | 'f16' | 'raw';

export type QuantDecodeOptions = {
  to?: QuantTarget;      // desired output format when dequantizing
  dequantize?: boolean;  // if false, return raw buffer slices
};

export type QuantBlockDecoder = (src: Buffer, offset: number, out: Float32Array, take: number) => number;

export const SupportedDTypes = new Set<string>([
  'F32','F16','BF16','Q8_0','Q6_K','Q5_1','Q5_0','Q5_K_S','Q5_K_M','Q4_1','Q4_0','Q4_K_S','Q4_K_M','Q4_K_L','Q3_K','Q2_K'
]);

export function isQuantized(dtype: string): boolean {
  return dtype.startsWith('Q') || dtype === 'BF16' || dtype === 'F16' || dtype === 'F32';
}

// Placeholder decoder lookup. Will be filled with real implementations.
export function getDecoder(dtype: string): QuantBlockDecoder | null {
  void dtype;
  return null; // no decoders yet
}

// Utility to allocate an output array ensuring capacity >= needed
export function ensureOut(out: Float32Array | null, needed: number): Float32Array {
  if (!out || out.length < needed) return new Float32Array(needed);
  return out;
}
