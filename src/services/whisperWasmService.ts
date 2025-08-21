import { WhisperTranscriber } from 'whisper-web-transcriber';

type WebAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

interface WhisperInstance {
  transcribe: (audio: Float32Array) => Promise<{ text?: string } | null | undefined>;
  setLanguage?: (language: string) => void;
  dispose?: () => void;
}

export class WhisperWasmService {
  private whisper: WhisperInstance | null = null;
  private isInitialized: boolean = false;
  private isTranscribing: boolean = false;
  private audioBuffer: Float32Array[] = [];
  private sampleRate: number = 16000;
  private chunkSize: number = 16000; // 1 second chunks at 16kHz
  private overlapSize: number = 1600; // 100ms overlap

  constructor() {}

  async initialize(modelName: 'tiny-en-q5_1' | 'tiny.en' | 'base.en' | 'base-en-q5_1' = 'tiny-en-q5_1'): Promise<void> {
    try {
      console.log('Initializing Whisper WASM...');
      
      this.whisper = (new WhisperTranscriber({
        modelSize: modelName,
        onTranscription: (text: string) => {
          console.log('Whisper transcription:', text);
        }
      }) as unknown) as WhisperInstance;

      // Wait for model to load (simplified for now)
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.isInitialized = true;
      
      console.log('Whisper WASM initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Whisper WASM:', error);
      throw error;
    }
  }

  async transcribeRealTime(
    audioData: Float32Array,
    onPartialResult: (text: string) => void,
    onFinalResult: (text: string) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Whisper WASM not initialized');
    }

    if (this.isTranscribing) {
      // Queue the audio data
      this.audioBuffer.push(audioData);
      return;
    }

    this.isTranscribing = true;

    try {
      // Add new audio data to buffer
      this.audioBuffer.push(audioData);

      // Process in chunks for real-time transcription
      await this.processAudioChunks(onPartialResult, onFinalResult);
    } catch (error) {
      console.error('Error in real-time transcription:', error);
    } finally {
      this.isTranscribing = false;
    }
  }

  private async processAudioChunks(
    onPartialResult: (text: string) => void,
    onFinalResult: (text: string) => void
  ): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    // Concatenate all audio chunks
    const totalLength = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // Clear the buffer
    this.audioBuffer = [];

    // Process in overlapping chunks for better accuracy
    const chunkCount = Math.ceil(combinedAudio.length / this.chunkSize);
    
    for (let i = 0; i < chunkCount; i++) {
      const start = Math.max(0, i * this.chunkSize - this.overlapSize);
      const end = Math.min(combinedAudio.length, (i + 1) * this.chunkSize);
      const chunk = combinedAudio.slice(start, end);

      if (chunk.length < this.chunkSize / 4) {
        // Skip very small chunks
        continue;
      }

      try {
        const result = await this.whisper.transcribe(chunk);
        
        if (result && result.text && result.text.trim()) {
          const isLastChunk = i === chunkCount - 1;
          
          if (isLastChunk) {
            onFinalResult(result.text.trim());
          } else {
            onPartialResult(result.text.trim());
          }
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i}:`, chunkError);
      }

      // Small delay to prevent blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async transcribeAudioBuffer(audioBuffer: ArrayBuffer): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Whisper WASM not initialized');
    }

    try {
      // Convert ArrayBuffer to Float32Array
      const audioData = await this.arrayBufferToFloat32Array(audioBuffer);
      
      const result = await this.whisper.transcribe(audioData);
      return result?.text?.trim() || '';
    } catch (error) {
      console.error('Error transcribing audio buffer:', error);
      throw error;
    }
  }

  async transcribeBlob(audioBlob: Blob): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Whisper WASM not initialized');
    }

    try {
      // Convert blob to the format expected by WhisperTranscriber
      const arrayBuffer = await audioBlob.arrayBuffer();
      const w = window as WebAudioWindow;
      const AudioCtx = w.AudioContext || w.webkitAudioContext;
      const audioContext = new AudioCtx();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get the first channel (mono)
      const channelData = audioBuffer.getChannelData(0);
      
      // Use the transcriber's transcribe method
      const result = await this.whisper.transcribe(channelData);
      return result?.text?.trim() || '';
    } catch (error) {
      console.error('Error transcribing audio blob:', error);
      throw error;
    }
  }

  private async arrayBufferToFloat32Array(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
    try {
      // Decode audio data using Web Audio API
      const w = window as WebAudioWindow;
      const AudioCtx = w.AudioContext || w.webkitAudioContext;
      const audioContext = new AudioCtx();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get the first channel (mono)
      const channelData = audioBuffer.getChannelData(0);
      
      // Resample to 16kHz if necessary
      if (audioBuffer.sampleRate !== this.sampleRate) {
        return this.resampleAudio(channelData, audioBuffer.sampleRate, this.sampleRate);
      }
      
      return channelData;
    } catch (error) {
      console.error('Error converting ArrayBuffer to Float32Array:', error);
      // Fallback: treat as raw float32 data
      return new Float32Array(arrayBuffer);
    }
  }

  private resampleAudio(inputBuffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
    if (inputSampleRate === outputSampleRate) {
      return inputBuffer;
    }

    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(inputBuffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const index = i * sampleRateRatio;
      const indexFloor = Math.floor(index);
      const indexCeil = Math.min(indexFloor + 1, inputBuffer.length - 1);
      const t = index - indexFloor;
      
      // Linear interpolation
      result[i] = inputBuffer[indexFloor] * (1 - t) + inputBuffer[indexCeil] * t;
    }

    return result;
  }

  startStreamingTranscription(
    _onPartialTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: Error) => void
  ): void {
    if (!this.isInitialized) {
      onError(new Error('Whisper WASM not initialized'));
      return;
    }

    console.log('Starting Whisper WASM streaming transcription');
    
    // This will be called by the audio processing pipeline
    // when new audio data is available
  }

  stopStreamingTranscription(): void {
    this.isTranscribing = false;
    this.audioBuffer = [];
    console.log('Stopped Whisper WASM streaming transcription');
  }

  async processStreamingAudio(
    audioChunk: Float32Array,
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<void> {
    if (!this.isInitialized || this.isTranscribing) {
      return;
    }

    try {
      await this.transcribeRealTime(
        audioChunk,
        (partialText) => onTranscript(partialText, false),
        (finalText) => onTranscript(finalText, true)
      );
    } catch (error) {
      console.error('Error processing streaming audio:', error);
    }
  }

  getModelInfo(): { name: string; isInitialized: boolean; isTranscribing: boolean } {
    return {
      name: 'whisper-tiny',
      isInitialized: this.isInitialized,
      isTranscribing: this.isTranscribing
    };
  }

  async loadModel(modelName: 'tiny-en-q5_1' | 'tiny.en' | 'base.en' | 'base-en-q5_1'): Promise<void> {
    if (this.isInitialized) {
      // Dispose current model and load new one
      this.dispose();
    }
    await this.initialize(modelName);
  }

  getSupportedLanguages(): string[] {
    return [
      'english', 'chinese', 'german', 'spanish', 'russian', 'korean', 
      'french', 'japanese', 'portuguese', 'turkish', 'polish', 'catalan',
      'dutch', 'arabic', 'swedish', 'italian', 'indonesian', 'hindi',
      'finnish', 'vietnamese', 'hebrew', 'ukrainian', 'greek', 'malay',
      'czech', 'romanian', 'danish', 'hungarian', 'tamil', 'norwegian'
    ];
  }

  setLanguage(language: string): void {
    if (this.whisper && this.getSupportedLanguages().includes(language)) {
      this.whisper.setLanguage(language);
      console.log(`Whisper language set to: ${language}`);
    } else {
      console.warn(`Unsupported language: ${language}`);
    }
  }

  dispose(): void {
    if (this.whisper) {
      try {
        this.whisper.dispose?.();
      } catch (error) {
        console.warn('Error disposing Whisper WASM:', error);
      }
      this.whisper = null;
    }
    
    this.isInitialized = false;
    this.isTranscribing = false;
    this.audioBuffer = [];
    
    console.log('Whisper WASM disposed');
  }

  // Check if the browser supports the required features
  static isSupported(): boolean {
    try {
      // Check for WebAssembly support
      if (typeof WebAssembly === 'undefined') {
        console.warn('WebAssembly not supported');
        return false;
      }

      // Check for AudioContext support
      const w = window as WebAudioWindow;
      if (typeof (w.AudioContext || w.webkitAudioContext) === 'undefined') {
        console.warn('AudioContext not supported');
        return false;
      }

      // Check for SIMD support (optional but recommended)
      const simdSupported = WebAssembly.validate(new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
        0x03, 0x02, 0x01, 0x00,
        0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0c, 0x00, 0x0b
      ]));

      if (!simdSupported) {
        console.warn('WebAssembly SIMD not supported - performance may be reduced');
      }

      return true;
    } catch (error) {
      console.error('Error checking Whisper WASM support:', error);
      return false;
    }
   }
}