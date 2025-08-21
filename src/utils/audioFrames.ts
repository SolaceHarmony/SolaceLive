// filepath: solace-live/src/utils/audioFrames.ts
// Fixed-size audio frame capturer (24 kHz, ~80 ms) using Web Audio
// Emits Float32Array frames of length frameSamples (default 1920 @ 24kHz)

export type FrameCallback = (frame: Float32Array) => void;

export class AudioFrameCapturer {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private proc: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private buffer: Float32Array = new Float32Array(0);
  private running = false;

  constructor(
    private onFrame: FrameCallback,
    private sampleRate: number = 24000,
    private frameSamples: number = Math.round(0.08 * 24000) // 80ms @ 24kHz => 1920
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Get microphone stream
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: this.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Create context at desired sampleRate (browser may pick nearest)
    const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx({ sampleRate: this.sampleRate });

    this.source = this.ctx.createMediaStreamSource(this.stream);
    // Use a common buffer size (2048) and accumulate into exact frames
    this.proc = this.ctx.createScriptProcessor(2048, 1, 1);

    this.proc.onaudioprocess = (e) => {
      if (!this.running) return;
      const incoming = e.inputBuffer.getChannelData(0);
      // Append incoming to buffer
      const combined = new Float32Array(this.buffer.length + incoming.length);
      combined.set(this.buffer, 0);
      combined.set(incoming, this.buffer.length);
      this.buffer = combined;

      // Emit as many full frames as available
      let offset = 0;
      while (this.buffer.length - offset >= this.frameSamples) {
        const frame = this.buffer.subarray(offset, offset + this.frameSamples);
        // Copy to a fresh buffer to avoid referencing a moving backing store
        this.onFrame(new Float32Array(frame));
        offset += this.frameSamples;
      }
      // Keep remainder
      if (offset > 0) {
        const rem = this.buffer.length - offset;
        const left = new Float32Array(rem);
        left.set(this.buffer.subarray(offset));
        this.buffer = left;
      }
    };

    this.source.connect(this.proc);
    this.proc.connect(this.ctx.destination);
  }

  stop(): void {
    this.running = false;
    try { this.source?.disconnect(); } catch {}
    try { this.proc?.disconnect(); } catch {}
    this.source = null;
    this.proc = null;

    if (this.stream) {
      for (const t of this.stream.getTracks()) try { t.stop(); } catch {}
      this.stream = null;
    }

    if (this.ctx) {
      try { this.ctx.close(); } catch {}
      this.ctx = null;
    }
    this.buffer = new Float32Array(0);
  }
}

