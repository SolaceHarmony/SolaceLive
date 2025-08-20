import React from 'react';
import { 
  WhisperXProvider, 
  useWhisperX, 
  TranscriptionDisplay, 
  SpeakerVisualizer,
  AudioWaveform,
  RealtimeControls,
  DEFAULT_WHISPERX_CONFIG 
} from '../lib/whisperx';

const WhisperXDemo: React.FC = () => {
  const whisperX = useWhisperX({
    ...DEFAULT_WHISPERX_CONFIG,
    enableRealtime: true,
    autoStart: false
  });


  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">WhisperX Demo</h1>
        <p className="text-gray-600">Real-time speech-to-speech with forced alignment and speaker diarization</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          {/* Controls */}
          <RealtimeControls whisperX={whisperX} showAdvanced={true} />
        </div>
        <div className="lg:col-span-8 space-y-6">
          {/* Transcription Display */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">Live Transcription</h2>
            </div>
            <div className="p-4">
              <TranscriptionDisplay
                result={whisperX.result}
                showSpeakers={true}
                showTimestamps={true}
                showConfidence={true}
                highlightCurrentWord={true}
              />
            </div>
          </div>

          {/* Speaker Visualization */}
          {whisperX.result?.speakers && whisperX.result.speakers.length > 0 && (
            <div className="bg-white border rounded-lg">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">Speaker Timeline</h2>
              </div>
              <div className="p-4">
                <SpeakerVisualizer
                  speakers={whisperX.result.speakers}
                  currentTime={0}
                  height={120}
                />
              </div>
            </div>
          )}

          {/* Audio Waveform */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">Audio Waveform</h2>
            </div>
            <div className="p-4">
              <AudioWaveform
                audioData={new Float32Array(16000)} // Mock audio data
                vadSegments={[]}
                speakerSegments={whisperX.result?.speakers || []}
                currentTime={0}
                height={100}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapped demo component with provider
const WhisperXDemoWithProvider: React.FC = () => {
  return (
    <WhisperXProvider 
      defaultConfig={DEFAULT_WHISPERX_CONFIG}
      enableGlobalPerformanceMonitoring={true}
    >
      <WhisperXDemo />
    </WhisperXProvider>
  );
};

export default WhisperXDemoWithProvider;