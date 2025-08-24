import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@huggingface/transformers'],
  // Set the workspace root for output tracing to avoid Next inferring the wrong root
  outputFileTracingRoot: path.resolve(__dirname, '..'),
};

export default nextConfig;
