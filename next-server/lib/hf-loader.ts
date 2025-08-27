import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
const _fetch = (globalThis as any).fetch as unknown as (input: string, init?: any) => Promise<any>;

export interface HFResolved {
  repo: string;
  file: string;
  url: string;
}

function isHttpUrl(s: string): boolean {
  return s.startsWith('http://') || s.startsWith('https://');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function resolveHFUrl(fileOrUri: string, hfRepo?: string): HFResolved | null {
  if (fileOrUri.startsWith('hf://')) {
    const rest = fileOrUri.slice('hf://'.length);
    const parts = rest.split('/');
    if (parts.length < 3) return null;
    const repo = parts.slice(0, 2).join('/');
    const file = parts.slice(2).join('/');
    const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
    return { repo, file, url };
  }
  if (hfRepo && !path.isAbsolute(fileOrUri) && !isHttpUrl(fileOrUri)) {
    const repo = hfRepo;
    const file = fileOrUri.replace(/^\/+/, '');
    const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
    return { repo, file, url };
  }
  return null;
}

function cachePathFor(url: string): string {
  const h = crypto.createHash('sha1').update(url).digest('hex');
  const base = path.join(os.homedir(), '.cache', 'solacelive', 'hf');
  return path.join(base, h);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function download(url: string, dest: string): Promise<string> {
  await ensureDir(path.dirname(dest));
  const headers: Record<string, string> = {};
  const t = process.env.HF_TOKEN;
  if (t) headers['authorization'] = `Bearer ${t}`;
  if (!_fetch) throw new Error('Global fetch is not available in this Node runtime');
  const res = await _fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const arr = new Uint8Array(await res.arrayBuffer());
  await fs.writeFile(dest, arr);
  return dest;
}

/**
 * Resolve a path/URI to a local file.
 * - Local absolute path -> returned as-is if exists
 * - hf://org/name/path or (file + hfRepo) -> downloads to cache and returns local path
 * - http(s)://... -> downloads to cache
 */
export async function hfGet(fileOrUri: string, hfRepo?: string): Promise<string> {
  if (path.isAbsolute(fileOrUri)) {
    return fileOrUri;
  }
  const hf = resolveHFUrl(fileOrUri, hfRepo);
  if (hf) {
    const dest = cachePathFor(hf.url);
    if (await fileExists(dest)) return dest;
    return download(hf.url, dest);
  }
  if (isHttpUrl(fileOrUri)) {
    const dest = cachePathFor(fileOrUri);
    if (await fileExists(dest)) return dest;
    return download(fileOrUri, dest);
  }
  // Relative local path from CWD
  const local = path.resolve(process.cwd(), fileOrUri);
  if (await fileExists(local)) return local;
  throw new Error(`hfGet: cannot resolve ${fileOrUri}`);
}
