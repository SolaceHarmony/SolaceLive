#!/usr/bin/env node
/**
 * Dry-run the TypeScript LLaMA transformer with random weights.
 * Useful to validate shapes/ops without loading a real GGUF.
 */
import mlx from '@frost-beta/mlx';
const { core: mx } = mlx;
import { LlamaModel } from '../lib/unified/models/llama/model.ts';

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
}

const cfg = {
  d_model: arg('--d_model', 64),
  n_heads: arg('--n_heads', 8),
  n_layers: arg('--n_layers', 2),
  vocab: arg('--vocab', 1000),
};
const T = arg('--T', 4);

function rand(shape) {
  const n = shape.reduce((a, b) => a * b, 1);
  const arr = Float32Array.from({ length: n }, () => (Math.random() * 0.02) - 0.01);
  return mx.array(Array.from(arr)).reshape(shape);
}

function ones(shape) { return mx.ones(shape); }

function buildWeights(cfg) {
  const W = new Map();
  const D = cfg.d_model;
  const H = 4 * D;
  // Embeddings and output
  W.set('text_emb.weight', rand([cfg.vocab, D]));
  W.set('text_out_head.weight', rand([cfg.vocab, D]));
  // Layers
  for (let i = 0; i < cfg.n_layers; i++) {
    W.set(`transformer.${i}.self_attn.q_proj`, rand([D, D]));
    W.set(`transformer.${i}.self_attn.k_proj`, rand([D, D]));
    W.set(`transformer.${i}.self_attn.v_proj`, rand([D, D]));
    W.set(`transformer.${i}.self_attn.o_proj`, rand([D, D]));
    W.set(`transformer.${i}.mlp.w1`, rand([D, H]));
    W.set(`transformer.${i}.mlp.w2`, rand([H, D]));
    W.set(`transformer.${i}.mlp.w3`, rand([D, H]));
    W.set(`transformer.${i}.norm1.weight`, ones([D]));
    W.set(`transformer.${i}.norm2.weight`, ones([D]));
  }
  W.set('transformer.norm.weight', ones([D]));
  return W;
}

async function main() {
  console.log('[llama-dry-run] Config:', cfg, 'T=', T);
  const weights = buildWeights(cfg);
  const llama = new LlamaModel(cfg);
  llama.init(weights);
  console.log('[llama-dry-run] Model initialized');
  const tokens = Array.from({ length: T }, (_, i) => (i + 1) % cfg.vocab);
  const logits = llama.forwardTokenIds(tokens, 0); // [1,T,vocab]
  const arr3 = logits.tolist();
  const last = arr3[0][arr3[0].length - 1]; // [vocab]
  const arr = last;
  const scores = arr.map((v, idx) => ({ idx, v }));
  scores.sort((a, b) => b.v - a.v);
  const top5 = scores.slice(0, 5);
  console.log('[llama-dry-run] Top-5 token ids for last position:', top5);
}

main().catch((e) => {
  console.error('[llama-dry-run] Error:');
  console.error(e?.stack || e);
  process.exit(1);
});
