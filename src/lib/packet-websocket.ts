/*
 * Packet-Backed WebSocket Implementation (browser)
 * Moved into solace-live repo to keep builds self-contained.
 */

// Simple EventEmitter implementation for browser compatibility
type Listener = (...args: unknown[]) => void;
class EventEmitter {
  private events: { [key: string]: Listener[] } = {};
  on(event: string, listener: Listener): this {
    (this.events[event] ||= []).push(listener);
    return this;
  }
  off(event: string, listener: Listener): this {
    const list = this.events[event];
    if (!list) return this;
    const i = list.indexOf(listener);
    if (i >= 0) list.splice(i, 1);
    return this;
  }
  emit(event: string, ...args: unknown[]): boolean {
    const list = this.events[event];
    if (!list) return false;
    for (const fn of list) {
      try { fn(...args); } catch (e) { console.error(`[EventEmitter] ${event} handler error:`, e); }
    }
    return true;
  }
}

export enum PacketType {
  AUDIO_CHUNK = 0x10,
  TEXT_PARTIAL = 0x20,
  TEXT_FINAL = 0x21,
  METADATA = 0x30,
  HEARTBEAT = 0x01,
  ACK = 0x02
}

export enum Priority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3
}

export type JsonRecord = Record<string, unknown>;

export interface Packet {
  type: PacketType;
  priority: Priority;
  sequenceNumber: number;
  timestamp: number;
  data: Uint8Array;
  requiresAck?: boolean;
}

export interface PacketStats {
  packetsSent: number;
  packetsReceived: number;
  packetsDropped: number;
  averageLatency: number;
  totalLatency: number;
}

export class PacketCodec {
  static encode(packet: Packet): Uint8Array {
    const header = new ArrayBuffer(17);
    const v = new DataView(header);
    v.setUint8(0, packet.type);
    v.setUint8(1, packet.priority);
    v.setUint32(2, packet.sequenceNumber, true);
    v.setFloat64(6, packet.timestamp, true);
    v.setUint16(14, packet.data.length, true);
    v.setUint8(16, packet.requiresAck ? 1 : 0);
    const out = new Uint8Array(17 + packet.data.length);
    out.set(new Uint8Array(header), 0);
    out.set(packet.data, 17);
    return out;
  }
  static decode(data: Uint8Array): Packet {
    const v = new DataView(data.buffer, data.byteOffset, 17);
    return {
      type: v.getUint8(0),
      priority: v.getUint8(1),
      sequenceNumber: v.getUint32(2, true),
      timestamp: v.getFloat64(6, true),
      data: data.slice(17),
      requiresAck: v.getUint8(16) === 1,
    } as Packet;
  }
}

class PriorityPacketQueue {
  private q: Map<Priority, Packet[]> = new Map([
    [Priority.CRITICAL, []], [Priority.HIGH, []], [Priority.NORMAL, []], [Priority.LOW, []]
  ]);
  enqueue(p: Packet) { const arr = this.q.get(p.priority)!; arr.push(p); arr.sort((a,b)=>a.sequenceNumber-b.sequenceNumber); }
  dequeue(): Packet | null { for (const p of [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]) { const arr=this.q.get(p)!; if (arr.length) return arr.shift()!; } return null; }
  get length() { let n=0; for (const arr of this.q.values()) n+=arr.length; return n; }
}

export class PacketWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private sendQ = new PriorityPacketQueue();
  private recvQ = new PriorityPacketQueue();
  private seq = 0;
  private expected = 0;
  private procTimer: number | null = null;
  private hbTimer: number | null = null;
  private stats: PacketStats = { packetsSent: 0, packetsReceived: 0, packetsDropped: 0, averageLatency: 0, totalLatency: 0 };
  private readonly PROCESS_INTERVAL = 10;
  private readonly HEARTBEAT_MS = 5000;
  constructor(private url: string) { super(); }
  async connect(): Promise<void> {
    await new Promise<void>((res, rej) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = () => { this.startLoops(); res(); };
        this.ws.onclose = () => { this.stopLoops(); this.emit('disconnect'); };
        this.ws.onerror = (e) => rej(e as unknown as Error);
        this.ws.onmessage = (ev) => { void this.onMessage(ev); };
      } catch (e) { rej(e as unknown as Error); }
    });
  }
  close() { this.stopLoops(); this.ws?.close(); this.ws = null; }
  sendAudio(f32: Float32Array) {
    this.sendQ.enqueue({ type: PacketType.AUDIO_CHUNK, priority: Priority.CRITICAL, sequenceNumber: this.seq++, timestamp: Date.now(), data: new Uint8Array(f32.buffer), requiresAck: false });
  }
  sendText(text: string, isFinal=false) {
    const data = new TextEncoder().encode(text);
    this.sendQ.enqueue({ type: isFinal?PacketType.TEXT_FINAL:PacketType.TEXT_PARTIAL, priority: isFinal?Priority.HIGH:Priority.NORMAL, sequenceNumber: this.seq++, timestamp: Date.now(), data, requiresAck: isFinal });
  }
  sendMetadata(meta: JsonRecord) {
    const data = new TextEncoder().encode(JSON.stringify(meta));
    this.sendQ.enqueue({ type: PacketType.METADATA, priority: Priority.LOW, sequenceNumber: this.seq++, timestamp: Date.now(), data, requiresAck: false });
  }
  private startLoops() {
    this.procTimer = window.setInterval(()=>{ this.flushSend(); this.flushRecv(); }, this.PROCESS_INTERVAL);
    this.hbTimer = window.setInterval(()=>{ this.sendHeartbeat(); }, this.HEARTBEAT_MS);
  }
  private stopLoops() { if (this.procTimer) { clearInterval(this.procTimer); this.procTimer=null; } if (this.hbTimer){ clearInterval(this.hbTimer); this.hbTimer=null; } }
  private flushSend() {
    const ws = this.ws; if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let n=0; const max=10;
    while (n<max && this.sendQ.length>0) {
      const pkt = this.sendQ.dequeue()!;
      try { ws.send(PacketCodec.encode(pkt)); this.stats.packetsSent++; n++; this.emit('packetSent', pkt); } catch (e) { console.error('[PacketWS] send error', e); this.stats.packetsDropped++; }
    }
  }
  private flushRecv() {
    let n=0; const max=10; while (n<max && this.recvQ.length>0) { const pkt=this.recvQ.dequeue(); if (!pkt) break; this.dispatch(pkt); n++; }
  }
  private async onMessage(ev: MessageEvent) {
    try {
      let bytes: Uint8Array;
      if (ev.data instanceof ArrayBuffer) {
        bytes = new Uint8Array(ev.data);
      } else if (ev.data instanceof Blob) {
        const ab = await ev.data.arrayBuffer();
        bytes = new Uint8Array(ab);
      } else {
        return; // unsupported payload
      }
      const pkt = PacketCodec.decode(bytes);
      const lat = Date.now() - pkt.timestamp; this.stats.totalLatency += lat; this.stats.averageLatency = this.stats.totalLatency / (this.stats.packetsReceived+1);
      if (pkt.sequenceNumber < this.expected) { if (pkt.type===PacketType.AUDIO_CHUNK) this.recvQ.enqueue(pkt); return; }
      this.recvQ.enqueue(pkt); if (pkt.sequenceNumber === this.expected) this.expected++;
      this.stats.packetsReceived++;
      if (pkt.requiresAck) this.ack(pkt.sequenceNumber);
    } catch (e) { console.error('[PacketWS] decode error', e); this.stats.packetsDropped++; }
  }
  private dispatch(pkt: Packet) {
    switch (pkt.type) {
      case PacketType.AUDIO_CHUNK: this.emit('audio', new Float32Array(pkt.data.buffer), pkt.timestamp); break;
      case PacketType.TEXT_PARTIAL: this.emit('textPartial', new TextDecoder().decode(pkt.data), pkt.timestamp); break;
      case PacketType.TEXT_FINAL: this.emit('textFinal', new TextDecoder().decode(pkt.data), pkt.timestamp); break;
      case PacketType.METADATA:
        try { this.emit('metadata', JSON.parse(new TextDecoder().decode(pkt.data)) as JsonRecord, pkt.timestamp); }
        catch { this.emit('metadata', { raw: new TextDecoder().decode(pkt.data) } as JsonRecord, pkt.timestamp); }
        break;
      case PacketType.HEARTBEAT: this.emit('heartbeat', pkt.timestamp); break;
      case PacketType.ACK: this.emit('ack', new DataView(pkt.data.buffer).getUint32(0, true)); break;
    }
  }
  private ack(seq: number) {
    const buf = new ArrayBuffer(4); new DataView(buf).setUint32(0, seq, true);
    this.sendQ.enqueue({ type: PacketType.ACK, priority: Priority.HIGH, sequenceNumber: this.seq++, timestamp: Date.now(), data: new Uint8Array(buf), requiresAck: false });
  }
  private sendHeartbeat() {
    this.sendQ.enqueue({ type: PacketType.HEARTBEAT, priority: Priority.LOW, sequenceNumber: this.seq++, timestamp: Date.now(), data: new Uint8Array(0), requiresAck: false });
  }
  getStats(){ return { ...this.stats, queueSizes:{ send: this.sendQ.length, receive: this.recvQ.length } }; }
}

export class SolaceLivePacketClient extends EventEmitter {
  private packetWS: PacketWebSocket;
  constructor(serverUrl: string) { super(); this.packetWS = new PacketWebSocket(serverUrl); this.bind(); }
  async connect(){ await this.packetWS.connect(); }
  private bind(){
    this.packetWS.on('audio', (a: Float32Array, t: number)=>this.emit('audioChunk', a, t));
    this.packetWS.on('textPartial', (s: string, t: number)=>this.emit('textPartial', s, t));
    this.packetWS.on('textFinal', (s: string, t: number)=>this.emit('textFinal', s, t));
    this.packetWS.on('metadata', (m: JsonRecord, t: number)=>this.emit('metadata', m, t));
    this.packetWS.on('disconnect', ()=>this.emit('disconnected'));
  }
  sendAudio(a: Float32Array){ this.packetWS.sendAudio(a); }
  sendUserText(s: string){ this.packetWS.sendText(s, true); }
  sendPartialTranscription(s: string){ this.packetWS.sendText(s, false); }
  sendMetadata(meta: JsonRecord){ this.packetWS.sendMetadata(meta); }
  getPerformanceStats(){ return this.packetWS.getStats(); }
  close(){ this.packetWS.close(); }
}
