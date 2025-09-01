import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const path = typeof req.query.path === 'string' ? req.query.path : undefined;
  if (!path) {
    return res.status(400).json({ error: 'Missing `path` query. Example: onnx-community/whisper-base.en/resolve/main/config.json' });
  }

  // Construct absolute URL to our own proxy route
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host || 'localhost:3000';
  const base = `${proto}://${host}`;
  const url = `${base}/api/hf/${path.replace(/^\/+/, '')}`;

  try {
    const upstream = await globalThis.fetch(url, { method: 'HEAD' });
    return res.status(200).json({ ok: upstream.ok, status: upstream.status, url, base });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ ok: false, error: message, url, base });
  }
}

