import type { AlignmentResult, WordSegment, AudioChunk } from '../../../../types/whisperx';
import type { WhisperResult, WhisperSegment } from './WhisperModel';

export interface AlignmentConfig {
  modelName: string;
  threshold: number;
  device?: 'cpu' | 'gpu';
  batchSize?: number;
  chunkSize?: number;
}

export interface AlignmentFrame {
  timestamp: number;
  tokens: number[];
  logits: Float32Array;
}

export interface TokenAlignment {
  token: string;
  tokenId: number;
  start: number;
  end: number;
  score: number;
}

// Added: explicit interfaces for model and tokenizer
interface AlignmentBackendModel {
  modelName: string;
  loaded: boolean;
  hiddenSize: number;
  numLayers: number;
  vocabSize: number;
}

interface AlignmentTokenizer {
  vocab: Map<string, number>;
  blankToken: number;
  unkToken: number;
}

export class AlignmentModel {
  private config: Required<AlignmentConfig>;
  private isInitialized: boolean = false;
  private model: AlignmentBackendModel | null = null;
  private tokenizer: AlignmentTokenizer | null = null;
  private audioContext: AudioContext | null = null;

  // Wav2vec2 specific parameters
  private readonly SAMPLE_RATE = 16000;
  private readonly FRAME_RATE = 50; // 50 frames per second
  private readonly HOP_LENGTH = 320; // 16000 / 50

  constructor(config: AlignmentConfig) {
    this.config = {
      device: 'cpu',
      batchSize: 1,
      chunkSize: 30, // seconds
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      // Handle prefixed webkitAudioContext without using any
      type WebAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const w = window as WebAudioWindow;
      const AudioCtx = w.AudioContext || w.webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API AudioContext not available in this environment');
      }
      this.audioContext = new AudioCtx({
        sampleRate: this.SAMPLE_RATE
      });

      // Load wav2vec2 model and tokenizer
      await this.loadAlignmentModel();
      await this.loadTokenizer();
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`AlignmentModel initialization failed: ${error}`);
    }
  }

  private async loadAlignmentModel(): Promise<void> {
    // In a real implementation, this would load wav2vec2 model
    // Either from HuggingFace Transformers.js or custom WASM
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.model = {
          modelName: this.config.modelName,
          loaded: true,
          // Mock model parameters
          hiddenSize: 768,
          numLayers: 12,
          vocabSize: 32
        };
        resolve();
      }, 800);
    });
  }

  private async loadTokenizer(): Promise<void> {
    // Load CTC tokenizer for wav2vec2
    return new Promise((resolve) => {
      setTimeout(() => {
        this.tokenizer = {
          vocab: this.createMockVocab(),
          blankToken: 0,
          unkToken: 1
        };
        resolve();
      }, 200);
    });
  }

  private createMockVocab(): Map<string, number> {
    const vocab = new Map<string, number>();
    
    // CTC blank token
    vocab.set('<blank>', 0);
    vocab.set('<unk>', 1);
    
    // Add letters and common tokens
    const chars = "abcdefghijklmnopqrstuvwxyz '";
    for (let i = 0; i < chars.length; i++) {
      vocab.set(chars[i], i + 2);
    }
    
    return vocab;
  }

  async align(transcriptionResult: WhisperResult, audioChunk: AudioChunk): Promise<AlignmentResult> {
    if (!this.isInitialized) {
      throw new Error('AlignmentModel not initialized');
    }

    // Preprocess audio for wav2vec2
    const audioFeatures = await this.preprocessAudio(audioChunk);
    
    // Extract acoustic features using wav2vec2
    const acousticFrames = await this.extractAcousticFeatures(audioFeatures);
    
    // Prepare text for alignment
    const textTokens = this.tokenizeText(transcriptionResult.text);
    
    // Perform forced alignment using CTC
    const alignments = await this.performForcedAlignment(acousticFrames, textTokens);
    
    // Convert alignments to word-level segments
    const wordSegments = this.createWordSegments(alignments, transcriptionResult.text);

    // Create result with both word and segment level information
    return {
      words: wordSegments,
      segments: this.createSegmentLevelAlignment(wordSegments, transcriptionResult.segments)
    };
  }

  private async preprocessAudio(audioChunk: AudioChunk): Promise<Float32Array> {
    let audio = audioChunk.data;
    
    // Resample to 16kHz if needed
    if (audioChunk.sampleRate !== this.SAMPLE_RATE) {
      audio = this.resampleAudio(audio, audioChunk.sampleRate, this.SAMPLE_RATE);
    }
    
    // Normalize audio
    const maxAbs = Math.max(...audio.map(Math.abs));
    if (maxAbs > 0) {
      audio = audio.map(x => x / maxAbs);
    }
    
    return audio;
  }

  private resampleAudio(audio: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return audio;

    const ratio = fromRate / toRate;
    const outputLength = Math.floor(audio.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexInt = Math.floor(srcIndex);
      const srcIndexFrac = srcIndex - srcIndexInt;

      if (srcIndexInt + 1 < audio.length) {
        output[i] = audio[srcIndexInt] * (1 - srcIndexFrac) + 
                   audio[srcIndexInt + 1] * srcIndexFrac;
      } else {
        output[i] = audio[srcIndexInt] || 0;
      }
    }

    return output;
  }

  private async extractAcousticFeatures(audio: Float32Array): Promise<AlignmentFrame[]> {
    // Extract wav2vec2 features
    const frameLength = this.HOP_LENGTH;
    const numFrames = Math.floor(audio.length / frameLength);
    const frames: AlignmentFrame[] = [];
    
    for (let i = 0; i < numFrames; i++) {
      const startIdx = i * frameLength;
      const timestamp = i / this.FRAME_RATE;
      
      // Extract features for this frame (simplified)
      const frameAudio = audio.slice(startIdx, startIdx + frameLength);
      const features = await this.computeFrameFeatures(frameAudio);
      
      // Convert features to token logits (mock CTC output)
      const logits = this.computeCTCLogits(features);
      
      frames.push({
        timestamp,
        tokens: [], // Will be filled during alignment
        logits
      });
    }
    
    return frames;
  }

  private async computeFrameFeatures(frameAudio: Float32Array): Promise<Float32Array> {
    // Ensure model is loaded
    if (!this.model) {
      throw new Error('Alignment model not loaded');
    }

    // Simplified feature extraction - in reality this would be wav2vec2 CNN features
    const features = new Float32Array(this.model.hiddenSize);
    
    // Mock feature computation
    let energy = 0;
    for (let i = 0; i < frameAudio.length; i++) {
      energy += frameAudio[i] * frameAudio[i];
    }
    energy = Math.sqrt(energy / frameAudio.length);
    
    // Fill with mock features based on audio characteristics
    for (let i = 0; i < features.length; i++) {
      features[i] = energy * Math.sin(i * 0.1) + Math.random() * 0.1;
    }
    
    return features;
  }

  private computeCTCLogits(features: Float32Array): Float32Array {
    // Ensure tokenizer is loaded
    if (!this.tokenizer) {
      throw new Error('Alignment tokenizer not loaded');
    }

    // Convert features to CTC logits over vocabulary
    const vocabSize = this.tokenizer.vocab.size;
    const logits = new Float32Array(vocabSize);
    
    // Simplified logit computation
    for (let i = 0; i < vocabSize; i++) {
      let score = 0;
      for (let j = 0; j < Math.min(features.length, 32); j++) {
        score += features[j] * Math.cos(i * j * 0.1);
      }
      logits[i] = score / 32;
    }
    
    // Apply softmax normalization
    const expSum = logits.reduce((sum, x) => sum + Math.exp(x), 0);
    for (let i = 0; i < logits.length; i++) {
      logits[i] = Math.exp(logits[i]) / expSum;
    }
    
    return logits;
  }

  private tokenizeText(text: string): number[] {
    if (!this.tokenizer) {
      throw new Error('Alignment tokenizer not loaded');
    }

    const tokens: number[] = [];
    const cleanText = text.toLowerCase().trim();
    
    for (const char of cleanText) {
      const tokenId = this.tokenizer.vocab.get(char) || this.tokenizer.unkToken;
      tokens.push(tokenId);
    }
    
    return tokens;
  }

  private async performForcedAlignment(
    frames: AlignmentFrame[], 
    textTokens: number[]
  ): Promise<TokenAlignment[]> {
    // Implement CTC forced alignment algorithm
    const alignments: TokenAlignment[] = [];
    
    if (frames.length === 0 || textTokens.length === 0) {
      return alignments;
    }
    
    // Dynamic Time Warping (DTW) for alignment
    const dtw = this.computeDTWAlignment(frames, textTokens);
    
    // Convert DTW path to token alignments
    return this.convertDTWToTokens(dtw, frames, textTokens);
  }

  private computeDTWAlignment(frames: AlignmentFrame[], tokens: number[]): Array<{frame: number, token: number}> {
    const frameCount = frames.length;
    const tokenCount = tokens.length;
    
    // DTW cost matrix
    const cost = Array(frameCount).fill(null).map(() => Array(tokenCount).fill(Infinity));
    const path = Array(frameCount).fill(null).map(() => Array(tokenCount).fill(null as 'up' | 'left' | 'diag' | null));

    // Initialize first frame
    cost[0][0] = this.computeFrameTokenCost(frames[0], tokens[0]);
    
    // Fill cost matrix
    for (let i = 0; i < frameCount; i++) {
      for (let j = 0; j < tokenCount; j++) {
        if (i === 0 && j === 0) continue;
        
        const frameCost = this.computeFrameTokenCost(frames[i], tokens[j]);
        
        const candidates: Array<{ cost: number; from: 'up' | 'left' | 'diag' }> = [];

        // Stay in same token (frame advance)
        if (i > 0) {
          candidates.push({ cost: cost[i-1][j], from: 'up' });
        }
        
        // Move to next token (token advance)
        if (j > 0) {
          candidates.push({ cost: cost[i][j-1], from: 'left' });
        }
        
        // Diagonal move (both advance)
        if (i > 0 && j > 0) {
          candidates.push({ cost: cost[i-1][j-1], from: 'diag' });
        }
        
        if (candidates.length > 0) {
          const best = candidates.reduce((min, c) => c.cost < min.cost ? c : min);
          cost[i][j] = best.cost + frameCost;
          path[i][j] = best.from;
        }
      }
    }
    
    // Backtrack to find optimal path
    const alignmentPath: Array<{frame: number, token: number}> = [];
    let i = frameCount - 1;
    let j = tokenCount - 1;
    
    while (i >= 0 && j >= 0) {
      alignmentPath.unshift({ frame: i, token: j });
      
      const direction = path[i][j];
      if (direction === 'up') {
        i--;
      } else if (direction === 'left') {
        j--;
      } else if (direction === 'diag') {
        i--;
        j--;
      } else {
        break;
      }
    }
    
    return alignmentPath;
  }

  private computeFrameTokenCost(frame: AlignmentFrame, tokenId: number): number {
    // Compute cost of aligning frame with token
    if (tokenId < frame.logits.length) {
      return -Math.log(frame.logits[tokenId] + 1e-8); // Negative log probability
    }
    return 10; // High cost for invalid token
  }

  private convertDTWToTokens(
    alignmentPath: Array<{frame: number, token: number}>,
    frames: AlignmentFrame[],
    tokens: number[]
  ): TokenAlignment[] {
    if (!this.tokenizer) {
      throw new Error('Alignment tokenizer not loaded');
    }

    const tokenAlignments: TokenAlignment[] = [];
    
    // Group alignment path by tokens
    const tokenGroups = new Map<number, number[]>();
    
    for (const point of alignmentPath) {
      if (!tokenGroups.has(point.token)) {
        tokenGroups.set(point.token, []);
      }
      tokenGroups.get(point.token)!.push(point.frame);
    }
    
    // Convert to token alignments
    for (const [tokenIdx, frameIndices] of tokenGroups) {
      if (frameIndices.length === 0) continue;

      const startFrame = Math.min(...frameIndices);
      const endFrame = Math.max(...frameIndices);

      const startTime = startFrame / this.FRAME_RATE;
      const endTime = (endFrame + 1) / this.FRAME_RATE;

      // Get token text
      const tokenId = tokens[tokenIdx];
      const tokenText = this.getTokenText(tokenId);

      // Calculate alignment score
      const scores = frameIndices.map(frameIdx =>
        frames[frameIdx].logits[tokenId] || 0
      );
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

      tokenAlignments.push({
        token: tokenText,
        tokenId,
        start: startTime,
        end: endTime,
        score: avgScore
      });
    }

    return tokenAlignments.sort((a, b) => a.start - b.start);
  }

  private getTokenText(tokenId: number): string {
    if (!this.tokenizer) {
      return '<unk>';
    }
    for (const [text, id] of this.tokenizer.vocab) {
      if (id === tokenId) {
        return text === '<blank>' ? '' : text;
      }
    }
    return '<unk>';
  }

  private createWordSegments(alignments: TokenAlignment[], originalText: string): WordSegment[] {
    // Reconstruct words from character-level alignments
    const words: WordSegment[] = [];
    const textWords = originalText.toLowerCase().split(/\s+/);

    let currentWordIdx = 0;
    let currentWordChars = '';
    let wordStartTime = 0;

    for (const alignment of alignments) {
      if (alignment.token === ' ' || alignment.token === '') {
        // End of word
        if (currentWordChars.length > 0 && currentWordIdx < textWords.length) {
          const confidence = Math.max(0.1, Math.min(1.0, alignment.score));

          words.push({
            word: textWords[currentWordIdx],
            start: wordStartTime,
            end: alignment.end,
            confidence: confidence
          });

          currentWordIdx++;
          currentWordChars = '';
        }
      } else {
        // Character in word
        if (currentWordChars.length === 0) {
          wordStartTime = alignment.start;
        }
        currentWordChars += alignment.token;
      }
    }

    // Handle last word if no trailing space
    if (currentWordChars.length > 0 && currentWordIdx < textWords.length) {
      const lastAlignment = alignments[alignments.length - 1];
      words.push({
        word: textWords[currentWordIdx],
        start: wordStartTime,
        end: lastAlignment?.end || 0,
        confidence: lastAlignment?.score || 0.5
      });
    }

    return words;
  }

  private createSegmentLevelAlignment(words: WordSegment[], originalSegments: WhisperSegment[]): AlignmentResult['segments'] {
    // Group words into segments based on original Whisper segments
    const segments: AlignmentResult['segments'] = [];

    for (let i = 0; i < originalSegments.length; i++) {
      const originalSegment = originalSegments[i];

      // Find words that belong to this segment
      const segmentWords = words.filter(word => {
        return word.start >= originalSegment.start && word.end <= originalSegment.end;
      });

      if (segmentWords.length > 0) {
        segments.push({
          text: segmentWords.map(w => w.word).join(' '),
          start: segmentWords[0].start,
          end: segmentWords[segmentWords.length - 1].end,
          words: segmentWords
        });
      }
    }

    return segments;
  }

  // Utility methods
  isModelLoaded(): boolean {
    return this.isInitialized && this.model !== null;
  }

  getModelInfo(): { name: string; loaded: boolean; device: string } {
    return {
      name: this.config.modelName,
      loaded: this.isInitialized,
      device: this.config.device
    };
  }

  updateConfig(newConfig: Partial<AlignmentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
