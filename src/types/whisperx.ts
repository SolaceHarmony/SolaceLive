// WhisperX Types - React-native implementation
export interface WordSegment {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface SpeakerSegment {
  speaker: string;
  start: number;
  end: number;
  confidence: number;
  color?: string;
}

export interface VADSegment {
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  words: WordSegment[];
  speakers: SpeakerSegment[];
  language: string;
  duration: number;
}

export interface AlignmentResult {
  words: WordSegment[];
  segments: Array<{
    text: string;
    start: number;
    end: number;
    words: WordSegment[];
  }>;
}

export interface DiarizationResult {
  speakers: SpeakerSegment[];
  speakerCount: number;
  speakerEmbeddings: Map<string, Float32Array>;
}

export interface WhisperXConfig {
  // Model settings
  whisperModel: 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en' | 'large-v1' | 'large-v2' | 'large-v3';
  alignmentModel: 'wav2vec2-base' | 'wav2vec2-large';
  diarizationModel: 'pyannote/speaker-diarization' | 'wespeaker/voxceleb_resnet34';
  
  // Performance settings
  batchSize: number;
  chunkLength: number;
  vadThreshold: number;
  alignmentThreshold: number;
  
  // Features
  enableVAD: boolean;
  enableAlignment: boolean;
  enableDiarization: boolean;
  enableRealtime: boolean;
  
  // Audio settings
  sampleRate: number;
  channels: number;
}

export interface WhisperXState {
  isInitialized: boolean;
  isProcessing: boolean;
  isListening: boolean;
  currentSpeaker: string | null;
  audioLevel: number;
  performance: {
    processingTime: number;
    realTimeFactor: number;
    memoryUsage: number;
  };
}

export interface WhisperXCallbacks {
  onTranscriptionUpdate?: (result: Partial<TranscriptionResult>) => void;
  onWordDetected?: (word: WordSegment) => void;
  onSpeakerChange?: (speaker: string) => void;
  onVADUpdate?: (segments: VADSegment[]) => void;
  onError?: (error: Error) => void;
  onPerformanceUpdate?: (metrics: WhisperXState['performance']) => void;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  sampleRate: number;
  channels: number;
  duration?: number;
}

export interface ProcessingPipeline {
  vad: (audio: AudioChunk) => Promise<VADSegment[]>;
  transcribe: (audio: AudioChunk) => Promise<{ text: string; segments: any[] }>;
  align: (transcription: any, audio: AudioChunk) => Promise<AlignmentResult>;
  diarize: (audio: AudioChunk, alignment: AlignmentResult) => Promise<DiarizationResult>;
}

// React-specific types
export interface UseWhisperXOptions extends Partial<WhisperXConfig> {
  autoStart?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export interface UseWhisperXReturn {
  // State
  state: WhisperXState;
  config: WhisperXConfig;
  result: TranscriptionResult | null;
  error?: Error | null;
  
  // Controls
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  
  // Configuration
  updateConfig: (newConfig: Partial<WhisperXConfig>) => void;
  
  // Audio processing
  processAudio: (audio: AudioChunk) => Promise<TranscriptionResult>;
  processFile: (file: File) => Promise<TranscriptionResult>;
  
  // Real-time
  startRealtime: (callbacks?: WhisperXCallbacks) => Promise<void>;
  stopRealtime: () => void;
}

export interface WhisperXContextValue extends UseWhisperXReturn {
  // Global state management
  instances: Map<string, UseWhisperXReturn>;
  createInstance: (id: string, options?: UseWhisperXOptions) => UseWhisperXReturn;
  removeInstance: (id: string) => void;
  
  // Performance monitoring
  globalPerformance: {
    totalProcessingTime: number;
    averageRTF: number;
    peakMemoryUsage: number;
  };
}

// Component Props
export interface WhisperXProviderProps {
  children: React.ReactNode;
  defaultConfig?: Partial<WhisperXConfig>;
  enableGlobalPerformanceMonitoring?: boolean;
}

export interface TranscriptionDisplayProps {
  result: TranscriptionResult | null;
  showSpeakers?: boolean;
  showTimestamps?: boolean;
  showConfidence?: boolean;
  highlightCurrentWord?: boolean;
  className?: string;
  onWordClick?: (word: WordSegment) => void;
}

export interface SpeakerVisualizerProps {
  speakers: SpeakerSegment[];
  currentTime?: number;
  height?: number;
  className?: string;
  onSpeakerClick?: (speaker: string) => void;
}

export interface AudioWaveformProps {
  audioData: Float32Array;
  vadSegments?: VADSegment[];
  speakerSegments?: SpeakerSegment[];
  currentTime?: number;
  height?: number;
  className?: string;
  onTimeSeek?: (time: number) => void;
}

export interface RealtimeControlsProps {
  whisperX: UseWhisperXReturn;
  showAdvanced?: boolean;
  className?: string;
}

// Error types
export class WhisperXError extends Error {
  constructor(
    message: string,
    public code: string,
    public phase: 'initialization' | 'vad' | 'transcription' | 'alignment' | 'diarization'
  ) {
    super(message);
    this.name = 'WhisperXError';
  }
}

// Performance monitoring
export interface PerformanceMetrics {
  vadTime: number;
  transcriptionTime: number;
  alignmentTime: number;
  diarizationTime: number;
  totalTime: number;
  realTimeFactor: number;
  memoryUsage: number;
  audioLength: number;
}

// Model loading status
export interface ModelLoadingState {
  whisper: 'loading' | 'loaded' | 'error';
  alignment: 'loading' | 'loaded' | 'error';
  diarization: 'loading' | 'loaded' | 'error';
  vad: 'loading' | 'loaded' | 'error';
}

// Event system
export interface WhisperXEvent {
  type: string;
  timestamp: number;
  data: any;
}

export interface WhisperXEventHandlers {
  onModelLoaded?: (model: keyof ModelLoadingState) => void;
  onModelError?: (model: keyof ModelLoadingState, error: Error) => void;
  onProcessingStart?: (audioLength: number) => void;
  onProcessingComplete?: (result: TranscriptionResult, metrics: PerformanceMetrics) => void;
  onRealtimeStart?: () => void;
  onRealtimeStop?: () => void;
}