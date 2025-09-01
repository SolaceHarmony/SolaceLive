#!/usr/bin/env node
/**
 * Smoke test: boots packet server + Next dev, probes health + HF proxy.
 */
import { spawn } from 'node:child_process';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { method: 'GET' });
      if (r.ok || (r.status >= 200 && r.status < 500)) return r;
    } catch (e) {
      lastErr = e;
    }
    await wait(500);
  }
  throw lastErr || new Error(`Timeout waiting for ${url}`);
}

function spawnProc(cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, stdio: 'pipe', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  p.stdout.on('data', (d) => process.stdout.write(`[${args.join(' ')}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${args.join(' ')}] ${d}`));
  return p;
}

async function main() {
  const cwd = new URL('..', import.meta.url).pathname;
  const procs = [];
  let failed = false;

  try {
    // Start packet server
    const pkt = spawnProc('npm', ['run', 'packet:server'], cwd);
    procs.push(pkt);
    await waitForUrl('http://localhost:8788/health', 30000);
    console.log('✅ Packet server health OK');

    // Start Next dev
    const next = spawnProc('npm', ['run', 'dev'], cwd);
    procs.push(next);
    // Wait for Next API test endpoint to respond
    await waitForUrl('http://localhost:3000/api/test/packet-health', 40000);
    console.log('✅ Next dev API reachable');

    // Probe packet health through Next
    {
      const r = await fetch('http://localhost:3000/api/test/packet-health');
      const j = await r.json();
      if (!j.ok) throw new Error(`Packet health via Next failed: ${JSON.stringify(j)}`);
      console.log('✅ Packet health via Next OK');
    }

    // Probe HF proxy via Next
    {
      const path = 'onnx-community/whisper-base.en/resolve/main/config.json';
      const url = `http://localhost:3000/api/test/hf-proxy?path=${encodeURIComponent(path)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.ok) throw new Error(`HF proxy test failed: ${JSON.stringify(j)}`);
      console.log('✅ HF proxy test OK');
    }

    // Probe weights introspection via Next
    {
      const r = await fetch('http://localhost:3000/api/test/weights');
      const j = await r.json();
      if (!j.ok) throw new Error(`Weights inspect via Next failed: ${JSON.stringify(j)}`);
      console.log('✅ Weights inspect via Next OK');
    }

    console.log('\nAll smoke tests passed.');
  } catch (e) {
    failed = true;
    console.error('\n❌ Smoke tests failed:', e && e.message || e);
  } finally {
    for (const p of procs) {
      try { p.kill('SIGINT'); } catch {}
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
