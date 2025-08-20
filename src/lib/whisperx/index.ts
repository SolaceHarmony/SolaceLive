// Core WhisperX Engine
import type { WhisperXConfig, AudioChunk, TranscriptionResult, WordSegment, SpeakerSegment } from '../../types/whisperx';
export { WhisperXEngine } from './core/WhisperXEngine';

// Models
export { WhisperModel } from './core/models/WhisperModel';
export { AlignmentModel } from './core/models/AlignmentModel';
export { DiarizationModel } from './core/models/DiarizationModel';
export { VADModel } from './core/models/VADModel';

// React Hooks
export { 
  useWhisperX, 
  useWhisperXInstances, 
  useWhisperXPerformance 
} from './hooks/useWhisperX';

// React Context and Providers
export { 
  WhisperXProvider,
  useWhisperXContext,
  useWhisperXInstance,
  useTemporaryWhisperX,
  useWhisperXGlobalConfig,
  useWhisperXGlobalPerformance,
  useWhisperXHealthCheck
} from './context/WhisperXProvider';

// UI Components
export { 
  TranscriptionDisplay,
  WordDisplay 
} from './components/TranscriptionDisplay';

export { 
  SpeakerVisualizer,
  CompactSpeakerVisualizer 
} from './components/SpeakerVisualizer';

export { 
  AudioWaveform,
  MiniWaveform 
} from './components/AudioWaveform';

export { 
  RealtimeControls,
  CompactRealtimeControls 
} from './components/RealtimeControls';

// Types (re-exported from types file)
export type {
  // Core types
  WordSegment,
  SpeakerSegment,
  VADSegment,
  TranscriptionResult,
  AlignmentResult,
  DiarizationResult,
  WhisperXConfig,
  WhisperXState,
  WhisperXCallbacks,
  AudioChunk,
  ProcessingPipeline,
  PerformanceMetrics,
  ModelLoadingState,
  WhisperXError,
  WhisperXEvent,
  WhisperXEventHandlers,

  // React-specific types
  UseWhisperXOptions,
  UseWhisperXReturn,
  WhisperXContextValue,
  WhisperXProviderProps,

  // Component Props
  TranscriptionDisplayProps,
  SpeakerVisualizerProps,
  AudioWaveformProps,
  RealtimeControlsProps
} from '../../types/whisperx';

// Utility functions and constants
export const WHISPER_MODELS = [
  'tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 
  'medium', 'medium.en', 'large-v1', 'large-v2', 'large-v3'
] as const;

export const ALIGNMENT_MODELS = [
  'wav2vec2-base', 'wav2vec2-large'
] as const;

export const DIARIZATION_MODELS = [
  'pyannote/speaker-diarization', 'wespeaker/voxceleb_resnet34'
] as const;

// Default configurations
export const DEFAULT_WHISPERX_CONFIG: WhisperXConfig = {
  // Model defaults
  whisperModel: 'large-v3',
  alignmentModel: 'wav2vec2-base',
  diarizationModel: 'pyannote/speaker-diarization',
  
  // Performance defaults
  batchSize: 16,
  chunkLength: 10,
  vadThreshold: 0.5,
  alignmentThreshold: 0.7,
  
  // Feature defaults
  enableVAD: true,
  enableAlignment: true,
  enableDiarization: true,
  enableRealtime: true,
  
  // Audio defaults
  sampleRate: 16000,
  channels: 1
};

// Helper functions
export const createWhisperXConfig = (overrides: Partial<WhisperXConfig> = {}): WhisperXConfig => {
  return { ...DEFAULT_WHISPERX_CONFIG, ...overrides };
};

export const validateAudioChunk = (chunk: AudioChunk): boolean => {
  return (
    chunk.data instanceof Float32Array &&
    chunk.data.length > 0 &&
    chunk.sampleRate > 0 &&
    chunk.channels > 0 &&
    chunk.timestamp > 0
  );
};

export const formatTranscriptionTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

export const calculateRealTimeFactor = (processingTime: number, audioLength: number): number => {
  return audioLength > 0 ? (processingTime / 1000) / audioLength : 0;
};

export const mergeTranscriptionResults = (results: TranscriptionResult[]): TranscriptionResult => {
  if (results.length === 0) {
    return {
      text: '',
      words: [],
      speakers: [],
      language: 'en',
      duration: 0
    };
  }

  if (results.length === 1) {
    return results[0];
  }

  const mergedText = results.map(r => r.text).join(' ');
  const mergedWords: WordSegment[] = [];
  const mergedSpeakers: SpeakerSegment[] = [];
  
  let timeOffset = 0;
  
  for (const result of results) {
    // Adjust word timestamps
    const adjustedWords = result.words.map(word => ({
      ...word,
      start: word.start + timeOffset,
      end: word.end + timeOffset
    }));
    mergedWords.push(...adjustedWords);
    
    // Adjust speaker timestamps
    const adjustedSpeakers = result.speakers.map(speaker => ({
      ...speaker,
      start: speaker.start + timeOffset,
      end: speaker.end + timeOffset
    }));
    mergedSpeakers.push(...adjustedSpeakers);
    
    timeOffset += result.duration;
  }

  return {
    text: mergedText.trim(),
    words: mergedWords,
    speakers: mergedSpeakers,
    language: results[0].language,
    duration: timeOffset
  };
};

// Version information
export const WHISPERX_VERSION = '1.0.0';
export const WHISPERX_BUILD = 'react-native';