#!/usr/bin/env node
/**
 * Inspect a GGUF file without loading weights.
 * Prints core hparams, dtype breakdown, and rough sizes.
 * Usage:
 *   npm run inspect:gguf -- models/your.gguf
 *   or: node scripts/inspect-gguf.mjs --gguf models/your.gguf
 */
import { readGGUF } from '../backend/models/gguf/gguf.ts';
import path from 'node:path';

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

function firstPositional() {
  // after the script name
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  return args.length ? args[0] : undefined;
}

async function main() {
  const gguf = arg('--gguf', process.env.LM_GGUF) || firstPositional();
  if (!gguf) {
    console.error('Usage: npm run inspect:gguf -- models/your.gguf');
    console.error('   or: node scripts/inspect-gguf.mjs --gguf models/your.gguf');
    process.exit(2);
  }

  const abs = path.resolve(gguf);
  console.log(`[inspect-gguf] Inspecting: ${abs}`);
  const { kv, tensors } = await readGGUF(abs);

  const n_layer = Number((kv['llama.block_count'] ?? kv['gemma3.block_count'] ?? kv['block_count'] ?? kv['n_layer'] ?? 0));
  const n_head = Number((kv['llama.attention.head_count'] ?? kv['gemma3.attention.head_count'] ?? kv['n_head'] ?? 0));
  const d_model = Number((kv['llama.embedding_length'] ?? kv['gemma3.embedding_length'] ?? kv['n_embd'] ?? 0));
  let n_vocab = Number((kv['llama.vocab_size'] ?? kv['gemma3.vocab_size'] ?? kv['vocab_size'] ?? 0));
  if (!n_vocab) {
    const tok = tensors.find(t => ['tok_embeddings.weight','token_embd.weight','embeddings.weight','token_embedding.weight','tok_emb.weight'].includes(t.name));
    if (tok) {
      const [a, b] = tok.dims;
      n_vocab = Math.max(a, b);
    }
  }

  console.log('[inspect-gguf] Core hparams:');
  console.log(`  layers: ${n_layer}`);
  console.log(`  heads:  ${n_head}`);
  console.log(`  d_model:${d_model}`);
  console.log(`  vocab:  ${n_vocab}`);

  const byDType = new Map();
  let totalElems = 0n;
  for (const t of tensors) {
    const dt = String(t.dtype).toUpperCase();
    byDType.set(dt, (byDType.get(dt) || 0) + 1);
    const elems = BigInt(t.dims.reduce((a, b) => a * b, 1));
    totalElems += elems;
  }
  console.log('[inspect-gguf] Tensor dtypes:');
  for (const [dt, cnt] of byDType.entries()) {
    console.log(`  ${dt}: ${cnt}`);
  }

  // Rough on-disk size estimate by dtype (not exact for quantized)
  const sizePer = (dt) => (dt === 'F32' ? 4 : dt === 'F16' || dt === 'BF16' ? 2 : null);
  let supported = true;
  for (const [dt] of byDType.entries()) {
    if (sizePer(dt) == null) supported = false;
  }
  console.log(`[inspect-gguf] Loader support: ${supported ? 'OK (F32/F16/BF16 only)' : 'Quantized tensors present; current loader will not load them'}`);

  console.log('[inspect-gguf] Sample tensors:');
  for (const t of tensors.slice(0, 8)) {
    console.log(`  - ${t.name} :: [${t.dims.join('x')}] <${t.dtype}>`);
  }
}

main().catch((e) => {
  console.error('[inspect-gguf] Error:');
  console.error(e?.stack || e);
  process.exit(1);
});
