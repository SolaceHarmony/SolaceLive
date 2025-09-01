/**
 * Quantized GEMV helpers ported from llama.kotlin logic.
 *
 * Immediate goal: enable computing y = W x without fully dequantizing W.
 * This initial implementation targets Q8_K (K‑quant, qk=256) using CPU loops.
 *
 * Notes
 * - Layout (Q8_K): per super‑block of 256 elements
 *   d (F32), qs[256] (int8), bsums[16] (int16) => 4 + 256 + 32 = 292 bytes
 * - We ignore bsums for plain dequantized dot (they are used for fused ops in ggml).
 * - This is CPU code and intended as a correctness bridge; performance can be
 *   improved with typed array views, blocking, and vectorization.
 */

const QK_K = 256;
const Q8K_BLOCK_SIZE = 4 + QK_K + (QK_K / 16) * 2; // 292

export type QuantType = 'Q8_K';

export type GemvParams = {
  // Raw weight buffer for the quantized matrix in row‑major blocks
  buffer: Buffer;
  // Number of rows (output dimension)
  rows: number;
  // Number of cols (input dimension)
  cols: number;
  // Byte offset to the first row in buffer
  baseOffset?: number;
  // If provided, the stride in bytes between successive rows; otherwise computed
  rowStrideBytes?: number;
};

/**
 * Compute y = W x where W is Q8_K and x is float32.
 * - W is stored row‑major in QK_K super‑blocks.
 * - x is a dense Float32Array of length `cols`.
 * - out is a Float32Array of length `rows`.
 */
export function gemvQ8K(params: GemvParams, x: Float32Array, out: Float32Array): void {
  const { buffer, rows, cols } = params;
  const base = params.baseOffset ?? 0;
  const blocksPerRow = Math.ceil(cols / QK_K);
  const rowStride = params.rowStrideBytes ?? blocksPerRow * Q8K_BLOCK_SIZE;

  if (out.length < rows) throw new Error(`out length ${out.length} < rows ${rows}`);
  if (x.length < cols) throw new Error(`x length ${x.length} < cols ${cols}`);

  for (let r = 0; r < rows; r++) {
    let sum = 0.0;
    const rowBase = base + r * rowStride;
    let kBase = 0;
    for (let b = 0; b < blocksPerRow; b++) {
      const take = Math.min(QK_K, cols - kBase);
      if (take <= 0) break;

      const blk = rowBase + b * Q8K_BLOCK_SIZE;
      // d (float32)
      const d = buffer.readFloatLE(blk);
      // qs start
      const qsOff = blk + 4;

      // dot(qs[0..take), x[kBase..kBase+take))
      let partial = 0.0;
      // Unroll by 4 for a bit of speed
      let i = 0;
      const limit = take & ~3;
      for (; i < limit; i += 4) {
        const q0 = buffer.readInt8(qsOff + i);
        const q1 = buffer.readInt8(qsOff + i + 1);
        const q2 = buffer.readInt8(qsOff + i + 2);
        const q3 = buffer.readInt8(qsOff + i + 3);
        partial += q0 * x[kBase + i + 0]
                +  q1 * x[kBase + i + 1]
                +  q2 * x[kBase + i + 2]
                +  q3 * x[kBase + i + 3];
      }
      for (; i < take; i++) {
        partial += buffer.readInt8(qsOff + i) * x[kBase + i];
      }

      sum += d * partial;
      kBase += take;

      // skip remaining qs (if we took < 256) and bsums area
      // but simpler is to advance by block size via rowStride computation
    }
    out[r] = sum;
  }
}

/**
 * Dispatcher for quantized GEMV by type; currently only Q8_K is implemented.
 */
export function gemvQuant(type: QuantType, params: GemvParams, x: Float32Array, out: Float32Array): void {
  switch (type) {
    case 'Q8_K':
      return gemvQ8K(params, x, out);
    default:
      throw new Error(`gemvQuant: unsupported type ${type}`);
  }
}

/**
 * Utility to build GemvParams for a contiguous Q8_K tensor row‑major layout.
 * - Given a quantized tensor with dims [rows, cols] and per‑row block packing.
 */
export function paramsForContiguousQ8K(buffer: Buffer, rows: number, cols: number, baseOffset = 0): GemvParams {
  const blocksPerRow = Math.ceil(cols / QK_K);
  const rowStrideBytes = blocksPerRow * Q8K_BLOCK_SIZE;
  return { buffer, rows, cols, baseOffset, rowStrideBytes };
}

