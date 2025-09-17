#!/usr/bin/env node
/**
 * Local GGUF test harness:
 *  - Loads a GGUF from --gguf or $LM_GGUF
 *  - Builds LLaMA model with MLX tensors
 *  - Runs a small forward pass and prints top-5 token ids for the last position
 */
import { loadLmFromGGUF } from '../backend/models/gguf/gguf.ts';
import { LlamaModel } from '../backend/models/llama/model.ts';

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

async function main() {
  const gguf = arg('--gguf', process.env.LM_GGUF);
  const maxLayersStr = arg('--max-layers', null);
  if (!gguf) {
    console.error('Usage: node scripts/test-gguf.mjs --gguf /path/to/model.gguf [--max-layers N]');
    process.exit(2);
  }
  console.log('[test-gguf] Loading GGUF:', gguf);
  const maxLayers = maxLayersStr ? parseInt(maxLayersStr, 10) : undefined;
  const { weights, meta } = await loadLmFromGGUF(gguf, { maxLayers });
  console.log('[test-gguf] GGUF meta:', meta);

  const cfg = { d_model: meta.d_model, n_heads: meta.n_head, n_layers: meta.n_layer, vocab: meta.n_vocab };
  const llama = new LlamaModel(cfg);
  llama.init(weights);
  console.log('[test-gguf] Model initialized');

  // Build a small token sequence within vocab
  const T = 4;
  const tokens = Array.from({ length: T }, (_, i) => (i + 1) % meta.n_vocab);
  const logits = llama.forwardTokenIds(tokens, 0); // [1,T,vocab]
  const last = logits.index([0, -1, null]);

  // Top-5
  const arr = (last.tolist());
  const scores = arr.map((v, idx) => ({ idx, v }));
  scores.sort((a, b) => b.v - a.v);
  const top5 = scores.slice(0, 5);
  console.log('[test-gguf] Top-5 token ids for last position:', top5);
}

main().catch((e) => {
  console.error('[test-gguf] Error:');
  try {
    if (e && e.stack) console.error(e.stack);
    else console.dir(e, { depth: 5 });
  } catch (err) {
    console.error(e);
  }
  process.exit(1);
});
