"use client";
import React, { useEffect } from 'react';

interface PacketStreamingVoiceInterfaceProps {
  onTranscription?: (message: { text: string }) => void;
}

/**
 * Minimal placeholder UI while the full packet streaming interface is rebuilt.
 * Keeps the /packet-voice route functional without pulling in unfinished services.
 */
export const PacketStreamingVoiceInterface: React.FC<PacketStreamingVoiceInterfaceProps> = ({
  onTranscription,
}) => {
  useEffect(() => {
    if (onTranscription) {
      console.warn(
        '[PacketStreamingVoiceInterface] onTranscription callback will not fire in placeholder mode.'
      );
    }
  }, [onTranscription]);

  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: 12,
        padding: 24,
        background: '#fafafa',
        maxWidth: 640,
        margin: '48px auto',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <h2 style={{ marginBottom: 12 }}>Packet Voice Interface</h2>
      <p style={{ color: '#555', lineHeight: 1.5 }}>
        The real-time packet streaming UI is currently under reconstruction while the Moshi/CSM
        pipeline is ported to the new MLX stack. This placeholder keeps the route available and ensures the
        Next.js build succeeds while backend work continues.
      </p>
      <p style={{ marginTop: 16, color: '#777' }}>
        To exercise the packet server today, use the smoke tests or the REST/WebSocket API described in
        <code style={{ marginLeft: 4 }}>docs/ARCHITECTURE.md</code>.
      </p>
    </div>
  );
};

export default PacketStreamingVoiceInterface;
