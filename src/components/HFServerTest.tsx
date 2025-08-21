import React, { useState } from 'react';

const HFServerTest: React.FC = () => {
  const [log, setLog] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const append = (msg: string) => setLog((l) => l + (l ? '\n' : '') + msg);

  const callHealth = async () => {
    setBusy(true);
    try {
      const res = await fetch('/health');
      const json = await res.json();
      append('health: ' + JSON.stringify(json));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      append('health error: ' + msg);
    } finally {
      setBusy(false);
    }
  };

  const callEmbeddings = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: ['hello world', 'how are you?'] }),
      });
      const json = await res.json();
      append('embeddings dims: ' + (json.embeddings?.[0]?.length ?? 'n/a'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      append('embeddings error: ' + msg);
    } finally {
      setBusy(false);
    }
  };

  const callGenerate = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Give me a 1-sentence greeting.' },
          ],
          max_new_tokens: 64,
        }),
      });
      const json = await res.json();
      append('generate: ' + (json.text || ''));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      append('generate error: ' + msg);
    } finally {
      setBusy(false);
    }
  };

  const callASR = async () => {
    setBusy(true);
    try {
      const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav';
      const res = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      append('asr: ' + (json.text || ''));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      append('asr error: ' + msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex gap-3 flex-wrap">
        <button onClick={callHealth} disabled={busy} className="px-3 py-2 bg-slate-700 text-white rounded disabled:opacity-50">Health</button>
        <button onClick={callEmbeddings} disabled={busy} className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">Embeddings</button>
        <button onClick={callGenerate} disabled={busy} className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50">Generate</button>
        <button onClick={callASR} disabled={busy} className="px-3 py-2 bg-rose-600 text-white rounded disabled:opacity-50">ASR</button>
      </div>
      <pre className="bg-gray-100 rounded p-3 whitespace-pre-wrap text-sm min-h-[8rem]">{log || 'No output yet'}</pre>
    </div>
  );
};

export default HFServerTest;
