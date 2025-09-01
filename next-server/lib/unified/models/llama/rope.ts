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
    const invFreq = mx.array(Array.from({ length: half }, (_, i) => 1.0 / Math.pow(this.base, (i * 2) / headDim)));
    // theta: [T, half]
    const pos = mx.array(positions).reshape([positions.length, 1]);
    const theta = mx.multiply(pos, invFreq.reshape([1, half]));
    const cos = (mx as any).cos ? (mx as any).cos(theta) : mx.cos(theta); // [T, half]
    const sin = (mx as any).sin ? (mx as any).sin(theta) : mx.sin(theta); // [T, half]

    function rope(x: any) {
      // x: [B, H, T, D]
      const B = x.shape[0];
      const H = x.shape[1];
      const Tn = x.shape[2];
      const sliceFn = (mx as any).slice ? (mx as any).slice : (t: any, spec: any) => (t.slice ? t.slice(spec) : null);
      const x1 = sliceFn(x, [null, null, null, [0, half]]);    // [B, H, T, half]
      const x2 = sliceFn(x, [null, null, null, [half, headDim]]); // [B, H, T, half]
      if (!x1 || !x2) {
        throw new Error('MLX slice unavailable for RoPE');
      }
      const cosB = mx.reshape(cos, [1, 1, Tn, half]);
      const sinB = mx.reshape(sin, [1, 1, Tn, half]);
      const xr = mx.subtract(mx.multiply(x1, cosB), mx.multiply(x2, sinB));
      const xi = mx.add(mx.multiply(x1, sinB), mx.multiply(x2, cosB));
      return mx.concatenate([xr, xi], 3);
    }

    return { q: rope(q), k: rope(k) };
  }
}
