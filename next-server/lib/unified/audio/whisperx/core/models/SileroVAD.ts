/* eslint-disable @typescript-eslint/no-explicit-any */
// Browser implementation of Silero VAD using ONNX Web Runtime
// Based on Python implementation from faster-whisper-plus

// @ts-expect-error - onnxruntime-web is installed via @huggingface/transformers
import { InferenceSession, Tensor } from 'onnxruntime-web';

export interface VadOptions {
  threshold: number;
  neg_threshold: number | null;
  min_speech_duration_ms: number;
  max_speech_duration_s: number;
  min_silence_duration_ms: number;
  speech_pad_ms: number;
}

export const DEFAULT_VAD_OPTIONS: VadOptions = {
  threshold: 0.5,
  neg_threshold: null,
  min_speech_duration_ms: 0,
  max_speech_duration_s: Infinity,
  min_silence_duration_ms: 2000,
  speech_pad_ms: 400
};

interface SpeechSegment {
  start: number;
  end: number;
}

export class SileroVAD {
  private encoderSession: InferenceSession | null = null;
  private decoderSession: InferenceSession | null = null;
  private modelLoaded = false;
  private readonly WINDOW_SIZE_SAMPLES = 512;
  private readonly CONTEXT_SIZE = 64;
  
  constructor(private options: VadOptions = DEFAULT_VAD_OPTIONS) {
    if (this.options.neg_threshold === null) {
      this.options.neg_threshold = Math.max(this.options.threshold - 0.15, 0.01);
    }
  }

  async loadModel(): Promise<void> {
    if (this.modelLoaded) return;
    
    try {
      console.log('Loading Silero VAD models...');
      
      // For now, we'll use a simplified VAD approach
      // In production, you would load actual ONNX models like:
      // this.encoderSession = await InferenceSession.create('/models/silero_encoder_v5.onnx');
      // this.decoderSession = await InferenceSession.create('/models/silero_decoder_v5.onnx');
      
      // Placeholder for model loading
      console.warn('Silero VAD: Using simplified VAD implementation');
      this.modelLoaded = true;
      
    } catch (error) {
      console.error('Failed to load Silero VAD models:', error);
      throw error;
    }
  }

  async getSpeechTimestamps(
    audio: Float32Array,
    samplingRate: number = 16000
  ): Promise<SpeechSegment[]> {
    await this.loadModel();
    
    const options = this.options;
    const threshold = options.threshold;
    const neg_threshold = options.neg_threshold || threshold - 0.15;
    const min_speech_samples = samplingRate * options.min_speech_duration_ms / 1000;
    const speech_pad_samples = samplingRate * options.speech_pad_ms / 1000;
    const max_speech_samples = (
      samplingRate * options.max_speech_duration_s
      - this.WINDOW_SIZE_SAMPLES
      - 2 * speech_pad_samples
    );
    const min_silence_samples = samplingRate * options.min_silence_duration_ms / 1000;
    const min_silence_samples_at_max_speech = samplingRate * 98 / 1000;
    
    const audio_length_samples = audio.length;
    
    // Get speech probabilities
    const speech_probs = await this.predictSpeechProbs(audio);
    
    // Process speech probabilities to find segments
    let triggered = false;
    const speeches: SpeechSegment[] = [];
    let current_speech: Partial<SpeechSegment> = {};
    let temp_end = 0;
    let prev_end = 0;
    let next_start = 0;
    
    for (let i = 0; i < speech_probs.length; i++) {
      const speech_prob = speech_probs[i];
      
      if (speech_prob >= threshold && temp_end) {
        temp_end = 0;
        if (next_start < prev_end) {
          next_start = this.WINDOW_SIZE_SAMPLES * i;
        }
      }
      
      if (speech_prob >= threshold && !triggered) {
        triggered = true;
        current_speech.start = this.WINDOW_SIZE_SAMPLES * i;
        continue;
      }
      
      if (
        triggered &&
        current_speech.start !== undefined &&
        (this.WINDOW_SIZE_SAMPLES * i) - current_speech.start > max_speech_samples
      ) {
        if (prev_end) {
          current_speech.end = prev_end;
          speeches.push(current_speech as SpeechSegment);
          current_speech = {};
          
          if (next_start < prev_end) {
            triggered = false;
          } else {
            current_speech.start = next_start;
          }
          prev_end = next_start = temp_end = 0;
        } else {
          current_speech.end = this.WINDOW_SIZE_SAMPLES * i;
          speeches.push(current_speech as SpeechSegment);
          current_speech = {};
          prev_end = next_start = temp_end = 0;
          triggered = false;
          continue;
        }
      }
      
      if (speech_prob < neg_threshold && triggered) {
        if (!temp_end) {
          temp_end = this.WINDOW_SIZE_SAMPLES * i;
        }
        
        if ((this.WINDOW_SIZE_SAMPLES * i) - temp_end > min_silence_samples_at_max_speech) {
          prev_end = temp_end;
        }
        
        if ((this.WINDOW_SIZE_SAMPLES * i) - temp_end < min_silence_samples) {
          continue;
        } else {
          current_speech.end = temp_end;
          if (
            current_speech.start !== undefined &&
            current_speech.end - current_speech.start > min_speech_samples
          ) {
            speeches.push(current_speech as SpeechSegment);
          }
          current_speech = {};
          prev_end = next_start = temp_end = 0;
          triggered = false;
          continue;
        }
      }
    }
    
    if (
      current_speech.start !== undefined &&
      (audio_length_samples - current_speech.start) > min_speech_samples
    ) {
      current_speech.end = audio_length_samples;
      speeches.push(current_speech as SpeechSegment);
    }
    
    // Apply padding to segments
    for (let i = 0; i < speeches.length; i++) {
      const speech = speeches[i];
      
      if (i === 0) {
        speech.start = Math.max(0, speech.start - speech_pad_samples);
      }
      
      if (i !== speeches.length - 1) {
        const silence_duration = speeches[i + 1].start - speech.end;
        if (silence_duration < 2 * speech_pad_samples) {
          speech.end += Math.floor(silence_duration / 2);
          speeches[i + 1].start = Math.max(0, speeches[i + 1].start - silence_duration / 2);
        } else {
          speech.end = Math.min(audio_length_samples, speech.end + speech_pad_samples);
          speeches[i + 1].start = Math.max(0, speeches[i + 1].start - speech_pad_samples);
        }
      } else {
        speech.end = Math.min(audio_length_samples, speech.end + speech_pad_samples);
      }
    }
    
    return speeches;
  }

  private async predictSpeechProbs(audio: Float32Array): Promise<Float32Array> {
    // If we had the actual ONNX models loaded, we would run inference here
    // For now, use a simplified energy-based approach
    
    const numWindows = Math.floor(audio.length / this.WINDOW_SIZE_SAMPLES);
    const probs = new Float32Array(numWindows);
    
    for (let i = 0; i < numWindows; i++) {
      const start = i * this.WINDOW_SIZE_SAMPLES;
      const end = start + this.WINDOW_SIZE_SAMPLES;
      const window = audio.slice(start, end);
      
      // Calculate RMS energy
      let sum = 0;
      for (let j = 0; j < window.length; j++) {
        sum += window[j] * window[j];
      }
      const rms = Math.sqrt(sum / window.length);
      
      // Convert to probability-like score (0-1)
      // This is a simplified approach - real Silero uses neural network
      const prob = Math.min(Math.max(rms * 20, 0), 1);
      probs[i] = prob;
    }
    
    // Apply smoothing
    const smoothed = new Float32Array(probs.length);
    const windowSize = 3;
    for (let i = 0; i < probs.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(probs.length - 1, i + windowSize); j++) {
        sum += probs[j];
        count++;
      }
      smoothed[i] = sum / count;
    }
    
    return smoothed;
  }

  collectChunks(
    audio: Float32Array,
    chunks: SpeechSegment[],
    samplingRate: number = 16000
  ): { audioChunks: Float32Array[], metadata: Array<{start_time: number, end_time: number}> } {
    if (!chunks.length) {
      return {
        audioChunks: [new Float32Array(0)],
        metadata: [{ start_time: 0, end_time: 0 }]
      };
    }
    
    const audioChunks: Float32Array[] = [];
    const metadata: Array<{start_time: number, end_time: number}> = [];
    
    for (const chunk of chunks) {
      metadata.push({
        start_time: chunk.start / samplingRate,
        end_time: chunk.end / samplingRate
      });
      audioChunks.push(audio.slice(chunk.start, chunk.end));
    }
    
    return { audioChunks, metadata };
  }
  
  mergeSegments(
    segments: SpeechSegment[],
    samplingRate: number = 16000
  ): Array<{start: number, end: number, segments: Array<[number, number]>}> {
    if (!segments.length) return [];
    
    const merged = [];
    const chunk_length = this.options.max_speech_duration_s * samplingRate;
    
    let curr_start = segments[0].start;
    let curr_end = 0;
    let seg_idxs: Array<[number, number]> = [];
    
    for (const seg of segments) {
      if (seg.end - curr_start > chunk_length && curr_end - curr_start > 0) {
        merged.push({
          start: curr_start,
          end: curr_end,
          segments: seg_idxs
        });
        curr_start = seg.start;
        seg_idxs = [];
      }
      curr_end = seg.end;
      seg_idxs.push([seg.start, seg.end]);
    }
    
    // Add final segment
    merged.push({
      start: curr_start,
      end: curr_end,
      segments: seg_idxs
    });
    
    return merged;
  }
}

// Export factory function
export async function createSileroVAD(options?: Partial<VadOptions>): Promise<SileroVAD> {
  const vad = new SileroVAD({ ...DEFAULT_VAD_OPTIONS, ...options });
  await vad.loadModel();
  return vad;
}