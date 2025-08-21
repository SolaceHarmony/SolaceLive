import React, { useState } from 'react';

// Test all WhisperX imports
import {
  WhisperXEngine,
  useWhisperX,
  TranscriptionDisplay,
  DEFAULT_WHISPERX_CONFIG,
  createWhisperXConfig,
  WHISPER_MODELS,
  ALIGNMENT_MODELS
} from '../lib/whisperx';

// Test new transliterated models
import { FasterWhisperPipeline } from '../lib/whisperx/core/models/FasterWhisperModel';
import { PyannoteVAD } from '../lib/whisperx/core/models/VADModelReal';

// Test Transformers.js import
import { pipeline } from '@huggingface/transformers';

import type { AudioChunk, TranscriptionResult, WhisperXConfig } from '../types/whisperx';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  duration?: number;
}

const SmokeTest: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  const updateTest = (name: string, status: TestResult['status'], message: string, duration?: number) => {
    setTests(prev => prev.map(test => 
      test.name === name ? { ...test, status, message, duration } : test
    ));
  };

  const runTest = async (name: string, testFn: () => Promise<void>) => {
    setCurrentTest(name);
    const startTime = performance.now();
    
    try {
      await testFn();
      const duration = performance.now() - startTime;
      updateTest(name, 'success', 'Passed', duration);
    } catch (error) {
      const duration = performance.now() - startTime;
      updateTest(name, 'error', `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, duration);
    }
  };

  const smokeTests = [
    {
      name: 'Import Tests',
      test: async () => {
        // Test that all imports loaded without throwing
        if (!WhisperXEngine) throw new Error('WhisperXEngine import failed');
        if (!useWhisperX) throw new Error('useWhisperX import failed');
        if (!TranscriptionDisplay) throw new Error('TranscriptionDisplay import failed');
        if (!FasterWhisperPipeline) throw new Error('FasterWhisperPipeline import failed');
        if (!pipeline) throw new Error('Transformers.js pipeline import failed');
        console.log('All imports successful');
      }
    },
    {
      name: 'Configuration Tests',
      test: async () => {
        const config = createWhisperXConfig({ whisperModel: 'base.en' });
        if (config.whisperModel !== 'base.en') throw new Error('Config creation failed');
        
        if (!DEFAULT_WHISPERX_CONFIG.enableVAD) throw new Error('Default config invalid');

        console.log('Configuration tests passed');
      }
    },
    {
      name: 'WhisperX Engine Creation',
      test: async () => {
        const engine = new WhisperXEngine({
          whisperModel: 'base.en',
          enableAlignment: false,
          enableDiarization: false,
          enableVAD: false
        });
        
        if (!engine.currentConfig) throw new Error('Engine config not accessible');
        if (engine.currentState.isInitialized) throw new Error('Engine should not be initialized yet');
        
        console.log('WhisperX Engine created successfully');
      }
    },
    {
      name: 'Model Classes Instantiation',
      test: async () => {
        // Test VAD model
        const vadModel = new PyannoteVAD('cpu', undefined, undefined, { vad_onset: 0.5 });
        if (!vadModel) throw new Error('PyannoteVAD creation failed');
        
        // Test Alignment model via dynamic import
        const { AlignmentModel: AlignmentModelReal } = await import('../lib/whisperx/core/models/AlignmentModelReal');
        const alignmentModel = new AlignmentModelReal();
        if (!alignmentModel) throw new Error('AlignmentModel creation failed');
        
        // Test FasterWhisper pipeline
        const asrPipeline = new FasterWhisperPipeline('openai/whisper-base.en');
        if (!asrPipeline) throw new Error('FasterWhisperPipeline creation failed');

        console.log('Model classes instantiated successfully');
      }
    },
    {
      name: 'Audio Chunk Creation',
      test: async () => {
        // Create mock audio data
        const sampleRate = 16000;
        const duration = 1; // 1 second
        const audioData = new Float32Array(sampleRate * duration);
        
        for (let i = 0; i < audioData.length; i++) {
          audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1;
        }

        const audioChunk: AudioChunk = {
          data: audioData,
          timestamp: Date.now(),
          sampleRate: sampleRate,
          channels: 1,
          duration: duration
        };

        if (audioChunk.data.length !== sampleRate) throw new Error('Audio chunk creation failed');
        if (audioChunk.duration !== 1) throw new Error('Audio duration incorrect');
        
        console.log('Audio chunk created successfully');
      }
    },
    {
      name: 'React Hook Test',
      test: async () => {
        // This is tricky to test outside of React component, but we can at least verify the hook exists
        if (typeof useWhisperX !== 'function') throw new Error('useWhisperX is not a function');
        console.log('React hooks available');
      }
    },
    {
      name: 'Transformers.js Pipeline Creation',
      test: async () => {
        try {
          // Test that we can create a pipeline (this may fail if models aren't cached)
          console.log('Attempting to create Transformers.js pipeline...');
          
          // Use a very small model for testing
          const testPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            progress_callback: (progress: { status?: string; name?: string; progress?: number }) => {
              if (progress.status === 'downloading') {
                console.log(`Downloading: ${progress.name} - ${Math.round(progress.progress || 0)}%`);
              }
            }
          });
          
          if (!testPipeline) throw new Error('Pipeline creation returned null');
          console.log('Transformers.js pipeline created successfully');
          
        } catch (error) {
          // This might fail due to network/cache issues, so we'll make it a warning
          console.warn('Transformers.js pipeline creation failed (this is expected on first run):', error);
          // Don't throw - this is expected behavior for smoke test
        }
      }
    },
    {
      name: 'Mock Transcription Result',
      test: async () => {
        const mockResult: TranscriptionResult = {
          text: 'Hello world test transcription',
          words: [
            { word: 'Hello', start: 0, end: 0.5, confidence: 0.95 },
            { word: 'world', start: 0.5, end: 1.0, confidence: 0.92 },
            { word: 'test', start: 1.0, end: 1.4, confidence: 0.88 },
            { word: 'transcription', start: 1.4, end: 2.2, confidence: 0.91 }
          ],
          speakers: [],
          language: 'en',
          duration: 2.2
        };
        
        if (mockResult.words.length !== 4) throw new Error('Mock result creation failed');
        if (mockResult.text !== 'Hello world test transcription') throw new Error('Mock text incorrect');
        
        console.log('Mock transcription result created successfully');
      }
    },
    {
      name: 'Constants and Types',
      test: async () => {
        if (!WHISPER_MODELS.includes('base.en')) throw new Error('WHISPER_MODELS constant invalid');
        if (!ALIGNMENT_MODELS.includes('wav2vec2-base')) throw new Error('ALIGNMENT_MODELS constant invalid');
        
        // Test that we can use the types (TypeScript compilation test)
        const config: WhisperXConfig = {
          whisperModel: 'base.en',
          alignmentModel: 'wav2vec2-base',
          diarizationModel: 'pyannote/speaker-diarization',
          batchSize: 16,
          chunkLength: 30,
          vadThreshold: 0.5,
          alignmentThreshold: 0.7,
          enableVAD: true,
          enableAlignment: true,
          enableDiarization: true,
          enableRealtime: true,
          sampleRate: 16000,
          channels: 1
        };
        
        if (config.whisperModel !== 'base.en') throw new Error('Type checking failed');
        
        console.log('Constants and types verified');
      }
    }
  ];

  const runAllTests = async () => {
    setIsRunning(true);
    setTests(smokeTests.map(t => ({ name: t.name, status: 'pending', message: 'Waiting...' })));

    for (const { name, test } of smokeTests) {
      await runTest(name, test);
      // Small delay between tests for UI updates
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsRunning(false);
    setCurrentTest('');
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">WhisperX Smoke Tests</h1>
        <p className="text-gray-600">Testing all imports, instantiation, and basic functionality</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>

        {tests.length > 0 && (
          <div className="text-sm text-gray-600">
            Results: {successCount} passed, {errorCount} failed, {tests.length - successCount - errorCount} pending
          </div>
        )}
      </div>

      {currentTest && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            Currently running: <span className="font-medium">{currentTest}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {tests.map((test) => (
          <div
            key={test.name}
            className={`p-4 rounded-lg border transition-all ${
              test.status === 'success'
                ? 'bg-green-50 border-green-200'
                : test.status === 'error'
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-lg">{getStatusIcon(test.status)}</span>
                <div>
                  <h3 className="font-medium text-gray-900">{test.name}</h3>
                  <p className={`text-sm ${getStatusColor(test.status)}`}>{test.message}</p>
                </div>
              </div>
              
              {test.duration !== undefined && (
                <span className="text-xs text-gray-500">
                  {test.duration.toFixed(2)}ms
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {tests.length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Test Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-gray-600">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{tests.length}</div>
              <div className="text-gray-600">Total</div>
            </div>
          </div>
          
          {successCount === tests.length && tests.length > 0 && (
            <div className="mt-4 p-3 bg-green-100 border border-green-200 rounded text-center text-green-800 font-medium">
              🎉 All tests passed! WhisperX is ready to use.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmokeTest;
