import { useEffect, useState } from 'react';

export default function FrontendStagingHome() {
  const [packetHealth, setPacketHealth] = useState(null);
  const [weights, setWeights] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [healthRes, weightsRes] = await Promise.all([
          fetch('/api/test/packet-health'),
          fetch('/api/test/weights'),
        ]);

        if (!cancelled) {
          setPacketHealth(await safeJson(healthRes));
          setWeights(await safeJson(weightsRes));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        padding: 24,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
        maxWidth: 960,
        margin: '48px auto',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>SolaceLive Frontend Staging</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        These pages are staged outside the production build while the backend packet/Moshi work completes. When you
        copy them back into <code>next-server/pages/</code>, ensure the checks below pass.
      </p>

      <section style={{ marginTop: 24, border: '1px solid #e0e0e0', borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Backend Status</h2>
        {error && <p style={{ color: '#c62828' }}>Error loading status: {error}</p>}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          <StatusCard title="/api/test/packet-health" payload={packetHealth} />
          <StatusCard title="/api/test/weights" payload={weights} />
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Staged Pages</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <code>packet-voice.tsx</code> — rebuild UI around <code>packetStreamingService</code>, Mimi playback, and
            metrics dashboard.
          </li>
          <li>
            <code>whisperx.tsx</code> — enable after running the WhisperX regression checklist (WebGPU + WASM).
          </li>
          <li>
            <code>moshi.tsx</code> / <code>moshi-mlx.jsx</code> — point to the latest packet/Moshi endpoints.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Next Steps</h2>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Move the page from <code>frontend/pages/pages/</code> into <code>next-server/pages/</code>.</li>
          <li>Run <code>npm run lint</code> and <code>npm run build</code>.</li>
          <li>Execute the manual checklist for that page before committing.</li>
        </ol>
      </section>
    </main>
  );
}

function StatusCard({ title, payload }) {
  return (
    <div
      style={{
        flex: '1 1 280px',
        border: '1px solid #e0e0e0',
        borderRadius: 12,
        padding: 16,
        background: '#fafafa',
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontSize: 12 }}>
        {payload ? JSON.stringify(payload, null, 2) : 'Loading…'}
      </pre>
    </div>
  );
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
