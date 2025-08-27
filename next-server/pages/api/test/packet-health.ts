import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const base = process.env.PACKET_SERVER_URL || 'http://localhost:8788';
  const url = `${base.replace(/\/$/, '')}/health`;

  try {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    return res.status(200).json({ ok: r.ok, status: r.status, url, data: j });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ ok: false, error: message, url });
  }
}

