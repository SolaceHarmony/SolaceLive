import mlx from '@frost-beta/mlx';
const { core: mx } = mlx;

export interface RopeConfig {
  dim: number;         // head_dim
  base?: number;       // 10000.0
  scale?: number;      // 1.0
}

export class RotaryEmbedding {
  private dim: number;
  private base: number;
  private scale: number;

  constructor(cfg: RopeConfig) {
    this.dim = cfg.dim;
    this.base = cfg.base ?? 10000.0;
    this.scale = cfg.scale ?? 1.0;
  }

  apply(q: any, k: any, positions: number[]): { q: any; k: any } {
    // q, k: [B, heads, T, head_dim]
    // positions: length T (global positions)
    const headDim = this.dim;
    const half = Math.floor(headDim / 2);
    // invFreq: [half] as float32
    const inv = new Float32Array(half);
    for (let i = 0; i < half; i++) inv[i] = 1.0 / Math.pow(this.base, (i * 2) / headDim);
    const invFreq = mx.array(Array.from(inv)).reshape([half]);
    // theta: [T, half]
    const posF32 = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) posF32[i] = positions[i];
    const pos = mx.array(Array.from(posF32)).reshape([positions.length, 1]);
    const theta = mx.multiply(pos, invFreq.reshape([1, half]));
    const cos = (mx as any).cos ? (mx as any).cos(theta) : mx.cos(theta); // [T, half]
    const sin = (mx as any).sin ? (mx as any).sin(theta) : mx.sin(theta); // [T, half]

    function rope(x: any) {
      // x: [B, H, T, D]
      const B = x.shape[0], H = x.shape[1], Tn = x.shape[2], D = x.shape[3];
      // Convert to JS arrays for a portable RoPE computation
      const xList = (x as any).tolist() as number[][][][];
      const cosList = (cos as any).tolist() as number[][]; // [T, half]
      const sinList = (sin as any).tolist() as number[][]; // [T, half]
      const out = new Float32Array(B * H * Tn * D);
      let p = 0;
      for (let b = 0; b < B; b++) {
        for (let h = 0; h < H; h++) {
          for (let t = 0; t < Tn; t++) {
            for (let i = 0; i < half; i++) {
              const v1 = xList[b][h][t][i];
              const v2 = xList[b][h][t][i + half];
              const c = cosList[t][i];
              const s = sinList[t][i];
              const xr = v1 * c - v2 * s;
              const xi = v1 * s + v2 * c;
              out[p + i] = xr;
              out[p + i + half] = xi;
            }
            p += D;
          }
        }
      }
      return mx.array(Array.from(out)).reshape([B, H, Tn, D]);
    }

    return { q: rope(q), k: rope(k) };
  }
}
