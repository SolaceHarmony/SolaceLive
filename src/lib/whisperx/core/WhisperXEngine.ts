/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import type {
  WhisperXConfig,
  WhisperXState,
  TranscriptionResult,
  AudioChunk,
  ModelLoadingState
} from '../../../types/whisperx';
import { WhisperXError } from '../../../types/whisperx';

export class WhisperXEngine extends EventEmitter {
  private config: WhisperXConfig;
  private state: WhisperXState;
  private modelStates: ModelLoadingState;
  private audioContext: AudioContext | null = null;
  private models: {
    whisper?: any;
    alignment?: any;
    diarization?: any;
    vad?: any;
  } = {};

  constructor(config: Partial<WhisperXConfig> = {}) {
    super();
    
    this.config = {
      // Model defaults
      whisperModel: 'base.en',
      alignmentModel: 'wav2vec2-base',
      diarizationModel: 'pyannote/speaker-diarization',
      
      // Performance defaults
      batchSize: 16,
      chunkLength: 30,
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
      
      ...config
    };

    this.state = {
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
    };

    this.modelStates = {
      whisper: 'loading',
      alignment: 'loading',
      diarization: 'loading',
      vad: 'loading'
    };
  }

  async initialize(): Promise<void> {
    try {
      this.emit('initializationStart');
      
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // Load models concurrently
      const loadPromises: Promise<void>[] = [];
      
      if (this.config.enableVAD) {
        loadPromises.push(this.loadVADModel());
      }
      
      loadPromises.push(this.loadWhisperModel());
      
      if (this.config.enableAlignment) {
        loadPromises.push(this.loadAlignmentModel());
      }
      
      if (this.config.enableDiarization) {
        loadPromises.push(this.loadDiarizationModel());
      }

      await Promise.all(loadPromises);
      
      this.state.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', new WhisperXError(
        `Initialization failed: ${error}`,
        'INIT_FAILED',
        'initialization'
      ));
      throw error;
    }
  }

  private async loadVADModel(): Promise<void> {
    try {
      this.emit('modelLoadingStart', 'vad');
      
      // Load real VAD model
      const { PyannoteVAD } = await import('./models/VADModelReal');
      this.models.vad = new PyannoteVAD('cpu', undefined, undefined, {
        vad_onset: this.config.vadThreshold,
        vad_offset: this.config.vadThreshold * 0.7
      });
      
      this.modelStates.vad = 'loaded';
      this.emit('modelLoaded', 'vad');
      
    } catch (error) {
      this.modelStates.vad = 'error';
      this.emit('modelError', 'vad', error);
      throw error;
    }
  }

  private async loadWhisperModel(): Promise<void> {
    try {
      this.emit('modelLoadingStart', 'whisper');
      
      // Load FasterWhisperPipeline
      const { FasterWhisperPipeline } = await import('./models/FasterWhisperModel');
      this.models.whisper = new FasterWhisperPipeline(
        this.config.whisperModel,
        'cpu',
        1024,
        1,
        false,
        false,
        {}
      );
      
      this.modelStates.whisper = 'loaded';
      this.emit('modelLoaded', 'whisper');
      
    } catch (error) {
      this.modelStates.whisper = 'error';
      this.emit('modelError', 'whisper', error);
      throw error;
    }
  }

  private async loadAlignmentModel(): Promise<void> {
    try {
      this.emit('modelLoadingStart', 'alignment');
      
      // Map simple names to browser-compatible Xenova repos
      const mapAlignmentToHF = (name: string): string => {
        switch (name) {
          case 'wav2vec2-large':
            return 'Xenova/wav2vec2-large-960h-lv60';
          case 'wav2vec2-base':
          default:
            return 'Xenova/wav2vec2-base-960h';
        }
      };
      const resolvedModel = mapAlignmentToHF(this.config.alignmentModel);

      // Load real alignment model
      const { AlignmentModel } = await import('./models/AlignmentModelReal');
      this.models.alignment = new AlignmentModel();
      
      await this.models.alignment.loadAlignModel('en', 'cpu', resolvedModel);

      this.modelStates.alignment = 'loaded';
      this.emit('modelLoaded', 'alignment');
      
    } catch (error) {
      this.modelStates.alignment = 'error';
      this.emit('modelError', 'alignment', error as any);
      // Fail-soft: do not throw; continue without alignment
    }
  }

  private async loadDiarizationModel(): Promise<void> {
    try {
      this.emit('modelLoadingStart', 'diarization');
      
      // Load speaker diarization model
      const { DiarizationModel } = await import('./models/DiarizationModel');
      this.models.diarization = new DiarizationModel({
        modelName: this.config.diarizationModel
      });
      
      await this.models.diarization.initialize();
      
      this.modelStates.diarization = 'loaded';
      this.emit('modelLoaded', 'diarization');
      
    } catch (error) {
      this.modelStates.diarization = 'error';
      this.emit('modelError', 'diarization', error as any);
      // Fail-soft: do not throw; continue without diarization
    }
  }

  async processAudio(audioChunk: AudioChunk): Promise<TranscriptionResult> {
    if (!this.state.isInitialized) {
      throw new WhisperXError('Engine not initialized', 'NOT_INITIALIZED', 'transcription');
    }

    this.state.isProcessing = true;
    const startTime = performance.now();
    const audioDuration = audioChunk.duration ?? (audioChunk.data.length / audioChunk.sampleRate);
    
    try {
      this.emit('processingStart', audioDuration);
      
      // Real WhisperX pipeline: use FasterWhisperPipeline.transcribe()
      const transcriptionResult = await this.models.whisper.transcribe(
        audioChunk.data,
        this.config.batchSize,
        'en',
        'transcribe',
        this.config.chunkLength,
        false, // print_progress
        false, // combined_progress
        false  // verbose
      );

      // Step 2: Forced Alignment using transliterated alignment model
      let alignmentResult: any = null;
      if (this.config.enableAlignment && this.models.alignment) {
        alignmentResult = await this.models.alignment.align(
          transcriptionResult.segments,
          audioChunk.data,
          'cpu',
          'nearest',
          false, // return_char_alignments
          false, // print_progress
          false  // combined_progress
        );
      }

      // Combine results into expected format
      const result: TranscriptionResult = {
        text: transcriptionResult.segments.map((s: any) => s.text).join(' '),
        words: alignmentResult?.word_segments || [],
        speakers: [], // Would add diarization results here
        language: transcriptionResult.language,
        duration: audioDuration
      };

      const totalTime = performance.now() - startTime;
      this.state.performance = {
        processingTime: totalTime,
        realTimeFactor: totalTime / 1000 / audioDuration,
        memoryUsage: this.getMemoryUsage()
      };

      this.emit('processingComplete', result);
      return result;

    } catch (error) {
      this.emit('error', new WhisperXError(
        `Processing failed: ${error}`,
        'PROCESSING_FAILED',
        'transcription'
      ));
      throw error;
    } finally {
      this.state.isProcessing = false;
    }
  }

  async startRealtime(): Promise<void> {
    if (!this.state.isInitialized) {
      throw new WhisperXError('Engine not initialized', 'NOT_INITIALIZED', 'transcription');
    }

    this.state.isListening = true;
    this.emit('realtimeStart');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      await this.processRealtimeStream(stream);
      
    } catch (error) {
      this.state.isListening = false;
      this.emit('error', new WhisperXError(
        `Real-time processing failed: ${error}`,
        'REALTIME_FAILED',
        'transcription'
      ));
      throw error;
    }
  }

  private async processRealtimeStream(stream: MediaStream): Promise<void> {
    if (!this.audioContext) return;

    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    const audioBuffer: Float32Array[] = [];
    const chunkSizeInSamples = this.config.chunkLength * this.config.sampleRate;
    
    processor.onaudioprocess = async (event) => {
      if (!this.state.isListening) return;
      
      const inputData = event.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(inputData);
      audioBuffer.push(chunk);
      
      // Update audio level for UI
      const level = this.calculateAudioLevel(chunk);
      this.state.audioLevel = level;
      this.emit('audioLevel', level);
      
      // Process when we have enough audio
      const totalSamples = audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
      if (totalSamples >= chunkSizeInSamples) {
        const combinedAudio = this.combineAudioBuffers(audioBuffer);
        audioBuffer.length = 0; // Clear buffer
        
        const audioChunk: AudioChunk = {
          data: combinedAudio,
          timestamp: Date.now(),
          sampleRate: this.config.sampleRate,
          channels: this.config.channels,
          duration: combinedAudio.length / this.config.sampleRate
        };
        
        // Process in background to avoid blocking audio
        this.processAudio(audioChunk).catch(error => {
          this.emit('error', error);
        });
      }
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  stopRealtime(): void {
    this.state.isListening = false;
    this.state.audioLevel = 0;
    this.emit('realtimeStop');
  }

  private calculateAudioLevel(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  private combineAudioBuffers(buffers: Float32Array[]): Float32Array {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
      combined.set(buffer, offset);
      offset += buffer.length;
    }
    
    return combined;
  }

  private getMemoryUsage(): number {
    // Estimate memory usage (simplified)
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  // Getters
  get currentState(): WhisperXState {
    return { ...this.state };
  }

  get currentConfig(): WhisperXConfig {
    return { ...this.config };
  }

  get modelLoadingStates(): ModelLoadingState {
    return { ...this.modelStates };
  }

  // Configuration updates
  updateConfig(newConfig: Partial<WhisperXConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  // Cleanup
  dispose(): void {
    this.stopRealtime();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Dispose models
    Object.values(this.models).forEach(model => {
      if (model && typeof model.dispose === 'function') {
        model.dispose();
      }
    });
    
    this.models = {};
    this.state.isInitialized = false;
    this.emit('disposed');
  }
}