import type { NextApiRequest, NextApiResponse } from 'next';
import { loadLmFromGGUF } from '../../../backend/models/gguf/gguf';
import { GGUFReader } from '../../../backend/models/gguf/reader';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const file = typeof req.query.file === 'string' ? req.query.file : undefined;
  const listTensors = String(req.query.tensors ?? '') === '1';
  if (!file) {
    return res.status(400).json({ ok: false, error: 'Missing required query param `file` pointing to a .gguf file' });
  }
  try {
    if (!listTensors) {
      // Use existing loader for meta-only to avoid reading data
      const { meta } = await loadLmFromGGUF(file, { include: () => false, maxLayers: 0 });
      return res.status(200).json({ ok: true, file, meta });
    }
    // tensors=1 path: use GGUFReader to list tensor table
    const r = await GGUFReader.open(file);
    try {
      const meta: Record<string, unknown> = {};
      r.fields.forEach((v, k) => { meta[k] = v as unknown; });
      const tensors = r.tensors.map(t => ({ name: t.name, shape: t.shape, dtype: t.dtype, nbytes: t.nbytes }));
      return res.status(200).json({ ok: true, file, meta, tensors });
    } finally {
      await r.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message, file });
  }
}
