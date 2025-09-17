#!/usr/bin/env node
/**
 * Lightweight loader test for GGUF: loads a subset of tensors to verify
 * parsing and tensor construction without allocating giant embeddings.
 *
 * Usage:
 *  npm run load:gguf -- models/gemma3-12b-csm-3.gguf
 *  npm run load:gguf -- models/gemma3-12b-csm-3.gguf --max-layers 1
 */
import { loadLmFromGGUF, readGGUF } from '../backend/models/gguf/gguf.ts';
import path from 'node:path';

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

function firstPositional() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  return args.length ? args[0] : undefined;
}

async function main() {
  const gguf = arg('--gguf', firstPositional());
  const maxLayersStr = arg('--max-layers', '1');
  const noCap = process.argv.includes('--no-cap');
  const includeGiants = process.argv.includes('--include-giants');
  if (!gguf) {
    console.error('Usage: npm run load:gguf -- models/your.gguf [--max-layers N]');
    process.exit(2);
  }
  const abs = path.resolve(gguf);
  const maxLayers = parseInt(maxLayersStr, 10);

  console.log('[load-gguf-lite] File:', abs);
  const { kv } = await readGGUF(abs);
  const n_layer = Number((kv['llama.block_count'] ?? kv['gemma3.block_count'] ?? kv['block_count'] ?? kv['n_layer'] ?? 0));
  const n_head = Number((kv['llama.attention.head_count'] ?? kv['gemma3.attention.head_count'] ?? kv['n_head'] ?? 0));
  const d_model = Number((kv['llama.embedding_length'] ?? kv['gemma3.embedding_length'] ?? kv['n_embd'] ?? 0));
  console.log('[load-gguf-lite] Header:', { n_layer, n_head, d_model });

  const include = (name) => {
    if (name === 'text_emb.weight' || name === 'text_out_head.weight') return includeGiants;
    // Only load first few layers' core weights
    const m = name.match(/^transformer\.(\d+)\./);
    if (!m) return false;
    const layer = parseInt(m[1], 10);
    return layer < maxLayers;
  };

  // Cap per-tensor bytes to keep memory small for a smoke test
  const opts = noCap ? { maxLayers, include } : { maxLayers, include, maxBytesPerTensor: 2 * 1024 * 1024 };
  if (noCap) console.log('[load-gguf-lite] Running with no per-tensor byte cap');
  const { weights, meta } = await loadLmFromGGUF(abs, { ...opts, outDType: 'f16', progress: (name) => console.log('[load-gguf-lite] Loading:', name) });
  console.log('[load-gguf-lite] Loaded tensors:', weights.size);
  for (const [k, v] of weights.entries()) {
    console.log('  -', k, 'shape=', v.shape);
  }
  console.log('[load-gguf-lite] Meta:', meta);
}

main().catch((e) => {
  console.error('[load-gguf-lite] Error:');
  console.error(e?.stack || e);
  process.exit(1);
});
