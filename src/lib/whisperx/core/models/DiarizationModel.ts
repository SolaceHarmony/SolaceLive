import type { DiarizationResult, SpeakerSegment, AudioChunk, AlignmentResult } from '../../../../types/whisperx';

export interface DiarizationConfig {
  modelName: string;
  minSpeakers?: number;
  maxSpeakers?: number;
  device?: 'cpu' | 'gpu';
  embeddingDim?: number;
  windowSize?: number;
  hopLength?: number;
  clusteringThreshold?: number;
}

export interface SpeakerEmbedding {
  embedding: Float32Array;
  timestamp: number;
  duration: number;
  confidence: number;
}

export interface SpeakerCluster {
  id: string;
  centroid: Float32Array;
  embeddings: SpeakerEmbedding[];
  confidence: number;
}

export class DiarizationModel {
  private config: Required<DiarizationConfig>;
  private isInitialized: boolean = false;
  private model: any = null;
  private audioContext: AudioContext | null = null;
  private speakerClusters: Map<string, SpeakerCluster> = new Map();
  private speakerCounter: number = 0;

  // Audio processing parameters
  private readonly SAMPLE_RATE = 16000;
  private readonly FRAME_RATE = 100; // 100 frames per second for speaker embeddings

  constructor(config: DiarizationConfig) {
    this.config = {
      minSpeakers: 1,
      maxSpeakers: 10,
      device: 'cpu',
      embeddingDim: 192,
      windowSize: 1.5, // seconds
      hopLength: 0.75, // seconds
      clusteringThreshold: 0.7,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.SAMPLE_RATE
      });

      // Load speaker diarization model (e.g., PyAnnote, WeSpeaker)
      await this.loadDiarizationModel();
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`DiarizationModel initialization failed: ${error}`);
    }
  }

  private async loadDiarizationModel(): Promise<void> {
    // In a real implementation, this would load models like:
    // - PyAnnote speaker segmentation
    // - Speaker embedding model (ResNet, ECAPA-TDNN)
    // - Clustering algorithms
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.model = {
          modelName: this.config.modelName,
          loaded: true,
          embeddingDim: this.config.embeddingDim,
          // Mock model components
          segmentation: { loaded: true },
          embedding: { loaded: true },
          clustering: { loaded: true }
        };
        resolve();
      }, 1200);
    });
  }

  async diarize(audioChunk: AudioChunk, alignmentResult?: AlignmentResult | null): Promise<DiarizationResult> {
    if (!this.isInitialized) {
      throw new Error('DiarizationModel not initialized');
    }

    // Preprocess audio for speaker modeling
    const processedAudio = await this.preprocessAudio(audioChunk);
    
    // Extract speaker embeddings from audio segments
    const embeddings = await this.extractSpeakerEmbeddings(processedAudio, audioChunk.sampleRate);
    
    // Perform speaker clustering
    const clusters = await this.clusterSpeakers(embeddings);
    
    // Create speaker segments with temporal boundaries
    const speakerSegments = this.createSpeakerSegments(clusters, alignmentResult);
    
    // Update persistent speaker models
    this.updateSpeakerModels(clusters);
    
    return {
      speakers: speakerSegments,
      speakerCount: clusters.length,
      speakerEmbeddings: this.getSpeakerEmbeddingMap(clusters)
    };
  }

  private async preprocessAudio(audioChunk: AudioChunk): Promise<Float32Array> {
    let audio = audioChunk.data;
    
    // Resample to 16kHz if needed
    if (audioChunk.sampleRate !== this.SAMPLE_RATE) {
      audio = this.resampleAudio(audio, audioChunk.sampleRate, this.SAMPLE_RATE);
    }
    
    // Apply audio preprocessing for speaker recognition
    audio = this.normalizeAudio(audio);
    audio = this.applyPreemphasis(audio, 0.97);
    
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

  private normalizeAudio(audio: Float32Array): Float32Array {
    const maxAbs = Math.max(...audio.map(Math.abs));
    if (maxAbs === 0) return audio;
    
    return audio.map(x => x / maxAbs);
  }

  private applyPreemphasis(audio: Float32Array, coefficient: number): Float32Array {
    const filtered = new Float32Array(audio.length);
    filtered[0] = audio[0];

    for (let i = 1; i < audio.length; i++) {
      filtered[i] = audio[i] - coefficient * audio[i - 1];
    }

    return filtered;
  }

  private async extractSpeakerEmbeddings(audio: Float32Array, sampleRate: number): Promise<SpeakerEmbedding[]> {
    const embeddings: SpeakerEmbedding[] = [];
    
    const windowSamples = Math.floor(this.config.windowSize * sampleRate);
    const hopSamples = Math.floor(this.config.hopLength * sampleRate);
    
    for (let i = 0; i + windowSamples <= audio.length; i += hopSamples) {
      const window = audio.slice(i, i + windowSamples);
      const timestamp = i / sampleRate;
      
      // Check if window has sufficient energy (voice activity)
      const energy = this.computeEnergy(window);
      if (energy < 0.01) continue; // Skip low-energy windows
      
      // Extract speaker embedding for this window
      const embedding = await this.extractWindowEmbedding(window);
      const confidence = this.computeEmbeddingConfidence(embedding, energy);
      
      embeddings.push({
        embedding,
        timestamp,
        duration: this.config.windowSize,
        confidence
      });
    }
    
    return embeddings;
  }

  private computeEnergy(window: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < window.length; i++) {
      energy += window[i] * window[i];
    }
    return Math.sqrt(energy / window.length);
  }

  private async extractWindowEmbedding(window: Float32Array): Promise<Float32Array> {
    // Extract speaker embedding using deep neural network
    // This would use models like ECAPA-TDNN, ResNet, or X-Vector
    
    // For now, we'll create mock embeddings based on spectral characteristics
    const embedding = new Float32Array(this.config.embeddingDim);
    
    // Extract spectral features
    const spectralFeatures = this.extractSpectralFeatures(window);
    
    // Transform to embedding space (simplified)
    for (let i = 0; i < embedding.length; i++) {
      let value = 0;
      
      // Combine spectral features with learned transformations
      for (let j = 0; j < Math.min(spectralFeatures.length, 64); j++) {
        value += spectralFeatures[j] * Math.cos((i * j) * 0.1) * Math.sin(i * 0.05);
      }
      
      embedding[i] = value / 64;
    }
    
    // L2 normalize embedding
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }

  private extractSpectralFeatures(window: Float32Array): Float32Array {
    // Extract features like MFCC, spectral centroid, etc.
    const fftSize = 512;
    const features = new Float32Array(128);
    
    // Simplified spectral feature extraction
    const fft = this.computeFFT(window, fftSize);
    const magnitude = fft.map(c => Math.sqrt(c.real * c.real + c.imag * c.imag));
    
    // Mel-frequency cepstral coefficients (simplified)
    for (let i = 0; i < features.length; i++) {
      const binStart = Math.floor(i * magnitude.length / features.length);
      const binEnd = Math.floor((i + 1) * magnitude.length / features.length);
      
      let value = 0;
      for (let j = binStart; j < binEnd; j++) {
        value += magnitude[j];
      }
      features[i] = Math.log(value / (binEnd - binStart) + 1e-8);
    }
    
    return features;
  }

  private computeFFT(signal: Float32Array, size: number): Array<{real: number, imag: number}> {
    // Simplified FFT implementation
    const paddedSignal = new Float32Array(size);
    paddedSignal.set(signal.slice(0, Math.min(signal.length, size)));
    
    const result: Array<{real: number, imag: number}> = [];
    
    for (let k = 0; k < size / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < size; n++) {
        const angle = -2 * Math.PI * k * n / size;
        real += paddedSignal[n] * Math.cos(angle);
        imag += paddedSignal[n] * Math.sin(angle);
      }
      
      result.push({ real, imag });
    }
    
    return result;
  }

  private computeEmbeddingConfidence(embedding: Float32Array, energy: number): number {
    // Compute confidence based on embedding quality and energy
    const embeddingMagnitude = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    const energyScore = Math.min(energy * 10, 1.0);
    const embeddingScore = Math.min(embeddingMagnitude, 1.0);
    
    return (energyScore + embeddingScore) / 2;
  }

  private async clusterSpeakers(embeddings: SpeakerEmbedding[]): Promise<SpeakerCluster[]> {
    if (embeddings.length === 0) return [];
    
    // Use spectral clustering or agglomerative clustering
    const clusters = await this.performSpectralClustering(embeddings);
    
    return clusters;
  }

  private async performSpectralClustering(embeddings: SpeakerEmbedding[]): Promise<SpeakerCluster[]> {
    // Simplified clustering algorithm
    const clusters: SpeakerCluster[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < embeddings.length; i++) {
      if (used.has(i)) continue;
      
      const clusterEmbeddings = [embeddings[i]];
      used.add(i);
      
      // Find similar embeddings
      for (let j = i + 1; j < embeddings.length; j++) {
        if (used.has(j)) continue;
        
        const similarity = this.computeCosineSimilarity(
          embeddings[i].embedding,
          embeddings[j].embedding
        );
        
        if (similarity > this.config.clusteringThreshold) {
          clusterEmbeddings.push(embeddings[j]);
          used.add(j);
        }
      }
      
      // Create cluster
      if (clusterEmbeddings.length > 0) {
        const speakerId = this.generateSpeakerId();
        const centroid = this.computeCentroid(clusterEmbeddings.map(e => e.embedding));
        const confidence = clusterEmbeddings.reduce((sum, e) => sum + e.confidence, 0) / clusterEmbeddings.length;
        
        clusters.push({
          id: speakerId,
          centroid,
          embeddings: clusterEmbeddings,
          confidence
        });
      }
    }
    
    // Ensure we respect min/max speakers constraints
    return this.refineClusters(clusters);
  }

  private computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private computeCentroid(embeddings: Float32Array[]): Float32Array {
    if (embeddings.length === 0) return new Float32Array(this.config.embeddingDim);
    
    const centroid = new Float32Array(this.config.embeddingDim);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < embedding.length; i++) {
        centroid[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < centroid.length; i++) {
      centroid[i] /= embeddings.length;
    }
    
    return centroid;
  }

  private generateSpeakerId(): string {
    return `SPEAKER_${String(this.speakerCounter++).padStart(2, '0')}`;
  }

  private refineClusters(clusters: SpeakerCluster[]): SpeakerCluster[] {
    // Sort by confidence and size
    const sorted = clusters.sort((a, b) => {
      const scoreA = a.confidence * a.embeddings.length;
      const scoreB = b.confidence * b.embeddings.length;
      return scoreB - scoreA;
    });
    
    // Apply min/max constraints
    const refined = sorted.slice(0, this.config.maxSpeakers);
    
    // Merge small clusters if below minimum
    if (refined.length < this.config.minSpeakers && refined.length > 1) {
      // Merge least confident clusters
      while (refined.length < this.config.minSpeakers && refined.length > 1) {
        const last = refined.pop()!;
        const secondLast = refined[refined.length - 1];
        
        // Merge into second last cluster
        secondLast.embeddings.push(...last.embeddings);
        secondLast.centroid = this.computeCentroid(secondLast.embeddings.map(e => e.embedding));
        secondLast.confidence = (secondLast.confidence + last.confidence) / 2;
      }
    }
    
    return refined;
  }

  private createSpeakerSegments(clusters: SpeakerCluster[], alignmentResult?: AlignmentResult | null): SpeakerSegment[] {
    const segments: SpeakerSegment[] = [];
    
    for (const cluster of clusters) {
      // Group consecutive embeddings into segments
      let currentSegmentStart: number | null = null;
      let lastTimestamp = -1;
      const segmentGapThreshold = 1.0; // seconds
      
      for (const embedding of cluster.embeddings.sort((a, b) => a.timestamp - b.timestamp)) {
        if (currentSegmentStart === null) {
          currentSegmentStart = embedding.timestamp;
        } else if (embedding.timestamp - lastTimestamp > segmentGapThreshold) {
          // End current segment
          segments.push({
            speaker: cluster.id,
            start: currentSegmentStart,
            end: lastTimestamp + this.config.windowSize,
            confidence: cluster.confidence
          });
          
          // Start new segment
          currentSegmentStart = embedding.timestamp;
        }
        
        lastTimestamp = embedding.timestamp;
      }
      
      // Close final segment
      if (currentSegmentStart !== null && lastTimestamp >= 0) {
        segments.push({
          speaker: cluster.id,
          start: currentSegmentStart,
          end: lastTimestamp + this.config.windowSize,
          confidence: cluster.confidence
        });
      }
    }
    
    // Merge overlapping segments and resolve conflicts
    return this.resolveSegmentOverlaps(segments);
  }

  private resolveSegmentOverlaps(segments: SpeakerSegment[]): SpeakerSegment[] {
    const sorted = segments.sort((a, b) => a.start - b.start);
    const resolved: SpeakerSegment[] = [];
    
    for (const segment of sorted) {
      let merged = false;
      
      for (let i = resolved.length - 1; i >= 0; i--) {
        const existing = resolved[i];
        
        // Check for overlap
        if (segment.start < existing.end) {
          if (segment.speaker === existing.speaker) {
            // Same speaker - merge segments
            existing.end = Math.max(existing.end, segment.end);
            existing.confidence = Math.max(existing.confidence, segment.confidence);
            merged = true;
            break;
          } else if (segment.confidence > existing.confidence) {
            // Different speaker, higher confidence - split existing segment
            if (segment.start > existing.start) {
              resolved.splice(i + 1, 0, {
                speaker: existing.speaker,
                start: existing.start,
                end: segment.start,
                confidence: existing.confidence
              });
            }
            existing.start = segment.end;
            if (existing.start >= existing.end) {
              resolved.splice(i, 1);
            }
          } else {
            // Lower confidence - truncate new segment
            if (segment.end > existing.end) {
              segment.start = existing.end;
            } else {
              merged = true; // Skip this segment
              break;
            }
          }
        }
      }
      
      if (!merged && segment.start < segment.end) {
        resolved.push(segment);
      }
    }
    
    return resolved.sort((a, b) => a.start - b.start);
  }

  private updateSpeakerModels(clusters: SpeakerCluster[]): void {
    // Update persistent speaker models for better recognition
    for (const cluster of clusters) {
      this.speakerClusters.set(cluster.id, cluster);
    }
  }

  private getSpeakerEmbeddingMap(clusters: SpeakerCluster[]): Map<string, Float32Array> {
    const embeddings = new Map<string, Float32Array>();
    
    for (const cluster of clusters) {
      embeddings.set(cluster.id, cluster.centroid);
    }
    
    return embeddings;
  }

  // Utility methods
  isModelLoaded(): boolean {
    return this.isInitialized && this.model !== null;
  }

  getModelInfo(): { name: string; loaded: boolean; speakerCount: number } {
    return {
      name: this.config.modelName,
      loaded: this.isInitialized,
      speakerCount: this.speakerClusters.size
    };
  }

  getSpeakerProfiles(): Map<string, SpeakerCluster> {
    return new Map(this.speakerClusters);
  }

  resetSpeakerModels(): void {
    this.speakerClusters.clear();
    this.speakerCounter = 0;
  }

  updateConfig(newConfig: Partial<DiarizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.model = null;
    this.speakerClusters.clear();
    this.isInitialized = false;
  }
}