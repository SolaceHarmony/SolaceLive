import mlx from '@frost-beta/mlx';
const { core: mx, nn } = mlx;

export interface TransformerConfig {
  d_model: number;
  num_heads: number;
  num_layers: number;
  dim_feedforward: number;
  causal: boolean;
  norm_first: boolean;
  bias_ff: boolean;
  bias_attn: boolean;
  layer_scale: number | null;
  context: number;
  max_period: number;
  use_conv_block: boolean;
  use_conv_bias: boolean;
  cross_attention: boolean;
  gating: boolean;
  norm: string;
  positional_embedding: string;
  conv_layout: boolean;
  conv_kernel_size: number;
  kv_repeat: number;
  max_seq_len: number;
}

export class RMSNorm {
  private weight: mx.array;
  private eps: number;

  constructor(dims: number, eps = 1e-5) {
    this.weight = mx.ones([dims]);
    this.eps = eps;
  }

  forward(x: mx.array): mx.array {
    const variance = mx.mean(mx.multiply(x, x), -1, true);
    const rsqrt = mx.rsqrt(mx.add(variance, this.eps));
    return mx.multiply(mx.multiply(x, rsqrt), this.weight);
  }
}

export class MultiHeadAttention {
  private num_heads: number;
  private head_dim: number;
  private scale: number;
  private q_proj: mx.array | null = null;
  private k_proj: mx.array | null = null;
  private v_proj: mx.array | null = null;
  private o_proj: mx.array | null = null;

  constructor(dims: number, num_heads: number, bias = false) {
    this.num_heads = num_heads;
    this.head_dim = Math.floor(dims / num_heads);
    this.scale = 1.0 / Math.sqrt(this.head_dim);
  }

  async init(weights?: Map<string, mx.array>) {
    if (weights) {
      this.q_proj = weights.get('q_proj') || null;
      this.k_proj = weights.get('k_proj') || null;
      this.v_proj = weights.get('v_proj') || null;
      this.o_proj = weights.get('o_proj') || null;
    }
  }

  forward(x: mx.array, mask?: mx.array, cache?: Map<string, mx.array>): mx.array {
    if (!this.q_proj || !this.k_proj || !this.v_proj || !this.o_proj) {
      throw new Error('Attention weights not initialized');
    }

    const B = x.shape[0];
    const L = x.shape[1];

    let queries = mx.matmul(x, this.q_proj);
    let keys = mx.matmul(x, this.k_proj);
    let values = mx.matmul(x, this.v_proj);

    queries = mx.reshape(queries, [B, L, this.num_heads, this.head_dim]);
    keys = mx.reshape(keys, [B, L, this.num_heads, this.head_dim]);
    values = mx.reshape(values, [B, L, this.num_heads, this.head_dim]);

    queries = mx.transpose(queries, [0, 2, 1, 3]);
    keys = mx.transpose(keys, [0, 2, 1, 3]);
    values = mx.transpose(values, [0, 2, 1, 3]);

    if (cache) {
      const cached_keys = cache.get('keys');
      const cached_values = cache.get('values');
      if (cached_keys && cached_values) {
        keys = mx.concatenate([cached_keys, keys], 2);
        values = mx.concatenate([cached_values, values], 2);
      }
      cache.set('keys', keys);
      cache.set('values', values);
    }

    let scores = mx.matmul(queries, mx.transpose(keys, [0, 1, 3, 2]));
    scores = mx.multiply(scores, this.scale);

    if (mask) {
      scores = mx.add(scores, mask);
    }

    const weights = mx.softmax(scores, -1);
    let out = mx.matmul(weights, values);

    out = mx.transpose(out, [0, 2, 1, 3]);
    out = mx.reshape(out, [B, L, -1]);

    return mx.matmul(out, this.o_proj);
  }
}

export class FeedForward {
  private w1: mx.array | null = null;
  private w2: mx.array | null = null;
  private w3: mx.array | null = null;

  constructor(dims: number, hidden_dims: number) {}

  async init(weights?: Map<string, mx.array>) {
    if (weights) {
      this.w1 = weights.get('w1') || null;
      this.w2 = weights.get('w2') || null;
      this.w3 = weights.get('w3') || null;
    }
  }

  forward(x: mx.array): mx.array {
    if (!this.w1 || !this.w2 || !this.w3) {
      throw new Error('FeedForward weights not initialized');
    }

    const gate = mx.silu(mx.matmul(x, this.w1));
    const up = mx.matmul(x, this.w3);
    return mx.matmul(mx.multiply(gate, up), this.w2);
  }
}

export class TransformerLayer {
  private self_attn: MultiHeadAttention;
  private mlp: FeedForward;
  private norm1: RMSNorm;
  private norm2: RMSNorm;

  constructor(config: TransformerConfig) {
    this.self_attn = new MultiHeadAttention(config.d_model, config.num_heads, config.bias_attn);
    this.mlp = new FeedForward(config.d_model, config.dim_feedforward);
    this.norm1 = new RMSNorm(config.d_model);
    this.norm2 = new RMSNorm(config.d_model);
  }

  async init(weights?: Map<string, mx.array>) {
    const attn_weights = new Map<string, mx.array>();
    const mlp_weights = new Map<string, mx.array>();

    if (weights) {
      for (const [key, value] of weights) {
        if (key.startsWith('self_attn.')) {
          attn_weights.set(key.replace('self_attn.', ''), value);
        } else if (key.startsWith('mlp.')) {
          mlp_weights.set(key.replace('mlp.', ''), value);
        }
      }
    }

    await this.self_attn.init(attn_weights);
    await this.mlp.init(mlp_weights);
  }

  forward(x: mx.array, mask?: mx.array, cache?: Map<string, mx.array>): mx.array {
    const normed = this.norm1.forward(x);
    const attn_out = this.self_attn.forward(normed, mask, cache);
    x = mx.add(x, attn_out);

    const normed2 = this.norm2.forward(x);
    const mlp_out = this.mlp.forward(normed2);
    return mx.add(x, mlp_out);
  }
}

export class Transformer {
  private config: TransformerConfig;
  private layers: TransformerLayer[];
  private norm: RMSNorm | null = null;

  constructor(config: TransformerConfig) {
    this.config = config;
    this.layers = [];
    for (let i = 0; i < config.num_layers; i++) {
      this.layers.push(new TransformerLayer(config));
    }
    this.norm = new RMSNorm(config.d_model);
  }

  async init(weights?: Map<string, Map<string, mx.array>>) {
    if (weights) {
      for (let i = 0; i < this.layers.length; i++) {
        const layer_weights = weights.get(`layer_${i}`);
        if (layer_weights) {
          await this.layers[i].init(layer_weights);
        }
      }
    }
  }

  forward(x: mx.array, mask?: mx.array, cache?: Map<number, Map<string, mx.array>>): mx.array {
    for (let i = 0; i < this.layers.length; i++) {
      const layer_cache = cache?.get(i);
      x = this.layers[i].forward(x, mask, layer_cache);
    }

    if (this.norm) {
      x = this.norm.forward(x);
    }

    return x;
  }
}