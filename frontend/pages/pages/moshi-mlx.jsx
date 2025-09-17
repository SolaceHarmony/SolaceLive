"use client";
import React from 'react';
import { useState } from "react";

export default function MoshiMLXPage() {
  const [status, setStatus] = useState('ready');
  const [messages, setMessages] = useState([]);
  const [audioCodes, setAudioCodes] = useState([]);
  const [textTokens, setTextTokens] = useState([]);

  const step = async () => {
    setStatus('stepping...');
    try {
  const res = await globalThis.fetch('/api/moshi/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioCodes, textTokens })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Step failed');
      setTextTokens((t) => [...t, json.nextText]);
      setAudioCodes((a) => [...a, json.nextAudioCode]);
      setMessages((m) => [`nextText=${json.nextText} nextAudioCode=${json.nextAudioCode}`, ...m].slice(0, 200));
      setStatus('ready');
    } catch (e) {
      setMessages((m) => [`error: ${(e && e.message) || String(e)}`, ...m].slice(0, 200));
      setStatus('error');
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif' }}>
      <h1>Moshi (node-MLX) – local Next.js API</h1>
      <p>Endpoint: <code>/api/moshi/step</code></p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={step}>Generate step</button>
        <span>Status: {status}</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <h3>Events</h3>
        <div style={{ border: '1px solid #ccc', padding: 12, height: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {messages.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, color: '#666' }}>
        <div>textTokens: [{textTokens.join(', ')}]</div>
        <div>audioCodes: [{audioCodes.join(', ')}]</div>
      </div>
    </div>
  );
}
