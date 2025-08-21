// filepath: solace-live/src/utils/audioPlayer.ts
// Lightweight audio chunk player for Float32 PCM (mono)
export class AudioChunkPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;
  private sampleRate: number;

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
  }

  private ensureContext() {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new Ctx({ sampleRate: this.sampleRate });
      this.nextStartTime = 0;
    }
  }

  playFloat32(data: Float32Array): void {
    if (!data || data.length === 0) return;
    this.ensureContext();
    const ctx = this.audioCtx!;

    // Create mono buffer and copy data
    const buf = ctx.createBuffer(1, data.length, this.sampleRate);
    buf.copyToChannel(data, 0, 0);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.01, this.nextStartTime || now + 0.01);
    try {
      src.start(startAt);
    } catch (e) {
      // If scheduling fails, start immediately
      try { src.start(); } catch {}
    }

    this.nextStartTime = startAt + buf.duration;

    // Cleanup when finished
    src.onended = () => {
      try { src.disconnect(); } catch {}
    };
  }

  stop(): void {
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
      this.nextStartTime = 0;
    }
  }
}

