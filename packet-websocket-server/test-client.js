// Packet server test client placed in the same package to reuse local deps
const WebSocket = require('ws');

const PacketType = {
  AUDIO_CHUNK: 0x10,
  TEXT_PARTIAL: 0x20,
  TEXT_FINAL: 0x21,
  METADATA: 0x30,
  HEARTBEAT: 0x01,
  ACK: 0x02,
};

const Priority = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function encodePacket({ type, priority, sequenceNumber, timestamp, data, requiresAck }) {
  const header = Buffer.alloc(17);
  header.writeUInt8(type, 0);
  header.writeUInt8(priority, 1);
  header.writeUInt32LE(sequenceNumber, 2);
  header.writeDoubleLE(timestamp, 6);
  header.writeUInt16LE(data.length, 14);
  header.writeUInt8(requiresAck ? 1 : 0, 16);
  return Buffer.concat([header, Buffer.from(data)]);
}

function decodePacket(buf) {
  const type = buf.readUInt8(0);
  const sequenceNumber = buf.readUInt32LE(2);
  const data = buf.slice(17);
  return { type, sequenceNumber, data };
}

(async function main() {
  const url = process.env.PACKET_URL || 'ws://localhost:8789';
  let seq = 1;
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  ws.on('open', () => {
    console.log('[client] connected', url);
    const meta = { type: 'conversation_start', config: { sampleRate: 24000, format: 'pcm' } };
    ws.send(encodePacket({ type: PacketType.METADATA, priority: Priority.LOW, sequenceNumber: seq++, timestamp: Date.now(), data: Buffer.from(JSON.stringify(meta)), requiresAck: false }));
    ws.send(encodePacket({ type: PacketType.TEXT_FINAL, priority: Priority.HIGH, sequenceNumber: seq++, timestamp: Date.now(), data: Buffer.from('hello from colocated client'), requiresAck: true }));
    const len = 1024, sr = 24000, f32 = new Float32Array(len);
    for (let i = 0; i < len; i++) f32[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / sr);
    ws.send(encodePacket({ type: PacketType.AUDIO_CHUNK, priority: Priority.CRITICAL, sequenceNumber: seq++, timestamp: Date.now(), data: Buffer.from(f32.buffer), requiresAck: false }));
  });

  ws.on('message', (buf) => {
    const pkt = decodePacket(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
    if (pkt.type === PacketType.METADATA) console.log('[client] metadata', pkt.data.toString());
    if (pkt.type === PacketType.TEXT_PARTIAL) console.log('[client] partial', pkt.data.toString());
    if (pkt.type === PacketType.TEXT_FINAL) console.log('[client] final', pkt.data.toString());
    if (pkt.type === PacketType.AUDIO_CHUNK) console.log('[client] audio bytes', pkt.data.length);
    if (pkt.type === PacketType.ACK) console.log('[client] ack for seq', pkt.data.readUInt32LE(0));
  });

  ws.on('error', (e) => console.error('[client] error', e.message));
  ws.on('close', () => console.log('[client] closed'));

  setTimeout(() => ws.close(), 4000);
})();

