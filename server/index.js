import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { pipeline, read_audio } from '@huggingface/transformers';
import { decode as decodeWav } from 'node-wav';

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

function getPreferredDevice() {
  return process.env.TFJS_DEVICE || undefined;
}

// Health
app.get('/health', (req, res) => {
  res.json({ ok: true, device: getPreferredDevice() || 'auto' });
});

// Embeddings
app.post('/api/embeddings', async (req, res) => {
  try {
    const { texts, modelId = 'mixedbread-ai/mxbai-embed-xsmall-v1', dtype = 'q4' } = req.body || {};
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'texts[] is required' });
    }

    const extractor = await pipeline('feature-extraction', modelId, {
      device: getPreferredDevice(),
      dtype,
    });

    const embs = await extractor(texts, { pooling: 'mean', normalize: true });
    const out = Array.isArray(embs) && typeof embs[0]?.tolist === 'function'
      ? embs.map((e) => e.tolist())
      : (embs.tolist ? embs.tolist() : embs);

    res.json({ embeddings: out });
  } catch (err) {
    console.error('embeddings error', err);
    res.status(500).json({ error: String(err) });
  }
});

async function decodeToFloat32PCM(inputBytes, targetRate = 16000) {
  // inputBytes: Buffer | Uint8Array | ArrayBuffer
  const buf = Buffer.isBuffer(inputBytes)
    ? inputBytes
    : Buffer.from(inputBytes.buffer || inputBytes);
  const { sampleRate, channelData } = decodeWav(buf);
  // Mix to mono
  const length = channelData[0].length;
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let ch = 0; ch < channelData.length; ch++) sum += channelData[ch][i] || 0;
    mono[i] = sum / channelData.length;
  }
  if (sampleRate === targetRate) return mono;
  // Linear resample to targetRate
  const ratio = sampleRate / targetRate;
  const outLen = Math.floor(mono.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const t = srcPos - i0;
    out[i] = mono[i0] * (1 - t) + mono[i1] * t;
  }
  return out;
}

// ASR: accept url or uploaded file (decode to Float32Array in Node; fallback to read_audio)
app.post('/api/asr', upload.single('file'), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { url, modelId = 'onnx-community/whisper-tiny.en', sampleRate = 16000 } = body || {};

    const transcriber = await pipeline('automatic-speech-recognition', modelId, {
      device: getPreferredDevice(),
    });

    let audioFloats;
    if (url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`failed to fetch audio: ${r.status} ${r.statusText}`);
      const ab = await r.arrayBuffer();
      try {
        audioFloats = await decodeToFloat32PCM(Buffer.from(ab), sampleRate);
      } catch (e) {
        // Fallback to generic decoder
        audioFloats = await read_audio(new Uint8Array(ab), sampleRate);
      }
    } else if (req.file) {
      try {
        audioFloats = await decodeToFloat32PCM(req.file.buffer, sampleRate);
      } catch (e) {
        audioFloats = await read_audio(new Uint8Array(req.file.buffer), sampleRate);
      }
    } else {
      return res.status(400).json({ error: 'Provide url or file' });
    }

    const output = await transcriber(audioFloats);
    res.json({ text: output?.text || '' });
  } catch (err) {
    console.error('asr error', err);
    res.status(500).json({ error: String(err) });
  }
});

// Text generation / chat
app.post('/api/generate', async (req, res) => {
  try {
    const {
      messages,
      prompt,
      modelId = 'onnx-community/Qwen2.5-0.5B-Instruct',
      max_new_tokens = 256,
      dtype = 'q4',
    } = req.body || {};

    const generator = await pipeline('text-generation', modelId, {
      device: getPreferredDevice(),
      dtype,
    });

    let result;
    if (Array.isArray(messages)) {
      result = await generator(messages, { max_new_tokens });
    } else if (typeof prompt === 'string') {
      result = await generator(prompt, { max_new_tokens });
    } else {
      return res.status(400).json({ error: 'Provide messages[] or prompt' });
    }

    let text;
    if (Array.isArray(result) && result[0]?.generated_text) {
      const gt = result[0].generated_text;
      text = Array.isArray(gt) ? gt.at(-1)?.content ?? '' : gt;
    } else {
      text = String(result);
    }

    res.json({ text });
  } catch (err) {
    console.error('generate error', err);
    res.status(500).json({ error: String(err) });
  }
});

// Lightweight Hugging Face mirror: proxy files and API under /hf/*
// Example: /hf/onnx-community/whisper-large-v3-turbo/resolve/main/config.json
app.all('/hf/*', async (req, res) => {
  try {
    const upstream = `https://huggingface.co${req.originalUrl.replace(/^\/hf/, '')}`;
    const headers = new Headers();
    // Forward client Authorization if present
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth) {
      headers.set('authorization', auth);
    } else if (process.env.HF_TOKEN) {
      headers.set('authorization', `Bearer ${process.env.HF_TOKEN}`);
    }
    // Preserve conditional headers to support caching
    const condHeaders = ['if-none-match', 'if-modified-since'];
    for (const h of condHeaders) {
      const v = req.headers[h];
      if (typeof v === 'string') headers.set(h, v);
    }

    const r = await fetch(upstream, { method: req.method, headers });
    res.status(r.status);
    // Copy response headers (avoid hop-by-hop headers)
    r.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    if (req.method === 'HEAD' || r.status === 304) {
      return res.end();
    }
    const ab = await r.arrayBuffer();
    return res.send(Buffer.from(ab));
  } catch (err) {
    console.error('hf proxy error', err);
    res.status(502).json({ error: String(err) });
  }
});

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
