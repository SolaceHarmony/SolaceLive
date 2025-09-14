import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  // This Python-based GGUF info proxy has been deprecated in favor of a TypeScript-only endpoint.
  // Use /api/test/ts-gguf-inspect?file=/absolute/path/to/model.gguf instead.
  return res.status(410).json({
    ok: false,
    error: 'Deprecated. Use /api/test/ts-gguf-inspect?file=/absolute/path/to/model.gguf',
  });
}
