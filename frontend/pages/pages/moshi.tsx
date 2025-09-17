export default function MoshiPage() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
        maxWidth: 820,
        margin: '48px auto',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Moshi Packet Backend (Staging)</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        The previous WebSocket demo talked directly to a Python MLX worker. Moshi now lives behind the packetised
        WebSocket server (<code>npm run packet:server</code>). Use this checklist when rebuilding the page so it targets the
        current backend contract.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Reintegration Checklist</h2>
        <ol style={{ lineHeight: 1.8 }}>
          <li>
            Connect to <code>NEXT_PUBLIC_PACKET_WS</code> (defaults to <code>ws://localhost:8788</code>) using the
            `PacketWebSocket` client, not the old Python worker.
          </li>
          <li>
            Use `packetStreamingService` to request Moshi steps; route partials via `TEXT_PARTIAL` packets.
          </li>
          <li>
            Display downstream audio/text using the same playback helpers as the packet voice UI.
          </li>
          <li>
            Surface `/api/test/moshi` (TBD) or other diagnostics so developers can validate backend readiness.
          </li>
        </ol>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Backend Notes</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            Packet headers are defined in <code>lib/unified/core/packets.ts</code>; Moshi responses come back as Mimi codebooks +
            text ids.
          </li>
          <li>
            Run the local packet server with <code>npm run packet:server</code> and watch <code>/health</code> for metrics.
          </li>
          <li>
            The classic Python `moshi_mlx.local_web` script is still useful for regression but no longer the production target.
          </li>
        </ul>
      </section>
    </main>
  );
}
