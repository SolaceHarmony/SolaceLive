import type { NextApiRequest, NextApiResponse } from 'next';

function deriveBaseUrl(): string {
  const explicit = process.env.PACKET_SERVER_URL;
  if (explicit) return explicit;
  const ws = process.env.NEXT_PUBLIC_PACKET_WS;
  if (ws) {
    if (ws.startsWith('wss://')) return ws.replace(/^wss:\/\//, 'https://');
    if (ws.startsWith('ws://')) return ws.replace(/^ws:\/\//, 'http://');
  }
  return 'http://localhost:8788';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const base = deriveBaseUrl();
  const url = `${base.replace(/\/$/, '')}/weights`;

  try {
    const r = await globalThis.fetch(url);
    const j = await r.json().catch(() => ({}));
    return res.status(200).json({ ok: r.ok, status: r.status, url, data: j, base });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ ok: false, error: message, url, base });
  }
}

