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
      <p style={{ marginTop: 16, color: '#666' }}>
        Watch <code>docs/PLAN.md</code> for updates on the revived web demo. In the meantime you can exercise the
        packet server via REST/WebSocket interfaces or run WhisperX locally with the provided CLI tools.
      </p>
    </main>
  );
}
