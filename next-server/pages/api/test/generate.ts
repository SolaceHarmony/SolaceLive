import type { NextApiRequest, NextApiResponse } from 'next';
import { createMlxEngineFromEnv, createNextTextGenerateHandler } from '../../../backend/server/server';

// Module-level singleton engine promise to avoid reloading weights on every request
const enginePromise = createMlxEngineFromEnv();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const engine = await enginePromise;
  const handle = createNextTextGenerateHandler(engine);
  return handle(req as any, res as any);
}
