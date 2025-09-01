import mlx from '@frost-beta/mlx';
const { core: mx } = mlx;
import { RotaryEmbedding } from './rope';

export interface LlamaConfig {
  d_model: number;
  n_heads: number;
  n_kv_heads?: number; // default n_heads
  n_layers: number;
  vocab: number;
  rope_base?: number;
}

class RMSNorm {
  private weight: any; private eps = 1e-5;
  constructor(d: number) { this.weight = mx.ones([d]); }
  set(w: any | null) { if (w) this.weight = w; }
  forward(x: any) { const v = mx.mean(mx.multiply(x, x), -1, true); const r = mx.rsqrt(mx.add(v, this.eps)); return mx.multiply(mx.multiply(x, r), this.weight); }
}

class Linear {
  constructor(public w: any | null = null) {}
  setOriented(w: any, expectedIn: number, expectedOut: number) {
    const shp = (w as any).shape as number[];
    if (shp && shp.length === 2) {
      if (shp[0] === expectedIn && shp[1] === expectedOut) { this.w = w; return; }
      if (shp[0] === expectedOut && shp[1] === expectedIn) { this.w = mx.transpose(w, [1, 0]); return; }
    }
    this.w = w;
  }
  forward(x: any) { if (!this.w) throw new Error('Linear weight null'); return mx.matmul(x, this.w); }
}

class LlamaAttention {
  private cfg: LlamaConfig;
  private headDim: number; private rope: RotaryEmbedding;
  q = new Linear(); k = new Linear(); v = new Linear(); o = new Linear();
  constructor(cfg: LlamaConfig) {
    this.cfg = cfg; this.headDim = Math.floor(cfg.d_model / cfg.n_heads);
    this.rope = new RotaryEmbedding({ dim: this.headDim, base: cfg.rope_base ?? 10000.0 });
  }
  init(weights: Map<string, any>, layer: number) {
    const names = [
      [`transformer.${layer}.self_attn.q_proj`, `layers.${layer}.attention.wq.weight`],
      [`transformer.${layer}.self_attn.k_proj`, `layers.${layer}.attention.wk.weight`],
      [`transformer.${layer}.self_attn.v_proj`, `layers.${layer}.attention.wv.weight`],
      [`transformer.${layer}.self_attn.o_proj`, `layers.${layer}.attention.wo.weight`],
    ];
    const pick = (arr: string[]) => arr.map((n) => weights.get(n)).find(Boolean) as any;
    const D = this.cfg.d_model;
    this.q.setOriented(pick(names[0]), D, D);
    this.k.setOriented(pick(names[1]), D, D);
    this.v.setOriented(pick(names[2]), D, D);
    this.o.setOriented(pick(names[3]), D, D);
    if (!this.q.w || !this.k.w || !this.v.w || !this.o.w) throw new Error(`Missing attn weights at layer ${layer}`);
  }
  forward(x: any, posStart: number, cache?: Map<string, any>) {
    const B = x.shape[0]; const T = x.shape[1]; const H = this.cfg.n_heads; const D = this.headDim;
    let q = this.q.forward(x); let k = this.k.forward(x); let v = this.v.forward(x);
    q = mx.reshape(q, [B, T, H, D]); k = mx.reshape(k, [B, T, H, D]); v = mx.reshape(v, [B, T, H, D]);
    q = mx.transpose(q, [0, 2, 1, 3]); k = mx.transpose(k, [0, 2, 1, 3]); v = mx.transpose(v, [0, 2, 1, 3]);
    const positions = Array.from({ length: T }, (_, i) => posStart + i);
    const rope = this.rope.apply(q, k, positions); q = rope.q; k = rope.k;

    // KV cache
    let kAll = k; let vAll = v;
    if (cache) {
      const ck = cache.get('k'); const cv = cache.get('v');
      if (ck && cv) { kAll = mx.concatenate([ck, k], 2); vAll = mx.concatenate([cv, v], 2); }
      cache.set('k', kAll); cache.set('v', vAll);
    }

    const scale = 1.0 / Math.sqrt(D);
    let scores = mx.matmul(q, mx.transpose(kAll, [0, 1, 3, 2]));
    scores = mx.multiply(scores, scale);
    // causal mask: allow attending to <= current position
    const S = (kAll as any).shape[2];
    const mask = causalMask(T, S); // [1,1,T,S]
    scores = mx.add(scores, mask);
    const attn = mx.softmax(scores, -1);
    let out = mx.matmul(attn, vAll); // [B,H,T,D]
    out = mx.transpose(out, [0, 2, 1, 3]);
    out = mx.reshape(out, [B, T, H * D]);
    return this.o.forward(out);
  }
}

function causalMask(T: number, S: number) {
  // Build full -inf mask then zero out allowed columns j <= (S - T) + t
  const data = new Float32Array(T * S);
  data.fill(-1e9);
  const offset = S - T;
  for (let t = 0; t < T; t++) {
    const allowed = offset + t + 1;
    const end = Math.min(S, Math.max(0, allowed));
    for (let s = 0; s < end; s++) data[t * S + s] = 0;
  }
  const mask2d = mx.array(Array.from(data)).reshape([T, S]);
  return mask2d.reshape([1, 1, T, S]);
}

class LlamaMLP {
  w1 = new Linear(); w2 = new Linear(); w3 = new Linear();
  constructor(private dModel: number, private hidden: number) {}
  init(weights: Map<string, any>, layer: number) {
    const pick = (arr: string[]) => arr.map((n) => weights.get(n)).find(Boolean) as any;
    this.w1.setOriented(pick([`transformer.${layer}.mlp.w1`, `layers.${layer}.feed_forward.w1.weight`, `layers.${layer}.ffn.w1.weight`]), this.dModel, this.hidden);
    this.w2.setOriented(pick([`transformer.${layer}.mlp.w2`, `layers.${layer}.feed_forward.w2.weight`, `layers.${layer}.ffn.w2.weight`]), this.hidden, this.dModel);
    this.w3.setOriented(pick([`transformer.${layer}.mlp.w3`, `layers.${layer}.feed_forward.w3.weight`, `layers.${layer}.ffn.w3.weight`]), this.dModel, this.hidden);
    if (!this.w1.w || !this.w2.w || !this.w3.w) throw new Error(`Missing MLP weights at layer ${layer}`);
  }
  forward(x: any) {
    const pre = this.w1.forward(x);
    let gate: any;
    if ((mx as any).silu) {
      gate = (mx as any).silu(pre);
    } else if ((mx as any).sigmoid) {
      gate = mx.multiply(pre, (mx as any).sigmoid(pre));
    } else if ((mx as any).exp && (mx as any).divide) {
      const one = mx.ones(pre.shape);
      const denom = mx.add(one, (mx as any).exp(mx.multiply(pre, -1)));
      const sig = (mx as any).divide(one, denom);
      gate = mx.multiply(pre, sig);
    } else {
      // Last resort
      const arr = pre.tolist() as number[][][];
      const out = arr.map(batch => batch.map(vec => vec.map(v => v / (1 + Math.exp(-v)))));
      gate = mx.array(out).reshape(pre.shape);
    }
    const up = this.w3.forward(x);
    return this.w2.forward(mx.multiply(gate, up));
  }
}

class LlamaDecoderLayer {
  norm1: RMSNorm; norm2: RMSNorm; attn: LlamaAttention; mlp: LlamaMLP;
  constructor(private cfg: LlamaConfig) {
    this.norm1 = new RMSNorm(cfg.d_model);
    this.norm2 = new RMSNorm(cfg.d_model);
    this.attn = new LlamaAttention(cfg);
    this.mlp = new LlamaMLP(cfg.d_model, 4 * cfg.d_model);
  }
  init(weights: Map<string, any>, layer: number) {
    const pick = (arr: string[]) => arr.map((n) => weights.get(n)).find(Boolean) as any;
    this.attn.init(weights, layer);
    this.mlp.init(weights, layer);
    this.norm1.set(pick([`transformer.${layer}.norm1.weight`, `layers.${layer}.attention_norm.weight`, `layers.${layer}.input_layernorm.weight`]));
    this.norm2.set(pick([`transformer.${layer}.norm2.weight`, `layers.${layer}.ffn_norm.weight`, `layers.${layer}.post_attention_layernorm.weight`]));
  }
  forward(x: any, posStart: number, cache?: Map<string, any>) {
    const a = this.attn.forward(this.norm1.forward(x), posStart, cache?.get('attn'));
    x = mx.add(x, a);
    const m = this.mlp.forward(this.norm2.forward(x));
    return mx.add(x, m);
  }
}

export class LlamaModel {
  private cfg: LlamaConfig;
  private tokEmb: any | null = null; private outHead: any | null = null; private norm: RMSNorm;
  private layers: LlamaDecoderLayer[] = [];
  constructor(cfg: LlamaConfig) { this.cfg = cfg; this.norm = new RMSNorm(cfg.d_model); for (let i=0;i<cfg.n_layers;i++) this.layers.push(new LlamaDecoderLayer(cfg)); }
  init(weights: Map<string, any>) {
    const pick = (arr: string[]) => arr.map((n) => weights.get(n)).find(Boolean) as any;
    this.tokEmb = pick(['text_emb.weight', 'tok_embeddings.weight', 'token_embd.weight', 'embeddings.weight']);
    if (this.tokEmb) {
      const shp = (this.tokEmb as any).shape as number[];
      if (shp && shp.length === 2) {
        const vocab = this.cfg.vocab;
        const d = this.cfg.d_model;
        if (shp[0] === d && shp[1] === vocab) {
          this.tokEmb = mx.transpose(this.tokEmb, [1, 0]);
        }
      }
    }
    this.outHead = pick(['text_out_head.weight', 'lm_head.weight', 'output.weight']);
    if (!this.tokEmb || !this.outHead) throw new Error('Missing token embedding or output head');
    for (let i=0;i<this.layers.length;i++) this.layers[i].init(weights, i);
    const finalNorm = pick(['transformer.norm.weight', 'model.norm.weight', 'output_norm.weight', 'norm.weight']);
    if (finalNorm) this.norm.set(finalNorm);
  }
  forwardTokenIds(tokenIds: number[], posStart: number, cache?: Map<number, Map<string, any>>) {
    // tokenIds: length T (batch=1)
    let x: any;
    const T = tokenIds.length;
    const D = this.cfg.d_model;
    // Deterministic embedding gather: prefer instance slice; fallback to JS list gather
    const arrAny: any = this.tokEmb! as any;
    let rows: any;
    if (typeof arrAny.slice === 'function') {
      const parts: any[] = [];
      for (let i = 0; i < T; i++) {
        const s = arrAny.slice([[tokenIds[i], tokenIds[i] + 1], null]); // [1, D]
        parts.push(mx.reshape(s, [D]));
      }
      rows = mx.concatenate(parts, 0); // [T, D]
    } else {
      const list = (this.tokEmb as any).tolist?.();
      if (!Array.isArray(list)) throw new Error('Embedding gather fallback failed: tolist() not available');
      const selected: number[][] = [];
      for (let i = 0; i < T; i++) {
        const id = tokenIds[i] | 0;
        const row = list[id];
        if (!Array.isArray(row) || row.length !== D) {
          throw new Error(`Embedding row ${id} unavailable or wrong dim`);
        }
        selected.push(row);
      }
      rows = mx.array(selected).reshape([T, D]);
    }
    x = mx.reshape(rows, [1, T, D]);
    let h = x;
    for (let i=0;i<this.layers.length;i++) {
      const layerCache = cache?.get(i) ?? new Map<string, any>();
      const out = this.layers[i].forward(h, posStart, new Map([['attn', layerCache]]));
      if (cache) cache.set(i, layerCache);
      h = out;
    }
    h = this.norm.forward(h);
    const logits = mx.matmul(h, mx.transpose(this.outHead!));
    return logits; // [1,T,vocab]
  }
}
