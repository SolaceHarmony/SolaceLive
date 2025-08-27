/**
 * Audio utilities for recording and WAV encoding
 */

export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const val = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = val < 0 ? val * 0x8000 : val * 0x7fff;
  }
  return int16Array;
}

export function encodeWAV(
  samples: Float32Array,
  sampleRate: number = 16000,
  numChannels: number = 1
): Blob {
  const length = samples.length * 2; // 16-bit PCM
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  
  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  
  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, length, true);
  
  // Convert float samples to 16-bit PCM
  const pcm = floatTo16BitPCM(samples);
  const offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset + i * 2, pcm[i], true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function sendAudioToBackend(
  audioData: Float32Array,
  modelId: string = 'onnx-community/whisper-base.en'
): Promise<string> {
  try {
    // Convert to WAV blob
    const wavBlob = encodeWAV(audioData);
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    
    // Add model configuration
    const config = {
      modelId,
      sampleRate: 16000
    };
    formData.append('body', JSON.stringify(config));
    
    // Send to backend
    const response = await fetch('http://localhost:8787/api/asr', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.text || '';
  } catch (error) {
    console.error('Failed to send audio to backend:', error);
    throw error;
  }
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioChunks: Float32Array[] = [];
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  constructor(
    private onAudioData?: (data: Float32Array) => void,
    private chunkDuration: number = 5 // seconds
  ) {}
  
  async start(): Promise<void> {
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      // Create audio processing pipeline
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      const chunkSamples = this.chunkDuration * 16000;
      let currentBuffer: Float32Array[] = [];
      let totalSamples = 0;
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData);
        currentBuffer.push(chunk);
        totalSamples += chunk.length;
        
        // When we have enough samples, process the chunk
        if (totalSamples >= chunkSamples) {
          const combined = this.combineBuffers(currentBuffer, totalSamples);
          const trimmed = combined.slice(0, chunkSamples);
          
          // Save for later
          this.audioChunks.push(trimmed);
          
          // Notify listener
          if (this.onAudioData) {
            this.onAudioData(trimmed);
          }
          
          // Keep any overflow for next chunk
          if (combined.length > chunkSamples) {
            currentBuffer = [combined.slice(chunkSamples)];
            totalSamples = currentBuffer[0].length;
          } else {
            currentBuffer = [];
            totalSamples = 0;
          }
        }
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }
  
  stop(): Float32Array {
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    // Disconnect audio nodes
    if (this.source) {
      this.source.disconnect();
    }
    if (this.processor) {
      this.processor.disconnect();
    }
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    // Combine all chunks
    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = this.combineBuffers(this.audioChunks, totalLength);
    
    // Reset
    this.audioChunks = [];
    this.mediaRecorder = null;
    this.audioContext = null;
    this.stream = null;
    this.processor = null;
    this.source = null;
    
    return combined;
  }
  
  private combineBuffers(buffers: Float32Array[], totalLength: number): Float32Array {
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }
  
  getAudioLevel(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }
}