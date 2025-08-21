import { useState, useEffect, useCallback, useRef } from 'react';
import { WhisperXEngine } from '../core/WhisperXEngine';
import type {
  UseWhisperXOptions,
  UseWhisperXReturn,
  WhisperXConfig,
  WhisperXState,
  TranscriptionResult,
  AudioChunk,
  WhisperXCallbacks,
  PerformanceMetrics
} from '../../../types/whisperx';

export const useWhisperX = (options: UseWhisperXOptions = {}): UseWhisperXReturn => {
  const engineRef = useRef<WhisperXEngine | null>(null);
  const callbacksRef = useRef<WhisperXCallbacks>({});
  
  // State management
  const [state, setState] = useState<WhisperXState>({
    isInitialized: false,
    isProcessing: false,
    isListening: false,
    currentSpeaker: null,
    audioLevel: 0,
    performance: {
      processingTime: 0,
      realTimeFactor: 0,
      memoryUsage: 0
    }
  });
  
  const [config, setConfig] = useState<WhisperXConfig>(() => ({
    // Model defaults
    whisperModel: 'base.en',
    alignmentModel: 'wav2vec2-base',
    diarizationModel: 'pyannote/speaker-diarization',
    
    // Performance defaults
    batchSize: 16,
    chunkLength: 5,
    vadThreshold: 0.5,
    alignmentThreshold: 0.7,
    
    // Feature defaults
    enableVAD: true,
    enableAlignment: true,
    enableDiarization: true,
    enableRealtime: true,
    
    // Audio defaults
    sampleRate: 16000,
    channels: 1,
    
    ...options
  }));
  
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [lastAudioChunk, setLastAudioChunk] = useState<AudioChunk | null>(null);

  // Initialize engine
  const initializeEngine = useCallback(async () => {
    try {
      if (engineRef.current) {
        engineRef.current.dispose();
      }

      const engine = new WhisperXEngine(config);
      engineRef.current = engine;

      // Set up event listeners
      engine.on('initialized', () => {
        setState(prev => ({ ...prev, isInitialized: true }));
      });

      engine.on('processingStart', () => {
        setState(prev => ({ ...prev, isProcessing: true }));
      });

      engine.on('processingComplete', (result: TranscriptionResult, metrics: PerformanceMetrics) => {
        setResult(result);
        setState(prev => ({
          ...prev,
          isProcessing: false,
          performance: {
            processingTime: metrics.totalTime,
            realTimeFactor: metrics.realTimeFactor,
            memoryUsage: metrics.memoryUsage
          }
        }));
        
        callbacksRef.current.onTranscriptionUpdate?.(result);
        callbacksRef.current.onPerformanceUpdate?.({
          processingTime: metrics.totalTime,
          realTimeFactor: metrics.realTimeFactor,
          memoryUsage: metrics.memoryUsage
        });
      });

      engine.on('realtimeStart', () => {
        setState(prev => ({ ...prev, isListening: true }));
      });

      engine.on('realtimeStop', () => {
        setState(prev => ({ ...prev, isListening: false, audioLevel: 0 }));
      });

      engine.on('audioLevel', (level: number) => {
        setState(prev => ({ ...prev, audioLevel: level }));
      });

      engine.on('audioChunk', (chunk: AudioChunk) => {
        setLastAudioChunk(chunk);
        setWaveform(chunk.data);
      });

      engine.on('vadComplete', (segments) => {
        callbacksRef.current.onVADUpdate?.(segments);
      });

      engine.on('alignmentComplete', (alignment) => {
        if (alignment?.words) {
          alignment.words.forEach(word => {
            callbacksRef.current.onWordDetected?.(word);
          });
        }
      });

      engine.on('diarizationComplete', (diarization) => {
        if (diarization?.speakers.length > 0) {
          const currentSpeaker = diarization.speakers[diarization.speakers.length - 1]?.speaker;
          setState(prev => {
            if (currentSpeaker !== prev.currentSpeaker) {
              callbacksRef.current.onSpeakerChange?.(currentSpeaker);
              return { ...prev, currentSpeaker };
            }
            return prev;
          });
        }
      });

      engine.on('error', (error: Error) => {
        setError(error);
        callbacksRef.current.onError?.(error);
      });

      await engine.initialize();
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize WhisperX');
      setError(error);
      callbacksRef.current.onError?.(error);
    }
  }, [config]);

  // Initialize on mount and config changes
  useEffect(() => {
    initializeEngine();
    
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [initializeEngine]);

  // Control functions
  const start = useCallback(async () => {
    if (!engineRef.current || !state.isInitialized) {
      throw new Error('WhisperX not initialized');
    }
    await engineRef.current.startRealtime();
  }, [state.isInitialized]);

  const stop = useCallback(() => {
    engineRef.current?.stopRealtime();
  }, []);

  const pause = useCallback(() => {
    stop();
  }, [stop]);

  const resume = useCallback(async () => {
    await start();
  }, [start]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setState(prev => ({
      ...prev,
      currentSpeaker: null,
      audioLevel: 0,
      performance: {
        processingTime: 0,
        realTimeFactor: 0,
        memoryUsage: 0
      }
    }));
  }, []);

  const updateConfig = useCallback((newConfig: Partial<WhisperXConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const processAudio = useCallback(async (audio: AudioChunk): Promise<TranscriptionResult> => {
    if (!engineRef.current || !state.isInitialized) {
      throw new Error('WhisperX not initialized');
    }
    return await engineRef.current.processAudio(audio);
  }, [state.isInitialized]);

  const processFile = useCallback(async (file: File): Promise<TranscriptionResult> => {
    if (!engineRef.current || !state.isInitialized) {
      throw new Error('WhisperX not initialized');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          const audioData = audioBuffer.getChannelData(0);
          const audioChunk: AudioChunk = {
            data: audioData,
            timestamp: Date.now(),
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels
          };
          
          const result = await processAudio(audioChunk);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, [processAudio, state.isInitialized]);

  const startRealtime = useCallback(async (callbacks?: WhisperXCallbacks) => {
    if (callbacks) {
      callbacksRef.current = { ...callbacksRef.current, ...callbacks };
    }
    await start();
  }, [start]);

  const stopRealtime = useCallback(() => {
    stop();
    callbacksRef.current = {};
  }, [stop]);

  // Auto-start if enabled (placed after startRealtime is defined)
  useEffect(() => {
    if (options.autoStart && state.isInitialized && !state.isListening) {
      startRealtime();
    }
  }, [options.autoStart, state.isInitialized, state.isListening, startRealtime]);

   return {
     // State
     state,
     config,
     result,
     error,
     waveform,
     lastAudioChunk,

     // Controls
     start,
     stop,
     pause,
     resume,
     reset,

     // Configuration
     updateConfig,

     // Audio processing
     processAudio,
     processFile,

     // Real-time
     startRealtime,
     stopRealtime
   };
 };

// Hook for multiple instances
export const useWhisperXInstances = () => {
  const instancesRef = useRef<Map<string, UseWhisperXReturn>>(new Map());
  const [instances, setInstances] = useState<Map<string, UseWhisperXReturn>>(new Map());

  const createInstance = useCallback((id: string, options?: UseWhisperXOptions): UseWhisperXReturn => {
    if (instancesRef.current.has(id)) {
      return instancesRef.current.get(id)!;
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const instance = useWhisperX(options);
    instancesRef.current.set(id, instance);
    setInstances(new Map(instancesRef.current));
    
    return instance;
  }, []);

  const removeInstance = useCallback((id: string) => {
    const instance = instancesRef.current.get(id);
    if (instance) {
      instance.stop();
      instancesRef.current.delete(id);
      setInstances(new Map(instancesRef.current));
    }
  }, []);

  const getGlobalPerformance = useCallback(() => {
    const allInstances = Array.from(instancesRef.current.values());
    
    const totalProcessingTime = allInstances.reduce(
      (sum, instance) => sum + instance.state.performance.processingTime, 0
    );
    
    const averageRTF = allInstances.length > 0 
      ? allInstances.reduce((sum, instance) => sum + instance.state.performance.realTimeFactor, 0) / allInstances.length
      : 0;
    
    const peakMemoryUsage = Math.max(
      ...allInstances.map(instance => instance.state.performance.memoryUsage)
    );

    return {
      totalProcessingTime,
      averageRTF,
      peakMemoryUsage
    };
  }, []);

  return {
    instances,
    createInstance,
    removeInstance,
    globalPerformance: getGlobalPerformance()
  };
};

// Performance monitoring hook
export const useWhisperXPerformance = (whisperX: UseWhisperXReturn) => {
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);
  const [averageMetrics, setAverageMetrics] = useState({
    avgRTF: 0,
    avgProcessingTime: 0,
    avgMemoryUsage: 0
  });

  useEffect(() => {
    const updateHistory = () => {
      const newMetric: PerformanceMetrics = {
        vadTime: 0,
        transcriptionTime: 0,
        alignmentTime: 0,
        diarizationTime: 0,
        totalTime: whisperX.state.performance.processingTime,
        realTimeFactor: whisperX.state.performance.realTimeFactor,
        memoryUsage: whisperX.state.performance.memoryUsage,
        audioLength: 0
      };

      setPerformanceHistory(prev => {
        const updated = [...prev.slice(-99), newMetric]; // Keep last 100 entries
        
        // Calculate averages
        const avgRTF = updated.reduce((sum, m) => sum + m.realTimeFactor, 0) / updated.length;
        const avgProcessingTime = updated.reduce((sum, m) => sum + m.totalTime, 0) / updated.length;
        const avgMemoryUsage = updated.reduce((sum, m) => sum + m.memoryUsage, 0) / updated.length;
        
        setAverageMetrics({ avgRTF, avgProcessingTime, avgMemoryUsage });
        
        return updated;
      });
    };

    updateHistory();
  }, [whisperX.state.performance]);

  return {
    performanceHistory,
    averageMetrics,
    clearHistory: () => setPerformanceHistory([])
  };
};