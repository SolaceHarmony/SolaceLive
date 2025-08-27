"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { applyHFTokenFromStorage, setHFToken } from '../lib/unified/audio/whisperx/utils/hfAuth';

// Lazy-load the demo to keep initial bundle smaller
const WhisperXDemoWithProvider = dynamic(() => import('../lib/unified/components/WhisperXDemo'), { ssr: false });

function registerCOIServiceWorker() {
  try {
    if (typeof window === 'undefined') return;
    const w = window as any;
    const needsCOI = !('crossOriginIsolated' in w) || !w.crossOriginIsolated;
    if ('serviceWorker' in navigator && needsCOI) {
      navigator.serviceWorker.register('/coi-serviceworker.js').catch(() => {});
    }
  } catch {
    // Ignore SW registration errors
  }
}

export default function WhisperXPage() {
  const [mirrorPath, setMirrorPath] = useState('onnx-community/whisper-base.en/resolve/main/config.json');
  const [mirrorStatus, setMirrorStatus] = useState<string>('');
  useEffect(() => {
    registerCOIServiceWorker();
    try {
      // Apply token from storage/window/env
      applyHFTokenFromStorage();
      // If explicitly provided via env, persist it for convenience
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const envToken = (typeof process !== 'undefined' ? (process as any).env?.NEXT_PUBLIC_HF_TOKEN : undefined) as string | undefined;
      if (envToken) setHFToken(envToken);
    } catch {}
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif' }}>
      <h1>WhisperX (Browser) – Real‑time</h1>
      <p style={{ color: '#666' }}>
        Runs WhisperX pipeline in the browser. Requires cross‑origin isolation for SharedArrayBuffer.
      </p>
      <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 6 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Mirror/Proxy Test</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
            value={mirrorPath}
            onChange={(e) => setMirrorPath(e.target.value)}
            placeholder="org/repo/resolve/main/file"
          />
          <button
            onClick={async () => {
              setMirrorStatus('Testing...');
              try {
                const r = await fetch(`/api/test/hf-proxy?path=${encodeURIComponent(mirrorPath)}`);
                const j = await r.json();
                setMirrorStatus(j.ok ? `OK (${j.status})` : `Failed (${j.status || 'n/a'})`);
              } catch (e) {
                setMirrorStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
          >Test Mirror</button>
        </div>
        {mirrorStatus && <div style={{ marginTop: 6, color: '#444' }}>{mirrorStatus}</div>}
      </div>
      <div style={{ marginTop: 16 }}>
        <WhisperXDemoWithProvider />
      </div>
      <div style={{ marginTop: 16, color: '#666' }}>
        <div>Tip: Set an HF token in localStorage as <code>hf_token</code> if models require authentication.</div>
      </div>
    </main>
  );
}
