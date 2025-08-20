import React, { useState } from 'react';
import { WhisperXEngine } from '../lib/whisperx/core/WhisperXEngine';
import type { AudioChunk } from '../types/whisperx';

const TransformersTest: React.FC = () => {
  const [engine, setEngine] = useState<WhisperXEngine | null>(null);
  const [status, setStatus] = useState<string>('Ready');
  const [result, setResult] = useState<string>('');

  const initializeEngine = async () => {
    try {
      setStatus('Initializing WhisperX with Transformers.js...');
      
      const whisperX = new WhisperXEngine({
        whisperModel: 'base.en',
        alignmentModel: 'wav2vec2-base',
        enableVAD: true,
        enableAlignment: true,
        enableDiarization: false,
        sampleRate: 16000
      });

      // Listen for events
      whisperX.on('modelLoaded', (model) => {
        setStatus(`Model loaded: ${model}`);
      });

      whisperX.on('error', (error) => {
        setStatus(`Error: ${error.message}`);
      });

      whisperX.on('processingComplete', (result) => {
        setResult(`Transcription: "${result.text}"`);
        setStatus('Processing complete');
      });

      await whisperX.initialize();
      setEngine(whisperX);
      setStatus('WhisperX initialized successfully!');

    } catch (error) {
      setStatus(`Initialization failed: ${error}`);
    }
  };

  const testWithMockAudio = async () => {
    if (!engine) {
      setStatus('Please initialize engine first');
      return;
    }

    try {
      setStatus('Processing mock audio...');

      // Create mock audio chunk (1 second of sine wave)
      const sampleRate = 16000;
      const duration = 1; // 1 second
      const audioData = new Float32Array(sampleRate * duration);
      
      // Generate a simple sine wave (440 Hz - A note)
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
      }

      const audioChunk: AudioChunk = {
        data: audioData,
        timestamp: Date.now(),
        sampleRate: sampleRate,
        channels: 1,
        duration: duration
      };

      const transcriptionResult = await engine.processAudio(audioChunk);
      setResult(`Result: "${transcriptionResult.text}" (${transcriptionResult.words.length} words)`);

    } catch (error) {
      setStatus(`Processing failed: ${error}`);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Transformers.js WhisperX Test</h2>
      
      <div className="space-y-4">
        <div>
          <button
            onClick={initializeEngine}
            disabled={!!engine}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Initialize WhisperX Engine
          </button>
        </div>

        <div>
          <button
            onClick={testWithMockAudio}
            disabled={!engine}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Test with Mock Audio
          </button>
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">Status:</h3>
          <p className="text-sm">{status}</p>
        </div>

        {result && (
          <div className="p-4 bg-blue-50 rounded">
            <h3 className="font-semibold mb-2">Result:</h3>
            <p className="text-sm">{result}</p>
          </div>
        )}

        <div className="p-4 bg-yellow-50 rounded">
          <h3 className="font-semibold mb-2">Hardware Acceleration:</h3>
          <p className="text-sm">
            Transformers.js will automatically use:
            <br />• WebGPU (includes Metal on macOS/Safari)
            <br />• WebGL fallback
            <br />• WASM fallback
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransformersTest;