/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Direct transliteration of whisperx/vads/vad.py and pyannote.py
// import type { VADSegment, AudioChunk } from '../../../../types/whisperx';

interface SegmentX {
  start: number;
  end: number;
  speaker: string;
}

interface MergedSegment {
  start: number;
  end: number;
  segments: [number, number][];
}

interface SlidingWindowFeature {
  data: number[][];
  sliding_window: {
    start: number;
    duration: number;
    step: number;
  };
  labels?: string[];
}

interface Annotation {
  segments: Map<string, { start: number; end: number; label: string }[]>;
  support(collar: number): Annotation;
  itertracks(): Array<[{ start: number; end: number; duration: number }, string]>;
}

// Base VAD class - transliteration of whisperx/vads/vad.py
export abstract class Vad {
  protected vad_onset: number;

  constructor(vad_onset: number) {
    if (!(0 < vad_onset && vad_onset < 1)) {
      throw new Error("vad_onset is a decimal value between 0 and 1.");
    }
    this.vad_onset = vad_onset;
  }

  static preprocessAudio(audio: Float32Array): Float32Array {
    // Base implementation - can be overridden
    return audio;
  }

  // Direct transliteration of merge_chunks static method
  static mergeChunks(
    segments: SegmentX[],
    chunk_size: number,
    onset: number,
    offset?: number
  ): MergedSegment[] {
    /**
     * Merge operation described in paper
     */
    let curr_end = 0;
    const merged_segments: MergedSegment[] = [];
    let seg_idxs: [number, number][] = [];
    let speaker_idxs: (string | null)[] = [];

    if (segments.length === 0) return merged_segments;

    let curr_start = segments[0].start;
    
    for (const seg of segments) {
      if (seg.end - curr_start > chunk_size && curr_end - curr_start > 0) {
        merged_segments.push({
          start: curr_start,
          end: curr_end,
          segments: seg_idxs,
        });
        curr_start = seg.start;
        seg_idxs = [];
        speaker_idxs = [];
      }
      curr_end = seg.end;
      seg_idxs.push([seg.start, seg.end]);
      speaker_idxs.push(seg.speaker);
    }
    
    // add final
    merged_segments.push({
      start: curr_start,
      end: curr_end,
      segments: seg_idxs,
    });

    return merged_segments;
  }

  abstract call(audio: any, kwargs?: any): Promise<any>;
}

// Direct transliteration of Binarize class from pyannote.py
class Binarize {
  private onset: number;
  private offset: number;
  private min_duration_on: number;
  private min_duration_off: number;
  private pad_onset: number;
  private pad_offset: number;
  private max_duration: number;

  constructor(
    onset: number = 0.5,
    offset?: number,
    min_duration_on: number = 0.0,
    min_duration_off: number = 0.0,
    pad_onset: number = 0.0,
    pad_offset: number = 0.0,
    max_duration: number = Infinity
  ) {
    this.onset = onset;
    this.offset = offset || onset;
    this.pad_onset = pad_onset;
    this.pad_offset = pad_offset;
    this.min_duration_on = min_duration_on;
    this.min_duration_off = min_duration_off;
    this.max_duration = max_duration;
  }

  call(scores: SlidingWindowFeature): Annotation {
    /**
     * Binarize detection scores
     */
    const num_frames = scores.data.length;
    const num_classes = scores.data[0]?.length || 1;
    const frames = scores.sliding_window;
    
    // Generate timestamps
    const timestamps: number[] = [];
    for (let i = 0; i < num_frames; i++) {
      timestamps.push(frames.start + (i * frames.step) + (frames.duration / 2));
    }

    // annotation meant to store 'active' regions
    const active: Annotation = {
      segments: new Map(),
      support: (collar: number) => active, // Simplified
      itertracks: () => []
    };

    // Process each class (typically just one for VAD)
    for (let k = 0; k < num_classes; k++) {
      const label = scores.labels?.[k] || k.toString();
      const k_scores = scores.data.map(frame => frame[k]);

      // initial state
      let start = timestamps[0];
      let is_active = k_scores[0] > this.onset;
      let curr_scores = [k_scores[0]];
      let curr_timestamps = [start];
      let t = start;

      for (let i = 1; i < timestamps.length; i++) {
        t = timestamps[i];
        const y = k_scores[i];

        // currently active
        if (is_active) {
          const curr_duration = t - start;
          
          if (curr_duration > this.max_duration) {
            const search_after = Math.floor(curr_scores.length / 2);
            // divide segment
            const min_score_div_idx = search_after + this.argmin(curr_scores.slice(search_after));
            const min_score_t = curr_timestamps[min_score_div_idx];
            
            // Add region to annotation
            this.addRegion(active, start - this.pad_onset, min_score_t + this.pad_offset, label);
            
            start = curr_timestamps[min_score_div_idx];
            curr_scores = curr_scores.slice(min_score_div_idx + 1);
            curr_timestamps = curr_timestamps.slice(min_score_div_idx + 1);
          }
          // switching from active to inactive
          else if (y < this.offset) {
            this.addRegion(active, start - this.pad_onset, t + this.pad_offset, label);
            start = t;
            is_active = false;
            curr_scores = [];
            curr_timestamps = [];
          }
          
          curr_scores.push(y);
          curr_timestamps.push(t);
        }
        // currently inactive
        else {
          // switching from inactive to active
          if (y > this.onset) {
            start = t;
            is_active = true;
          }
        }
      }

      // if active at the end, add final region
      if (is_active) {
        this.addRegion(active, start - this.pad_onset, t + this.pad_offset, label);
      }
    }

    return active;
  }

  private argmin(arr: number[]): number {
    let minIdx = 0;
    let minVal = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < minVal) {
        minVal = arr[i];
        minIdx = i;
      }
    }
    return minIdx;
  }

  private addRegion(annotation: Annotation, start: number, end: number, label: string): void {
    if (!annotation.segments.has(label)) {
      annotation.segments.set(label, []);
    }
    annotation.segments.get(label)!.push({ start, end, label });
  }
}

// Direct transliteration of Pyannote class
export class PyannoteVAD extends Vad {
  private vad_pipeline: any;
  private device: string;

  constructor(device: string, _use_auth_token?: string, _model_fp?: string, kwargs: any = {}) {
    console.log(">>Performing voice activity detection using Pyannote...");
    super(kwargs.vad_onset || 0.5);
    this.device = device;
    this.vad_pipeline = this.loadVadModel(device, _use_auth_token, _model_fp);
  }

  private loadVadModel(device: string, _use_auth_token?: string, _model_fp?: string): any {
    // In browser environment, we'd use a lightweight VAD model
    // For now, simulate the pyannote VAD model loading
    console.log(`Loading VAD model on device: ${device}`);
    
    return {
      device,
      model_loaded: true,
      // Mock VAD inference
      infer: (audio: Float32Array) => this.mockVADInference(audio)
    };
  }

  private mockVADInference(audio: Float32Array): SlidingWindowFeature {
    // Simplified VAD inference - would use actual model in production
    const frame_length = 400; // 25ms at 16kHz
    const hop_length = 160;   // 10ms at 16kHz
    const num_frames = Math.floor((audio.length - frame_length) / hop_length) + 1;
    
    const scores: number[][] = [];
    
    for (let i = 0; i < num_frames; i++) {
      const start_idx = i * hop_length;
      const frame = audio.slice(start_idx, start_idx + frame_length);
      
      // Simple energy-based VAD score
      let energy = 0;
      for (const sample of frame) {
        energy += sample * sample;
      }
      energy = Math.sqrt(energy / frame.length);
      
      // Convert energy to probability-like score
      const vad_score = Math.min(Math.max(energy * 10, 0), 1);
      scores.push([vad_score]);
    }

    return {
      data: scores,
      sliding_window: {
        start: 0,
        duration: frame_length / 16000,
        step: hop_length / 16000
      },
      labels: ['speech']
    };
  }

  async call(audio: { waveform: Float32Array; sample_rate: number }): Promise<any> {
    // Direct transliteration of __call__ method
    return this.vad_pipeline.infer(audio.waveform);
  }

  static preprocessAudio(audio: Float32Array): Float32Array {
    // Direct transliteration of preprocess_audio
    return audio; // In PyTorch version: torch.from_numpy(audio).unsqueeze(0)
  }

  static mergeChunks(
    segments: any,
    chunk_size: number,
    onset: number = 0.5,
    _offset?: number
  ): MergedSegment[] {
    // Direct transliteration of merge_chunks method
    if (!(chunk_size > 0)) {
      throw new Error("chunk_size must be > 0");
    }

    const binarize = new Binarize({
      max_duration: chunk_size,
      onset,
      offset: onset
    } as any);
    
    const binarized_segments = binarize.call(segments);
    const segments_list: SegmentX[] = [];
    
    // Convert annotation to segment list
    for (const [label, regions] of binarized_segments.segments) {
      for (const region of regions) {
        segments_list.push({
          start: region.start,
          end: region.end,
          speaker: "UNKNOWN"
        });
      }
    }

    if (segments_list.length === 0) {
      console.log("No active speech found in audio");
      return [];
    }

    return Vad.mergeChunks(segments_list, chunk_size, onset, _offset);
  }
}

// Factory function similar to Python load_vad_model
export function loadVADModel(
  device: string,
  vad_onset: number = 0.500,
  vad_offset: number = 0.363,
  _use_auth_token?: string,
  _model_fp?: string
): PyannoteVAD {
  return new PyannoteVAD(device, _use_auth_token, _model_fp, {
    vad_onset,
    vad_offset
  });
}

// Default VAD options matching Python
export const DEFAULT_VAD_OPTIONS = {
  chunk_size: 30,
  vad_onset: 0.500,
  vad_offset: 0.363
};