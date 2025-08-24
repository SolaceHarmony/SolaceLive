// Lightweight WebSocket client wrapper for Moshi packetized protocol
export type WSMessage = Record<string, unknown>;

export interface MoshiClientOptions {
  url?: string;
  sessionId?: string;
}

export class MoshiWSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string | null = null;
  private seq = 0;

  constructor(opts: MoshiClientOptions = {}) {
    this.url = opts.url || 'ws://localhost:8788';
    this.sessionId = opts.sessionId || null;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.send({ type: 'init', sessionId: this.sessionId });
    };
    this.ws.onmessage = (ev) => {
      const data = ev.data;
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          console.debug('ws msg', msg);
        } catch {
          console.debug('ws text', data);
        }
      } else {
        console.debug('binary message length', (data as ArrayBuffer).byteLength);
      }
    };
    this.ws.onclose = () => {
      console.log('ws closed');
    };
    this.ws.onerror = (e) => console.error('ws error', e);
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  send(obj: WSMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }

  sendPCMFrame(float32: Float32Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const seq = this.seq++;
    const header = { type: 'pcm_header', seq, sessionId: this.sessionId, samples: float32.length, sampleRate: 24000, frameRate: 12.5 };
    this.send(header);
    // send binary Float32 little-endian
    this.ws.send(float32.buffer);
  }

  sendMimiCodes(uint16: Uint16Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const seq = this.seq++;
    const header = { type: 'codes_header', seq, sessionId: this.sessionId, length: uint16.length };
    this.send(header);
    this.ws.send(uint16.buffer);
  }
}

export default MoshiWSClient;
