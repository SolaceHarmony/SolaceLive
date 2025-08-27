"use client";
import { useEffect, useRef, useState } from "react";

export default function MoshiPage() {
  const [status, setStatus] = useState<string>("disconnected");
  const [messages, setMessages] = useState([] as string[]);
  const wsRef = useRef<WebSocket | null>(null);
  const workerAddr = process.env.NEXT_PUBLIC_MOSHI_ADDR || "localhost:8998";
  const wsUrl = `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'}://${workerAddr}/api/chat`;

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const connect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = (e) => setStatus(`error`);
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        // server only sends binary; log just in case
        setMessages((m) => ["text:" + ev.data, ...m].slice(0, 200));
        return;
      }
      const buf = new Uint8Array(ev.data as ArrayBuffer);
      const kind = buf[0];
      if (kind === 0x00) {
        setMessages((m) => ["handshake", ...m].slice(0, 200));
      } else if (kind === 0x02) {
        const txt = new TextDecoder().decode(buf.slice(1));
        setMessages((m) => [txt, ...m].slice(0, 200));
      } else if (kind === 0x01) {
        // opus audio; ignore for now
      } else {
        setMessages((m) => ["unknown kind " + kind, ...m].slice(0, 200));
      }
    };
    wsRef.current = ws;
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif' }}>
      <h1>Moshi (MLX) – Next.js client</h1>
      <p>Server: {wsUrl}</p>
      <button onClick={connect} disabled={status === 'connected'}>Connect</button>
      <span style={{ marginLeft: 12 }}>Status: {status}</span>
      <div style={{ marginTop: 16 }}>
        <h3>Text stream</h3>
        <div style={{ border: '1px solid #ccc', padding: 12, height: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {messages.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
      </div>
      <p style={{ marginTop: 16, color: '#666' }}>
        Tip: Start the Python MLX server locally: <code>python -m moshi_mlx.local_web --quantized 8</code> and speak once connected.
      </p>
    </div>
  );
}
