#!/usr/bin/env node
/**
 * Code Usage Report
 *
 * Scans the repo for .ts/.tsx files, builds an import graph from entrypoints,
 * and reports unreferenced (potentially dead) files and duplicate content groups.
 *
 * Usage: node scripts/code-usage-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Configuration
const INCLUDE_DIRS = [
  'pages',
  'lib',
  // scripts can be included for entry probing (smoke-test etc.)
  'scripts'
];

const EXCLUDE_PATTERNS = [
  '/node_modules/',
  '/.next/',
  '/experiments/',
  '/archive/unified/',
  '/types/', // decl-only
];

// Entrypoints to seed reachability analysis
const ENTRY_GLOBS = [
  'pages/**/*.tsx',
  'pages/**/*.ts',
  'pages/api/**/*.ts',
  'backend/server/server.ts',
  'scripts/smoke-test.mjs',
];

const exts = ['.ts', '.tsx', '.js', '.mjs'];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    const rel = p.replace(ROOT + path.sep, '');
    if (EXCLUDE_PATTERNS.some((x) => rel.includes(x.replace(/^\//, '')))) continue;
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function globToRegex(glob) {
  return new RegExp('^' + glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*') + '$');
}

function matches(glob, relPath) {
  return globToRegex(glob).test(relPath);
}

function isCodeFile(p) { return exts.some((e) => p.endsWith(e)); }

// Collect files
const files = [];
for (const d of INCLUDE_DIRS) {
  const dir = path.join(ROOT, d);
  if (fs.existsSync(dir)) files.push(...walk(dir));
}

const codeFiles = files.filter(isCodeFile);
const rel = (p) => p.replace(ROOT + path.sep, '');

// Build quick lookups
const fileSet = new Set(codeFiles.map(rel));

// Parse imports (very simple regex; good enough for relative paths)
const importRe = /import\s+(?:[^'";]+from\s+)?["']([^"']+)["']/g;

// Resolve import path to a relative code file path
function resolveImport(fromRel, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // external
  const fromAbs = path.join(ROOT, fromRel);
  const baseDir = path.dirname(fromAbs);
  const cand = [];
  // 1) as-is with extensions
  for (const e of exts) cand.push(path.join(baseDir, spec + e));
  // 2) directory index
  for (const e of exts) cand.push(path.join(baseDir, spec, 'index' + e));
  // 3) raw (if spec already has ext)
  cand.push(path.join(baseDir, spec));
  for (const c of cand) {
    const r = rel(c);
    if (fileSet.has(r)) return r;
  }
  return null;
}

// Build import graph
const imports = new Map(); // file -> Set<dep>
for (const fAbs of codeFiles) {
  const fRel = rel(fAbs);
  const txt = fs.readFileSync(fAbs, 'utf8');
  const deps = new Set();
  let m;
  while ((m = importRe.exec(txt))) {
    const spec = m[1];
    const r = resolveImport(fRel, spec);
    if (r) deps.add(r);
  }
  imports.set(fRel, deps);
}

// Determine entrypoints
const entrypoints = [];
for (const r of fileSet) {
  const rp = r.replace(/\\/g, '/');
  if (ENTRY_GLOBS.some((g) => matches(g, rp))) entrypoints.push(r);
}

// DFS reachable
const reachable = new Set();
function dfs(start) {
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || reachable.has(cur)) continue;
    reachable.add(cur);
    const deps = imports.get(cur);
    if (deps) for (const d of deps) stack.push(d);
  }
}

for (const e of entrypoints) dfs(e);

// Unreferenced files (excluding tests/examples and archive)
function classify(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (p.includes('/archive/')) return 'archive';
  if (p.includes('/reference/')) return 'reference';
  if (p.includes('/examples/') || p.includes('/tests/') || /test|spec\./.test(p)) return 'non-runtime';
  return 'runtime';
}

const unreferenced = [];
for (const f of fileSet) {
  if (!reachable.has(f) && classify(f) === 'runtime') unreferenced.push(f);
}

// Duplicate file content (hash)
const byHash = new Map();
for (const fAbs of codeFiles) {
  const r = rel(fAbs);
  if (classify(r) !== 'runtime') continue;
  const buf = fs.readFileSync(fAbs);
  const h = crypto.createHash('sha1').update(buf).digest('hex');
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push(r);
}
const duplicates = Array.from(byHash.entries())
  .map(([hash, arr]) => ({ hash, files: arr }))
  .filter((g) => g.files.length > 1);

// Report
const report = {
  summary: {
    totalFiles: codeFiles.length,
    entrypoints: entrypoints.length,
    reachable: reachable.size,
    unreferenced: unreferenced.length,
    duplicateGroups: duplicates.length,
  },
  entrypoints: entrypoints.sort(),
  unreferenced: unreferenced.sort(),
  duplicateGroups: duplicates,
};

console.log('Code Usage Report');
console.log(JSON.stringify(report, null, 2));
