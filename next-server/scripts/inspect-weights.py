#!/usr/bin/env python3
"""
Inspect HF safetensors index and report mapping coverage for our MLX LM.

Usage:
  python3 scripts/inspect-weights.py --index /path/to/model.safetensors.index.json

Outputs summary of required keys, layer coverage, and unmapped prefixes.
"""
import json
import re
import argparse
from collections import defaultdict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--index', required=True, help='Path to model.safetensors.index.json')
    args = ap.parse_args()

    with open(args.index, 'r', encoding='utf-8') as f:
        idx = json.load(f)
    if 'weight_map' not in idx:
        raise SystemExit('Invalid index: missing weight_map')

    keys = list(idx['weight_map'].keys())
    print(f'Total tensors: {len(keys)}')

    have = set(keys)

    # Required top-level
    required = ['text_emb.weight', 'text_out_head.weight']
    for k in required:
        print(f'{k:>28}:', 'OK' if k in have else 'MISSING')

    # Audio heads/embs
    audio_emb = sorted(k for k in keys if re.match(r'^audio_emb\.\d+\.weight$', k))
    audio_out = sorted(k for k in keys if re.match(r'^audio_out_heads\.\d+\.weight$', k))
    print(f'audio_emb.*.weight count: {len(audio_emb)}')
    print(f'audio_out_heads.*.weight count: {len(audio_out)}')

    # Layer coverage (supports transformer.i.* | layers.i.* | model.layers.i.*)
    layer_prefixes = defaultdict(list)
    for k in keys:
        m = re.match(r'^(transformer|layers|model\.layers)\.(\d+)\.(.+)', k)
        if m:
            layer_prefixes[int(m.group(2))].append(m.group(3))

    if layer_prefixes:
        print(f'Found {len(layer_prefixes)} layers with any params')
        # Inspect first 2 layers for common blocks
        for i in sorted(layer_prefixes.keys())[:2]:
            params = layer_prefixes[i]
            def has(pfx):
                return any(s.startswith(pfx) for s in params)
            print(f'Layer {i}: attn: {has("self_attn.") or has("attention.") or has("attn.")}, '
                  f'mlp: {has("mlp.") or has("feed_forward.") or has("ffn.")}, '
                  f'norms: {has("norm1") or has("attention_norm")}/{has("norm2") or has("ffn_norm") or has("post_attention_layernorm")}')
    else:
        print('No transformer layer prefixes found.')

    # Unmapped prefixes (quick glance)
    known_prefixes = [
        'text_emb', 'text_out_head', 'audio_emb', 'audio_out_heads',
        'transformer', 'layers', 'model.layers', 'model.norm', 'output_norm', 'norm'
    ]
    top = defaultdict(int)
    for k in keys:
        top[k.split('.')[0]] += 1
    unknown = {p: c for p, c in top.items() if not any(p == kp.split('.')[0] for kp in known_prefixes)}
    if unknown:
        print('Unknown top-level prefixes:')
        for p, c in sorted(unknown.items(), key=lambda x: -x[1])[:10]:
            print(f'  {p}: {c}')

    print('Done.')


if __name__ == '__main__':
    main()

