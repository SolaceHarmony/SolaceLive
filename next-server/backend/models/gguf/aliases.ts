// Alias maps for common GGUF tensor naming across architectures
// This is an initial scaffold; will be expanded with more families (Mistral, Phi, Qwen, etc.).

export type AliasMap = Record<string, string[]>;

// Attention projections
export const ATTENTION_ALIASES: AliasMap = {
  q_proj: [
    'self_attn.q_proj.weight',
    'attention.wq.weight',
    'attn_q.weight',
    'wq.weight',
  ],
  k_proj: [
    'self_attn.k_proj.weight',
    'attention.wk.weight',
    'attn_k.weight',
    'wk.weight',
  ],
  v_proj: [
    'self_attn.v_proj.weight',
    'attention.wv.weight',
    'attn_v.weight',
    'wv.weight',
  ],
  o_proj: [
    'self_attn.o_proj.weight',
    'attention.wo.weight',
    'attn_output.weight',
    'attn_o.weight',
    'wo.weight',
  ],
};

// MLP / FFN weights
export const MLP_ALIASES: AliasMap = {
  w1: [
    'mlp.w1.weight',
    'feed_forward.w1.weight',
    'ffn_gate.weight',
    'ffn.w1.weight',
  ],
  w2: [
    'mlp.w2.weight',
    'feed_forward.w2.weight',
    'ffn_down.weight',
    'ffn.w2.weight',
  ],
  w3: [
    'mlp.w3.weight',
    'feed_forward.w3.weight',
    'ffn_up.weight',
    'ffn.w3.weight',
  ],
};

// Normalization weights
export const NORM_ALIASES: AliasMap = {
  attn_norm: [
    'norm1.weight',
    'attention_norm.weight',
    'attn_norm.weight',
    'input_layernorm.weight',
  ],
  ffn_norm: [
    'norm2.weight',
    'ffn_norm.weight',
    'post_attention_layernorm.weight',
  ],
  final_norm: [
    'transformer.norm.weight',
    'model.norm.weight',
    'output_norm.weight',
    'norm.weight',
  ],
};

export const EMBEDDING_ALIASES: AliasMap = {
  tok_embeddings: [
    'tok_embeddings.weight',
    'token_embd.weight',
    'embeddings.weight',
  ],
  lm_head: [
    'output.weight',
    'lm_head.weight',
  ],
};
