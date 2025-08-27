import type { NextApiRequest, NextApiResponse } from 'next';
import { moshiServiceSingleton } from '../../../lib/moshi-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await moshiServiceSingleton.init();
    const url = await moshiServiceSingleton.getServerUrl();
    return res.status(400).json({
      error: 'Unsupported in HTTP. Use the Python MLX WebSocket.',
      websocket: `${url}/api/chat`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message || 'Internal Error' });
  }
}

