/**
 * Neuromorphic Voice Interface - Complete integration of Moshi + Consciousness Layer
 * 
 * This component provides the main interface for the neuromorphic voice inference system,
 * combining real-time audio processing with consciousness monitoring.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ConsciousnessMonitor } from './ConsciousnessMonitor';
import { MoshiModelBridge } from '../lib/moshi-neuromorphic/MoshiModelBridge';

interface NeuromorphicVoiceInterfaceProps {
  className?: string;
}

interface AudioStreamState {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  totalProcessed: number;
  error: string | null;
}

export const NeuromorphicVoiceInterface: React.FC<NeuromorphicVoiceInterfaceProps> = ({
  className = ''
}) => {
  const [moshiBridge, setMoshiBridge] = useState<MoshiModelBridge | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [audioState, setAudioState] = useState<AudioStreamState>({
    isRecording: false,
    isProcessing: false,
    audioLevel: 0,
    totalProcessed: 0,
    error: null
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Moshi bridge
  useEffect(() => {
    const initializeBridge = async () => {
      try {
        setAudioState(prev => ({ ...prev, error: null }));
        
        const bridge = new MoshiModelBridge({
          sampleRate: 24000,
          frameSize: 1920, // 80ms at 24kHz
          temperature: 0.8
        });

        await bridge.initialize();
        setMoshiBridge(bridge);
        setIsInitialized(true);
        
        console.log('🎉 Neuromorphic Voice Interface initialized!');
      } catch (error) {
        console.error('❌ Failed to initialize:', error);
        setAudioState(prev => ({ 
          ...prev, 
          error: `Initialization failed: ${error}` 
        }));
      }
    };

    initializeBridge();

    return () => {
      if (moshiBridge) {
        moshiBridge.reset();
      }
    };
  }, []);

  // Start audio recording and processing
  const startRecording = async () => {
    if (!moshiBridge || !isInitialized) {
      setAudioState(prev => ({ 
        ...prev, 
        error: 'System not initialized' 
      }));
      return;
    }

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create processor for real-time analysis
      processorRef.current = audioContextRef.current.createScriptProcessor(1920, 1, 1);
      
      let frameBuffer = new Float32Array(1920);
      let bufferIndex = 0;
      
      processorRef.current.onaudioprocess = async (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate audio level for visualization
        const level = Math.sqrt(
          inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length
        );
        setAudioState(prev => ({ ...prev, audioLevel: level }));

        // Buffer audio frames
        for (let i = 0; i < inputData.length; i++) {
          frameBuffer[bufferIndex++] = inputData[i];
          
          if (bufferIndex >= frameBuffer.length) {
            // Process complete frame
            setAudioState(prev => ({ ...prev, isProcessing: true }));
            
            try {
              await moshiBridge.processRealAudio(frameBuffer.slice());
              setAudioState(prev => ({ 
                ...prev, 
                totalProcessed: prev.totalProcessed + 1,
                isProcessing: false 
              }));
            } catch (error) {
              console.error('Processing error:', error);
              setAudioState(prev => ({ 
                ...prev, 
                isProcessing: false,
                error: `Processing error: ${error}`
              }));
            }
            
            // Reset buffer
            frameBuffer = new Float32Array(1920);
            bufferIndex = 0;
          }
        }
      };

      // Connect audio pipeline
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      mediaStreamRef.current = stream;
      setAudioState(prev => ({ ...prev, isRecording: true, error: null }));

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setAudioState(prev => ({ 
        ...prev, 
        error: `Microphone access failed: ${error}` 
      }));
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioState(prev => ({ 
      ...prev, 
      isRecording: false, 
      isProcessing: false,
      audioLevel: 0 
    }));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const getStatusColor = () => {
    if (audioState.error) return 'bg-red-500';
    if (audioState.isProcessing) return 'bg-yellow-500';
    if (audioState.isRecording) return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    if (audioState.error) return 'Error';
    if (audioState.isProcessing) return 'Processing...';
    if (audioState.isRecording) return 'Recording';
    return isInitialized ? 'Ready' : 'Initializing...';
  };

  return (
    <div className={`min-h-screen bg-gray-100 p-4 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Neuromorphic Voice Interface
              </h1>
              <p className="text-gray-600 mt-2">
                Real-time voice inference with consciousness-inspired processing
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                <span className="font-medium">{getStatusText()}</span>
              </div>
              
              {/* Recording controls */}
              <div className="flex gap-2">
                <button
                  onClick={audioState.isRecording ? stopRecording : startRecording}
                  disabled={!isInitialized || audioState.isProcessing}
                  className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                    audioState.isRecording
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400'
                  }`}
                >
                  {audioState.isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
                
                {moshiBridge && (
                  <button
                    onClick={() => moshiBridge.reset()}
                    className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Audio level visualization */}
          {audioState.isRecording && (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Audio Level:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-100"
                    style={{ width: `${Math.min(audioState.audioLevel * 100 * 10, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono">
                  {(audioState.audioLevel * 100).toFixed(1)}%
                </span>
              </div>
              
              <div className="mt-2 text-sm text-gray-600">
                Frames processed: {audioState.totalProcessed}
              </div>
            </div>
          )}

          {/* Error display */}
          {audioState.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-800 font-medium">Error:</div>
              <div className="text-red-600 text-sm">{audioState.error}</div>
            </div>
          )}
        </div>

        {/* Consciousness Monitor */}
        {moshiBridge && (
          <ConsciousnessMonitor 
            moshiBridge={moshiBridge}
            updateInterval={100}
            className="mb-6"
          />
        )}

        {/* System Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Audio Pipeline</h3>
            <div className="space-y-2 text-sm">
              <div>Sample Rate: 24kHz</div>
              <div>Frame Size: 1920 samples (80ms)</div>
              <div>Channels: Mono</div>
              <div>Processing: Real-time</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Neuromorphic Layer</h3>
            <div className="space-y-2 text-sm">
              <div>Gamma Frequency: 40Hz</div>
              <div>Theta Frequency: 6Hz</div>
              <div>Consciousness Cycle: 100ms</div>
              <div>Working Memory: 7 items</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Model Configuration</h3>
            <div className="space-y-2 text-sm">
              <div>Model: Moshiko (Mock)</div>
              <div>Temperature: 0.8</div>
              <div>Context Length: 2048</div>
              <div>Latency Target: &lt;200ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NeuromorphicVoiceInterface;