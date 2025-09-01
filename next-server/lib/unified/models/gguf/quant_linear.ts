import mlx from '@frost-beta/mlx';
const { core: mx } = mlx as any;

// GPU Q8_K linear: y = W_q8k x, computed on GPU without pre-expanding W to dense.
//
// Layout per row (contiguous, row-major blocks): blocks = ceil(K/256)
//   For each block b in [0..blocks):
//     d (f32), qs[256] (i8), bsums[16] (i16)  => 292 bytes
// We ignore bsums for plain matmul.

const QK_K = 256;
const Q8K_BLOCK_SIZE = 4 + QK_K + (QK_K / 16) * 2; // 292

export type Q8KSpec = {
  rows: number;
  cols: number;
  blocks: number;
  rowStrideBytes: number;
};

export function makeQ8KSpec(rows: number, cols: number): Q8KSpec {
  const blocks = Math.ceil(cols / QK_K);
  const rowStrideBytes = blocks * Q8K_BLOCK_SIZE;
  return { rows, cols, blocks, rowStrideBytes };
}

export type Q8KWeight = {
  spec: Q8KSpec;
  // GPU arrays: scales [rows, blocks] f32, qs [rows, blocks, 256] i8
  scales: any;
  qs: any;
  // Forward:
  //  x: [K] or [B, K] float16/float32
  // returns [rows] or [B, rows] in float16 by default
  forward: (x: any, outDType?: 'f16'|'f32') => any;
};

// Build GPU tensors for a contiguous Q8_K matrix from a raw Buffer
export function buildQ8KWeight(buf: Buffer, spec: Q8KSpec, baseOffset = 0): Q8KWeight {
  const { rows, cols, blocks, rowStrideBytes } = spec;

  // Build host views for scales (f32) and qs (i8), then upload as MLX arrays
  const scalesHost = new Float32Array(rows * blocks);
  const qsHost = new Int8Array(rows * blocks * QK_K);

  let qPtr = 0;
  let sPtr = 0;
  for (let r = 0; r < rows; r++) {
    const rowBase = baseOffset + r * rowStrideBytes;
    for (let b = 0; b < blocks; b++) {
      const blk = rowBase + b * Q8K_BLOCK_SIZE;
      // d
      scalesHost[sPtr++] = buf.readFloatLE(blk);
      // qs
      const qsOff = blk + 4;
      qsHost.set(buf.subarray(qsOff, qsOff + QK_K), qPtr);
      qPtr += QK_K;
      // skip bsums (32 bytes)
    }
  }

  const scales = (mx as any).array(scalesHost).reshape([rows, blocks]);
  const qs = (mx as any).array(qsHost).reshape([rows, blocks, QK_K]);

  function forward(x: any, outDType: 'f16'|'f32' = 'f16'): any {
    // x: [K] or [B,K]
    const xShape = x.shape as number[];
    const batched = xShape.length === 2;
    const K = spec.cols;
    // reshape x to blocks
    const xb = batched
      ? (mx as any).reshape(x, [xShape[0], blocks, QK_K])
      : (mx as any).reshape(x, [blocks, QK_K]);

    // cast qs to f16 for bandwidth, multiply by x blockwise and reduce
    const qsf = (qs as any).astype('float16');
    const xbCast = (xb as any).astype('float16');

    const blockDot = batched
      ? (mx as any).sum((qsf as any)[null] * xbCast[:, null], -1) // [B, rows, blocks]
      : (mx as any).sum(qsf * xbCast[null], -1); // [rows, blocks]

    // apply scales per block and sum over blocks
    const scalesf = (scales as any).astype('float16');
    const scaled = blockDot * (batched ? scalesf[null] : scalesf);
    let y = (mx as any).sum(scaled, -1); // [B, rows] or [rows]

    if (outDType === 'f32') {
      y = (y as any).astype('float32');
    }
    return y;
  }

  return { spec, scales, qs, forward };
}

