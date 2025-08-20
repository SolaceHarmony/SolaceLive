import React, { useState } from 'react';
import WhisperXDemoWithProvider from './components/WhisperXDemo';
import TransformersTest from './components/TransformersTest';
import HFServerTest from './components/HFServerTest';
import './App.css';

function App() {
  const [tab, setTab] = useState<'whisperx' | 'browser' | 'server'>('whisperx');

  return (
    <div className="App min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">SolaceLive</h1>
            <div className="flex gap-2">
              <button onClick={() => setTab('whisperx')} className={`px-3 py-1 rounded ${tab==='whisperx' ? 'bg-blue-600 text-white' : 'border text-gray-700'}`}>WhisperX</button>
              <button onClick={() => setTab('browser')} className={`px-3 py-1 rounded ${tab==='browser' ? 'bg-blue-600 text-white' : 'border text-gray-700'}`}>Browser (WebGPU)</button>
              <button onClick={() => setTab('server')} className={`px-3 py-1 rounded ${tab==='server' ? 'bg-blue-600 text-white' : 'border text-gray-700'}`}>Server (HF)</button>
            </div>
          </div>
        </div>
      </nav>
      <main>
        {tab === 'whisperx' && <WhisperXDemoWithProvider />}
        {tab === 'browser' && <TransformersTest />}
        {tab === 'server' && <HFServerTest />}
      </main>
    </div>
  );
}

export default App;
