import React, { useState, useEffect } from 'react';
import WhisperXDemoWithProvider from './components/WhisperXDemo';
import TransformersTest from './components/TransformersTest';
import HFServerTest from './components/HFServerTest';
import { PacketStreamingVoiceInterface } from './components/PacketStreamingVoiceInterface';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logger, logInfo } from './utils/logger';
import './App.css';

function App() {
  const [tab, setTab] = useState<'whisperx' | 'browser' | 'server' | 'packet'>('whisperx');
  
  useEffect(() => {
    logInfo('App', 'Application mounted', { initialTab: tab });
    
    // Log tab changes
    return () => {
      logInfo('App', 'Application unmounting');
    };
  }, []);
  
  const handleTabChange = (newTab: 'whisperx' | 'browser' | 'server' | 'packet') => {
    logInfo('App', 'Tab changed', { from: tab, to: newTab });
    setTab(newTab);
  };

  return (
    <div className="App min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">SolaceLive</h1>
            <div className="flex gap-2">
              <button onClick={() => handleTabChange('whisperx')} className={`px-3 py-1 rounded ${tab==='whisperx' ? 'bg-blue-600 text-white' : 'border text-gray-700'}`}>WhisperX</button>
              <button onClick={() => handleTabChange('browser')} className={`px-3 py-1 rounded ${tab==='browser' ? 'bg-blue-600 text-white' : 'border text-gray-700'}`}>Browser (WebGPU)</button>
              <button onClick={() => handleTabChange('server')} className={`px-3 py-1 rounded ${tab==='server' ? 'bg-blue-600 text-white' : 'border text-gray-700'}`}>Server (HF)</button>
              <button onClick={() => handleTabChange('packet')} className={`px-3 py-1 rounded ${tab==='packet' ? 'bg-orange-600 text-white' : 'border text-gray-700'}`}>Packet Streaming</button>
            </div>
          </div>
        </div>
      </nav>
      <main>
        <ErrorBoundary componentName="WhisperXDemo">
          {tab === 'whisperx' && <WhisperXDemoWithProvider />}
        </ErrorBoundary>
        <ErrorBoundary componentName="TransformersTest">
          {tab === 'browser' && <TransformersTest />}
        </ErrorBoundary>
        <ErrorBoundary componentName="HFServerTest">
          {tab === 'server' && <HFServerTest />}
        </ErrorBoundary>
        <ErrorBoundary componentName="PacketStreamingVoiceInterface">
          {tab === 'packet' && <PacketStreamingVoiceInterface />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
