import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('Hello world');
  const [resp, setResp] = useState(null);

  async function call() {
    const r = await fetch('/api/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const j = await r.json();
    setResp(j);
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>Next Server Transformer Test</h1>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} cols={60} />
      <br />
      <button onClick={call}>Send</button>
      <pre>{JSON.stringify(resp, null, 2)}</pre>
    </main>
  );
}
