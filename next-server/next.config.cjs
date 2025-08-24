/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@huggingface/transformers'],
};

module.exports = nextConfig;
