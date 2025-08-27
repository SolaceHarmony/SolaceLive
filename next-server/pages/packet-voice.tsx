"use client";
import React from 'react';

// Use the unified Packet voice interface directly from the library
import { PacketStreamingVoiceInterface } from "../lib/unified/components/PacketStreamingVoiceInterface";

export default function PacketVoicePage() {
  const [packetHealth, setPacketHealth] = React.useState<string>('');
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif' }}>
      <h1>Packet Streaming Voice (Next.js + WebSocket)</h1>
      <p style={{ color: '#666' }}>
        Starts a microphone capture loop and streams 80ms Float32 frames (24kHz) to the packet server.
        Receives streaming text and audio chunks in response.
      </p>
      <div style={{ marginTop: 16 }}>
        <PacketStreamingVoiceInterface />
      </div>
      <div style={{ marginTop: 16, color: '#666' }}>
        <div>Configure server URL: <code>NEXT_PUBLIC_PACKET_WS</code> (defaults to ws://&lt;host&gt;:8788)</div>
        <div>LM Studio base: <code>NEXT_PUBLIC_LM_STUDIO_URL</code> (defaults to http://localhost:1234/v1)</div>
        <div style={{ marginTop: 8, padding: 12, border: '1px solid #ddd', borderRadius: 6, background: '#fafafa' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Browser WhisperX model prefetch</div>
          <div>
            To route Hugging Face model downloads through this server (and use server-side <code>HF_TOKEN</code>), set
            <code> NEXT_PUBLIC_HF_MIRROR=/api/hf</code> in your client env. See
            <code> next-server/lib/unified/docs/hf-proxy-mirror.md</code> for details.
          </div>
        </div>
        <div style={{ marginTop: 8, padding: 12, border: '1px solid #ddd', borderRadius: 6, background: '#fafafa' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Packet server health</div>
          <button
            onClick={async () => {
              setPacketHealth('Checking...');
              try {
                const r = await fetch('/api/test/packet-health');
                const j = await r.json();
                setPacketHealth(j.ok ? `OK (${j.status}) clients=${j.data?.clients ?? 'n/a'}` : `Failed (${j.status || 'n/a'})`);
              } catch (e) {
                setPacketHealth(`Error: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
          >Check Packet Server</button>
          {packetHealth && <div style={{ marginTop: 6, color: '#444' }}>{packetHealth}</div>}
        </div>
      </div>
    </main>
  );
}
