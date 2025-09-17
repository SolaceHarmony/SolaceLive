import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

// Simple Hugging Face proxy for browser model assets.
// Usage: /api/hf/<org>/<repo>/resolve/main/<file>
// Reads HF_TOKEN from server env and forwards GET/HEAD with auth.

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const parts = (req.query.path ?? []) as string[];
  if (!Array.isArray(parts) || parts.length < 3) {
    return res.status(400).json({ error: 'Malformed path. Expected /api/hf/<org>/<repo>/...' });
  }

  const url = `https://huggingface.co/${parts.map(encodeURIComponent).join('/')}`;
  const headers: Record<string, string> = {};
  const token = process.env.HF_TOKEN;
  if (token) headers['authorization'] = `Bearer ${token}`;

  try {
    const upstream = await fetch(url, { method: req.method, headers });
    // Propagate status and selected headers
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      // Avoid sending hop-by-hop and security-sensitive headers directly
      const k = key.toLowerCase();
      if (k === 'transfer-encoding' || k === 'content-encoding') return;
      res.setHeader(key, value);
    });

    if (req.method === 'HEAD') {
      return res.end();
    }

    // Stream body through
    const body = upstream.body;
    if (!body) {
      return res.end();
    }
    const nodeStream = Readable.fromWeb(body as WebReadableStream<Uint8Array>);
    nodeStream.pipe(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: `Proxy failure: ${msg}` });
  }
}
