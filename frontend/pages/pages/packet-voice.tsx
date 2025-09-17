export default function PacketVoicePage() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
        maxWidth: 820,
        margin: '48px auto',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Packet Streaming Voice (To Rebuild)</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        The original packet voice page depended on browser services that no longer exist (speechService,
        voiceActivityDetection, whisperWasmService). Re-implement the UI atop the new MLX backend using this checklist.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>UI TODO</h2>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Capture microphone audio at 24 kHz, buffer into 80 ms frames.</li>
          <li>Send frames via <code>packetStreamingService</code> (critical priority) and render downstream PCM with jitter buffering.</li>
          <li>Display partial/final text tokens and expose `/health` metrics in a developer panel.</li>
          <li>Gate WhisperX integration behind readiness checks; link to the fast-whisper regression plan.</li>
        </ol>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Backend Hooks</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li><code>NEXT_PUBLIC_PACKET_WS</code> — default <code>ws://localhost:8788</code>.</li>
          <li><code>/api/test/packet-health</code> — use for live status & metrics.</li>
          <li><code>/api/test/weights</code> — verify LM/Mimi readiness.</li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Reference Implementation Notes</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li><code>lib/unified/services/packetStreamingService.ts</code> — orchestrates WS connection.</li>
          <li><code>lib/unified/utils/audioPlayer.ts</code> — jitter-buffer playback helper.</li>
          <li><code>docs/ARCHITECTURE.md</code> — cadence, packet priority, backpressure policies.</li>
        </ul>
      </section>
    </main>
  );
}
