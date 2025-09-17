export default function MoshiMLXPage() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
        maxWidth: 820,
        margin: '48px auto',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Moshi MLX API (Staging)</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        The legacy <code>/api/moshi/step</code> endpoint is being replaced by the packetised Moshi backend. Use this page to
        track the TODOs required before reinstating an interactive MLX demo.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Action Items</h2>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Expose a backend route that wraps the Moshi MLX step function (or proxy to the packet server) for testing.</li>
          <li>
            Replace direct <code>fetch('/api/moshi/step')</code> calls with the new endpoint once defined, including
            payload validation and error handling.
          </li>
          <li>
            Display both text logits and Mimi codebook responses so developers can sanity-check output without running the
            full voice UI.
          </li>
          <li>
            Gate the UI behind readiness checks (`/api/test/weights`, `/api/test/packet-health`).
          </li>
        </ol>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>References</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li><code>backend/models/moshi-mlx/lm.ts</code> — MLX LM step implementation.</li>
          <li><code>backend/server/server.ts</code> — packet server endpoints for integration testing.</li>
          <li><code>docs/PLAN.md</code> — milestones for Moshi/Mimi loader and delay alignment.</li>
        </ul>
      </section>
    </main>
  );
}
