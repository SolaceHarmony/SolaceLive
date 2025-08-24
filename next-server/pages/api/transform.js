import { NextResponse } from 'next/server';
import Transformers from '@huggingface/transformers';

let pipeline = null;

async function getPipeline() {
  if (pipeline) return pipeline;
  // create a text-generation pipeline using the transformers.js node backend
  pipeline = await Transformers.pipeline('text-generation', {
    model: 'gpt2',
  });
  return pipeline;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'missing prompt' });
  try {
    const p = await getPipeline();
    const out = await p(prompt, { max_length: 64 });
    return res.status(200).json({ result: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
