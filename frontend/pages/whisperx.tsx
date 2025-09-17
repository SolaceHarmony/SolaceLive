export default function WhisperXPage() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
        maxWidth: 720,
        margin: '48px auto',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>WhisperX (Browser)</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        The in-browser WhisperX demo is temporarily unavailable while we reassess the WebGPU/WebAssembly stack and
        remove unused dependencies. This route now serves as a placeholder so documentation links stay valid and the
        Next.js build remains clean.
      </p>
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Bring-Back Checklist</h2>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Run the regression steps in <code>frontend/whisperx/README.md</code> (WebGPU on/off, WASM fallback).</li>
          <li>Ensure <code>public/coi-serviceworker.js</code> registers and <code>HF_TOKEN</code> proxying works.</li>
          <li>Prefetch models via <code>prefetchWhisper</code> / <code>prefetchAlignment</code>; record timings.</li>
          <li>Only then copy this page into <code>next-server/pages/whisperx.tsx</code>.</li>
        </ol>
      </section>
      <section style={{ marginTop: 24, color: '#666', lineHeight: 1.8 }}>
        <p>
          While the browser demo is paused you can still exercise transcription using the backend packet server or run
          the CLI tooling documented in <code>docs/PLAN.md</code>.
        </p>
      </section>
    </main>
  );
}
