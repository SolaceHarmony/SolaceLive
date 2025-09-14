import mlx from '@frost-beta/mlx';
import { Transformer, TransformerConfig } from './transformer';

const { core: mx } = mlx;

export interface DepFormerConfig {
  transformer: TransformerConfig;
  num_slices: number;
  weights_per_step_schedule: number[] | null;
  low_rank_embeddings: number | null;
}

export interface LmConfig {
  transformer: TransformerConfig;
  depformer: DepFormerConfig;
  text_in_vocab_size: number;
  text_out_vocab_size: number;
  audio_vocab_size: number;
  audio_codebooks: number;
  audio_delays: number[];
  conditioners: Record<string, any>;
  demux_second_stream: boolean;
  extra_heads_num_heads: number;
  extra_heads_dim: number;
}

export class ScaledEmbedding {
  private num_embeddings: number;
  private dims: number;
  private scale: number;
  private weight: mx.array | null = null;

  constructor(num_embeddings: number, dims: number, scale = 10.0) {
    this.num_embeddings = num_embeddings;
    this.dims = dims;
    this.scale = scale;
  }

  async init(weight?: mx.array) {
    if (weight) {
      this.weight = weight;
    } else {
      const normal = mx.random.normal([this.num_embeddings, this.dims]);
      this.weight = mx.multiply(normal, 0.02);
    }
  }

  forward(x: mx.array): mx.array {
    if (!this.weight) {
      throw new Error('Embedding not initialized');
    }
    // Ensure indices are integral (int32) for gather
    const idx = (mx as any).astype ? (mx as any).astype(x, 'int32') : x;
    return mx.gather(this.weight, idx, 0);
  }
}

export class LmModel {
  private config: LmConfig;
  private text_emb: ScaledEmbedding;
  private audio_emb: ScaledEmbedding[];
  private transformer: Transformer;
  private depformer: Transformer | null = null;
  private text_out_head: mx.array | null = null;
  private audio_out_heads: mx.array[] = [];
  private weightsLoaded = false;
  private transformerLayerParamsCount: number[] = [];

  constructor(config: LmConfig) {
    this.config = config;
    
    this.text_emb = new ScaledEmbedding(
      config.text_in_vocab_size,
      config.transformer.d_model
    );

    this.audio_emb = [];
    for (let i = 0; i < config.audio_codebooks; i++) {
      this.audio_emb.push(
        new ScaledEmbedding(
          config.audio_vocab_size,
          config.transformer.d_model
        )
      );
    }

    this.transformer = new Transformer(config.transformer);

    if (config.depformer) {
      this.depformer = new Transformer(config.depformer.transformer);
    }
  }

  async init(weights?: Map<string, any>) {
    await this.text_emb.init(weights?.get('text_emb.weight'));

    for (let i = 0; i < this.audio_emb.length; i++) {
      await this.audio_emb[i].init(weights?.get(`audio_emb.${i}.weight`));
    }

    const transformer_weights = new Map<string, Map<string, mx.array>>();
    function ensureLayer(idx: number) {
      if (!transformer_weights.has(`layer_${idx}`)) transformer_weights.set(`layer_${idx}`, new Map());
    }
    function normalizeParamPath(p: string): string {
      // Map common aliases to our internal names
      // attention block
      if (p.startsWith('self_attention.')) p = p.replace('self_attention.', 'self_attn.');
      if (p.startsWith('attention.')) p = p.replace('attention.', 'self_attn.');
      if (p.startsWith('attn.')) p = p.replace('attn.', 'self_attn.');
      if (p.startsWith('mha.')) p = p.replace('mha.', 'self_attn.');
      // mlp block
      if (p.startsWith('ffn.')) p = p.replace('ffn.', 'mlp.');
      if (p.startsWith('feed_forward.')) p = p.replace('feed_forward.', 'mlp.');
      return p;
    }
    if (weights) {
      for (const [key, value] of weights) {
        let consumed = false;
        if (key.startsWith('transformer.')) {
          const parts = key.replace('transformer.', '').split('.');
          const layer_idx = parseInt(parts[0]);
          const param_name = parts.slice(1).join('.');
          ensureLayer(layer_idx);
          transformer_weights.get(`layer_${layer_idx}`)!.set(normalizeParamPath(param_name), value);
          consumed = true;
        }
        if (!consumed && key.startsWith('layers.')) {
          // e.g., layers.0.self_attn.q_proj.weight
          const parts = key.replace('layers.', '').split('.');
          const layer_idx = parseInt(parts[0]);
          const param_name = parts.slice(1).join('.');
          ensureLayer(layer_idx);
          transformer_weights.get(`layer_${layer_idx}`)!.set(normalizeParamPath(param_name), value);
          consumed = true;
        }
        if (!consumed && key.startsWith('model.layers.')) {
          const parts = key.replace('model.layers.', '').split('.');
          const layer_idx = parseInt(parts[0]);
          const param_name = parts.slice(1).join('.');
          ensureLayer(layer_idx);
          transformer_weights.get(`layer_${layer_idx}`)!.set(normalizeParamPath(param_name), value);
          consumed = true;
        }
      }
    }
    await this.transformer.init(transformer_weights);
    // Optional final transformer norm weight
    const finalNorm = weights?.get('transformer.norm.weight')
                  || weights?.get('model.norm.weight')
                  || weights?.get('output_norm.weight')
                  || weights?.get('norm.weight');
    if (finalNorm) {
      this.transformer.setFinalNormWeight(finalNorm as any);
    }
    // capture simple per-layer param counts for debugging/health
    this.transformerLayerParamsCount = [];
    for (let i = 0; i < this.config.transformer.num_layers; i++) {
      const m = transformer_weights.get(`layer_${i}`);
      this.transformerLayerParamsCount.push(m ? m.size : 0);
    }

    const toh = weights?.get('text_out_head.weight') || null;
    if (toh) {
      const w = toh as any;
      const shp = w.shape as number[];
      const d_model = this.config.transformer.d_model;
      const vocab = this.config.text_out_vocab_size;
      // Orient to [vocab, d_model]
      if (shp.length === 2) {
        if (shp[0] === vocab && shp[1] === d_model) this.text_out_head = w;
        else if (shp[0] === d_model && shp[1] === vocab) this.text_out_head = mx.transpose(w, [1, 0]);
        else this.text_out_head = w; // leave as-is; matmul path may fail if mismatched
      } else {
        this.text_out_head = w;
      }
    }

    for (let i = 0; i < this.config.audio_codebooks; i++) {
      const w = weights?.get(`audio_out_heads.${i}.weight`);
      if (w) {
        const ww = w as any;
        const shp = ww.shape as number[];
        const d_model = this.config.transformer.d_model;
        const vocab = this.config.audio_vocab_size;
        if (shp.length === 2) {
          if (shp[0] === vocab && shp[1] === d_model) this.audio_out_heads.push(ww);
          else if (shp[0] === d_model && shp[1] === vocab) this.audio_out_heads.push(mx.transpose(ww, [1, 0]));
          else this.audio_out_heads.push(ww);
        } else {
          this.audio_out_heads.push(ww);
        }
      }
    }
    if (weights && (this.text_out_head || this.audio_out_heads.length > 0)) {
      this.weightsLoaded = true;
    }
  }

  /**
   * Load safetensors or converted weights. This is a placeholder for a real loader.
   * Callers must provide parsed parameter tensors keyed as in init().
   */
  async loadWeights(parsed: Map<string, any>): Promise<void> {
    await this.init(parsed);
    if (!this.weightsLoaded) throw new Error('LmModel.loadWeights: no valid weights applied');
  }

  isReady(): boolean {
    return this.weightsLoaded;
  }

  debugInfo(): Record<string, unknown> {
    return {
      ready: this.weightsLoaded,
      text_out_head: this.text_out_head ? (this.text_out_head as any).shape : null,
      audio_out_heads: this.audio_out_heads.map((h) => (h as any).shape),
      audio_codebooks: this.config.audio_codebooks,
      transformer: {
        num_layers: this.config.transformer.num_layers,
        d_model: this.config.transformer.d_model,
        num_heads: this.config.transformer.num_heads,
        layer_param_counts: this.transformerLayerParamsCount,
      },
    };
  }

  private createCausalMask(seq_len: number): mx.array {
    const mask = mx.zeros([seq_len, seq_len]);
    const indices = mx.arange(seq_len);
    
    for (let i = 0; i < seq_len; i++) {
      for (let j = i + 1; j < seq_len; j++) {
        mask.index_put_([i, j], mx.array(-1e9));
      }
    }
    
    return mask;
  }

  forward(
    text_tokens: mx.array,
    audio_codes: mx.array[],
    cache?: Map<string, any>
  ): { text_logits: mx.array; audio_logits: mx.array[] } {
    if (!this.weightsLoaded) throw new Error('LmModel.forward: weights not loaded');
    const B = text_tokens.shape[0];
    const T = text_tokens.shape[1];

    let h = this.text_emb.forward(text_tokens);

    for (let i = 0; i < audio_codes.length && i < this.audio_emb.length; i++) {
      const audio_emb = this.audio_emb[i].forward(audio_codes[i]);
      const delay = this.config.audio_delays[i] || 0;
      
      if (delay > 0) {
        const padding = mx.zeros([B, delay, h.shape[2]]);
        const shifted = mx.concatenate([padding, audio_emb], 1);
        h = mx.add(h, shifted.slice([null, [0, T], null]));
      } else {
        h = mx.add(h, audio_emb);
      }
    }

    const mask = this.config.transformer.causal ? this.createCausalMask(T) : undefined;
    const transformer_cache = cache?.get('transformer') as Map<number, Map<string, mx.array>> | undefined;
    
    h = this.transformer.forward(h, mask, transformer_cache);

    const text_logits = this.text_out_head ? mx.matmul(h, mx.transpose(this.text_out_head)) : mx.zeros([B, T, this.config.text_out_vocab_size]);

    const audio_logits: mx.array[] = [];
    for (let i = 0; i < this.audio_out_heads.length; i++) {
      const logits = mx.matmul(h, mx.transpose(this.audio_out_heads[i]));
      audio_logits.push(logits);
    }

    return { text_logits, audio_logits };
  }

  generate(
    text_prompt: mx.array,
    audio_prompt: mx.array[],
    max_tokens = 100,
    temperature = 0.7,
    top_p = 0.95
  ): { text_tokens: mx.array; audio_codes: mx.array[] } {
    if (!this.weightsLoaded) throw new Error('LmModel.generate: weights not loaded');
    const B = text_prompt.shape[0];
    let text_tokens = text_prompt;
    const audio_codes = audio_prompt.slice();

    const cache = new Map<string, any>();
    cache.set('transformer', new Map<number, Map<string, mx.array>>());

    for (let step = 0; step < max_tokens; step++) {
      const { text_logits, audio_logits } = this.forward(
        text_tokens.slice([null, [-1, null]]),
        audio_codes.map(c => c.slice([null, [-1, null]])),
        cache
      );

      const last_text_logits = text_logits.index([null, -1, null]);
      const scaled_logits = mx.divide(last_text_logits, temperature);
      
      const probs = mx.softmax(scaled_logits, -1);
      const next_text = mx.argmax(probs, -1);
      
      text_tokens = mx.concatenate([text_tokens, mx.expand_dims(next_text, 1)], 1);

      for (let i = 0; i < audio_logits.length; i++) {
        const last_audio_logits = audio_logits[i].index([null, -1, null]);
        const scaled_audio = mx.divide(last_audio_logits, temperature);
        const audio_probs = mx.softmax(scaled_audio, -1);
        const next_audio = mx.argmax(audio_probs, -1);
        
        audio_codes[i] = mx.concatenate([audio_codes[i], mx.expand_dims(next_audio, 1)], 1);
      }

      const eos_token = this.config.text_out_vocab_size - 1;
      if (mx.all(mx.equal(next_text, eos_token)).item()) {
        break;
      }
    }

    return { text_tokens, audio_codes };
  }

  /**
   * Single-step generation with caches and acoustic delays.
   * Note: requires proper weights and cache plumbing.
   */
  /**
   * Apply acoustic delays per codebook to align audio tokens with text, based on config.audio_delays.
   * TODO: Implement masking/shift when caches are in place; for now, returns tokens unchanged.
   */
  private applyAudioDelays(audio_tokens: mx.array[], cache?: Map<string, any>): mx.array[] {
    // Minimal, cache-aware delay: for each codebook i with delay d>0, suppress early tokens
    // by substituting a zero token until d steps have elapsed for that codebook.
    // This preserves shapes [B,1] and begins aligning audio vs text without full sequence caches.
    const delays = this.config.audio_delays || [];
    if (!delays.length) return audio_tokens;

    // Keep simple counters in cache under 'audio_delay_steps'
    let delayState = cache?.get('audio_delay_steps') as Map<number, number> | undefined;
    if (!delayState) {
      delayState = new Map<number, number>();
      if (cache) cache.set('audio_delay_steps', delayState);
    }

    const out: mx.array[] = [];
    for (let i = 0; i < audio_tokens.length; i++) {
      const tok = audio_tokens[i]; // [B,1]
      const d = delays[i] ?? 0;
      const seen = delayState.get(i) ?? 0;
      // Increment seen count each step
      delayState.set(i, seen + 1);
      if (d > 0 && seen < d) {
        // Substitute zero token id during delay period
        const zeroTok = mx.array([[0]], 'int32');
        out.push(zeroTok);
      } else {
        out.push(tok);
      }
    }
    return out;
  }

  step(
    text_token: mx.array,      // [B, 1]
    audio_tokens: mx.array[],  // [B, 1] per codebook
    cache?: Map<string, any>
  ): { next_text: mx.array; next_audio: mx.array[] } {
    if (!this.weightsLoaded) throw new Error('LmModel.step: weights not loaded');
    const delayedAudio = this.applyAudioDelays(audio_tokens, cache);
    const { text_logits, audio_logits } = this.forward(text_token, delayedAudio, cache);
    const last_text_logits = text_logits.index([null, -1, null]);
    const next_text = mx.argmax(mx.softmax(last_text_logits, -1), -1);
    const next_audio: mx.array[] = [];
    for (let i = 0; i < audio_logits.length; i++) {
      const last_audio = audio_logits[i].index([null, -1, null]);
      next_audio.push(mx.argmax(mx.softmax(last_audio, -1), -1));
    }
    return { next_text, next_audio };
  }

  /**
   * Returns last-step logits without sampling so callers can apply Transformers-like sampling.
   */
  stepWithLogits(
    text_token: mx.array,      // [B, 1]
    audio_tokens: mx.array[],  // [B, 1]
    cache?: Map<string, any>
  ): { text_logits: mx.array; audio_logits: mx.array[] } {
    if (!this.weightsLoaded) throw new Error('LmModel.stepWithLogits: weights not loaded');
    const { text_logits, audio_logits } = this.forward(text_token, audio_tokens, cache);
    // Return only the last position logits (B, vocab) for text and audio heads
    const last_text_logits = text_logits.index([null, -1, null]);
    const last_audio_logits: mx.array[] = [];
    for (let i = 0; i < audio_logits.length; i++) {
      last_audio_logits.push(audio_logits[i].index([null, -1, null]));
    }
    return { text_logits: last_text_logits, audio_logits: last_audio_logits };
  }
}

export function createLmConfigFromDict(data: any): LmConfig {
  const transformer = {
    d_model: data.dim,
    num_heads: data.num_heads,
    num_layers: data.num_layers,
    dim_feedforward: 4 * data.dim,
    causal: data.causal,
    norm_first: true,
    bias_ff: false,
    bias_attn: false,
    layer_scale: data.layer_scale,
    context: data.context,
    max_period: data.max_period,
    use_conv_block: false,
    use_conv_bias: true,
    cross_attention: data.cross_attention || false,
    gating: true,
    norm: "rms_norm",
    positional_embedding: data.positional_embedding,
    conv_layout: false,
    conv_kernel_size: 3,
    kv_repeat: 1,
    max_seq_len: 4096,
  };

  const depformer: DepFormerConfig = {
    transformer: {
      d_model: data.depformer_dim,
      num_heads: data.depformer_num_heads,
      num_layers: data.depformer_num_layers,
      dim_feedforward: data.depformer_dim_feedforward,
      causal: data.depformer_causal ?? true,
      norm_first: true,
      bias_ff: false,
      bias_attn: data.depformer_layer_scale ?? false,
      layer_scale: null,
      context: data.depformer_context ?? data.dep_q,
      max_period: data.depformer_max_period ?? 8,
      use_conv_block: false,
      use_conv_bias: true,
      cross_attention: false,
      gating: true,
      norm: "rms_norm",
      positional_embedding: data.depformer_pos_emb,
      conv_layout: false,
      conv_kernel_size: 3,
      kv_repeat: 1,
      max_seq_len: 4096,
    },
    num_slices: data.dep_q,
    weights_per_step_schedule: data.depformer_weights_per_step_schedule || null,
    low_rank_embeddings: data.depformer_low_rank_embeddings || null,
  };

  return {
    transformer,
    depformer,
    text_in_vocab_size: data.text_card + 1,
    text_out_vocab_size: data.text_card,
    audio_vocab_size: data.card + 1,
    audio_delays: data.delays.slice(1),
    audio_codebooks: data.n_q,
    demux_second_stream: data.demux_second_stream || false,
    conditioners: data.conditioners || {},
    extra_heads_dim: data.extra_heads_dim || 6,
    extra_heads_num_heads: data.extra_heads_num_heads || 0,
  };
}
